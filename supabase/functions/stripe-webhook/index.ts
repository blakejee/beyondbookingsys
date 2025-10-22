
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
    import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';
    import { DateTime } from 'https://esm.sh/luxon@3.4.4';

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    async function getGoogleAccessToken(credentials: any) {
      const now = Math.floor(Date.now()/1000);
      const header = { alg: "RS256", typ: "JWT" };
      const payload = {
        iss: credentials.client_email,
        scope: "https://www.googleapis.com/auth/calendar",
        aud: "https://oauth2.googleapis.com/token",
        iat: now, exp: now + 3600
      };
      const b64u = (s: string) => btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
      const enc = (o:any)=> b64u(JSON.stringify(o));
      const unsigned = `${enc(header)}.${enc(payload)}`;

      const pem = credentials.private_key.replace(/\\n/g,"\n");
      const raw = atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g,""));
      const bytes = new Uint8Array(raw.length);
      for (let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);

      const key = await crypto.subtle.importKey("pkcs8", bytes.buffer, {name:"RSASSA-PKCS1-v1_5", hash:"SHA-256"}, false, ["sign"]);
      const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
      const jwt = `${unsigned}.${b64u(String.fromCharCode(...new Uint8Array(sig)))}`;

      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method:"POST",
        headers:{ "Content-Type":"application/x-www-form-urlencoded" },
        body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
      });
      if (!resp.ok) throw new Error(`Google token error: ${resp.status} ${await resp.text()}`);
      const data = await resp.json();
      return data.access_token as string;
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient()
    });

    async function createCalendarEvent(booking, credentials) {
      const accessToken = await getGoogleAccessToken(credentials);
      
      const customerName = booking?.profiles?.full_name ?? "Customer";
      const customerEmail = booking?.profiles?.email ?? "";

      const eventBody = {
        summary: `Booking: ${booking.rooms.name} — ${customerName}`,
        description: `Booked by: ${customerName}${customerEmail ? `\nEmail: ${customerEmail}` : ""}\nBooking #${booking.id}`,
        start: { dateTime: booking.start_time },
        end:   { dateTime: booking.end_time },
        guestsCanInviteOthers: false,
        guestsCanSeeOtherGuests: false,
      };

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(booking.rooms.calendar_id)}/events?sendUpdates=none`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Google Calendar API Error: ${response.status} ${errorBody}`);
      }

      const data = await response.json();
      return data.id;
    }

    async function sendConfirmationEmail(booking: any, subject = 'Your Studio Booking is Confirmed!') {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'Studio Beyond <noreply@thestudiobeyond.co.uk>';
      const MODE = (Deno.env.get('EMAIL_SEND_MODE') || 'live').toLowerCase(); // 'live' | 'sandbox'
      const RESEND_ACCOUNT_EMAIL = Deno.env.get('RESEND_ACCOUNT_EMAIL') || ''; // optional: your own email for sandbox

      if (!RESEND_API_KEY) {
        console.warn('[email] RESEND_API_KEY not set. Skipping email.');
        return { skipped: true, reason: 'missing_key' };
      }

      const recipient = booking?.profiles?.email || '';
      const to = MODE === 'sandbox' ? (RESEND_ACCOUNT_EMAIL || recipient) : recipient;

      if (!to) {
        console.warn('[email] No recipient email; skipping for booking', booking?.id);
        return { skipped: true, reason: 'no_recipient' };
      }

      const startDate = new Date(booking.start_time);
      const endDate = new Date(booking.end_time);

      const emailHtml = `
        <h2>Booking Confirmation</h2>
        <p>Dear ${booking?.profiles?.full_name || 'Customer'},</p>
        <p>Your booking has been ${subject.includes('Amended') ? 'amended and confirmed' : 'confirmed'}!</p>
        <h3>Booking Details:</h3>
        <ul>
          <li><strong>Room:</strong> ${booking?.rooms?.name || ''}</li>
          <li><strong>Location:</strong> ${booking?.rooms?.location || ''}</li>
          <li><strong>Date:</strong> ${startDate.toLocaleDateString('en-GB', { timeZone: 'Europe/London' })}</li>
          <li><strong>Time:</strong> ${startDate.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' })}</li>
          <li><strong>Duration:</strong> ${booking?.duration} hour(s)</li>
          <li><strong>Total:</strong> £${parseFloat(booking?.total_price).toFixed(2)}</li>
        </ul>
        <p>Thank you for your booking!</p>
      `;

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: EMAIL_FROM,   // MUST be a verified domain in 'live' mode
            to: [to],
            subject,
            html: emailHtml,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error('[email] Resend API Error:', res.status, errText, {
            mode: MODE, toAttempted: to, from: EMAIL_FROM,
          });
          return { ok: false, status: res.status, error: errText };
        }

        return { ok: true };
      } catch (e: any) {
        console.error('[email] Unexpected error:', e?.message || e);
        return { ok: false, error: e?.message || String(e) };
      }
    }

    function generateInvoiceHtml(booking, title = 'INVOICE', extras = []) {
      const BUSINESS_NAME = Deno.env.get('BUSINESS_NAME') || 'Studio Beyond';
      const BUSINESS_ADDRESS_LINE1 = Deno.env.get('BUSINESS_ADDRESS_LINE1') || '39 Rodney Street';
      const BUSINESS_ADDRESS_LINE2 = Deno.env.get('BUSINESS_ADDRESS_LINE2') || 'Liverpool, L1 9EN';
      const BUSINESS_EMAIL = Deno.env.get('BUSINESS_EMAIL') || 'bookings@thestudiobeyond.co.uk';
      const BUSINESS_PHONE = Deno.env.get('BUSINESS_PHONE') || '+44 0000 000000';
      const BUSINESS_REG_NO = Deno.env.get('BUSINESS_REG_NO') || '12345678';
      const BUSINESS_VAT_NO = Deno.env.get('BUSINESS_VAT_NO') || 'GB123456789';
      const CURRENCY_SYMBOL = Deno.env.get('CURRENCY_SYMBOL') || '£';
      const VAT_RATE = parseFloat(Deno.env.get('VAT_RATE') || '0.20');
      const PAYMENT_TERMS = Deno.env.get('PAYMENT_TERMS') || 'Payment received via Stripe at time of booking. Non-refundable within 24 hours of the session.';

      const startDate = new Date(booking.start_time);
      const endDate = new Date(booking.end_time);
      const issueDate = new Date();

      const totalPrice = parseFloat(booking.total_price);
      const subtotal = totalPrice / (1 + VAT_RATE);
      const vatAmount = totalPrice - subtotal;

      const formatCurrency = (amount) => `${CURRENCY_SYMBOL}${amount.toFixed(2)}`;

      const extrasHtml = extras.map(item => `
        <tr class="item">
          <td>${item.description}</td>
          <td>${formatCurrency(item.price)}</td>
        </tr>
      `).join('');

      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title} #${booking.id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 2rem; background-color: #f8f9fa; color: #333; }
            .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); font-size: 16px; line-height: 24px; background: white; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
            .header h1 { margin: 0; color: #000; }
            .company-details { text-align: right; font-size: 14px; }
            table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
            table td { padding: 8px; vertical-align: top; }
            table tr.heading td { background: #eee; border-bottom: 1px solid #ddd; font-weight: bold; }
            table tr.item td { border-bottom: 1px solid #eee; }
            .totals table { width: auto; margin-left: auto; }
            .totals table td { text-align: right; }
            .totals table tr.total td { border-top: 2px solid #eee; font-weight: bold; }
            .footer { margin-top: 2rem; font-size: 12px; text-align: center; color: #777; }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <div class="header">
              <div>
                <h1>${title}</h1>
                <p>Invoice #: ${booking.id}<br>
                   Date Issued: ${issueDate.toLocaleDateString('en-GB', { timeZone: 'Europe/London' })}</p>
              </div>
              <div class="company-details">
                <strong>${BUSINESS_NAME}</strong><br>
                ${BUSINESS_ADDRESS_LINE1}<br>
                ${BUSINESS_ADDRESS_LINE2}<br>
                ${BUSINESS_EMAIL}<br>
                ${BUSINESS_PHONE}<br>
                Reg: ${BUSINESS_REG_NO} | VAT: ${BUSINESS_VAT_NO}
              </div>
            </div>
            
            <div style="margin-bottom: 2rem;">
              <strong>Billed To:</strong><br>
              ${booking.profiles.company_name || booking.profiles.full_name}<br>
              ${booking.profiles.email}
            </div>

            <table>
              <tr class="heading">
                <td>Description</td>
                <td style="text-align: right;">Price</td>
              </tr>
              <tr class="item">
                <td>
                  Room Booking: ${booking.rooms.name} (${booking.rooms.location})<br>
                  <small>
                    Date: ${startDate.toLocaleDateString('en-GB', { timeZone: 'Europe/London' })}<br>
                    Time: ${startDate.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' })} (${booking.duration} hour/s)
                  </small>
                </td>
                <td style="text-align: right;">${formatCurrency(totalPrice)}</td>
              </tr>
              ${extrasHtml}
            </table>

            <div class="totals">
              <table>
                <tr>
                  <td>Subtotal:</td>
                  <td>${formatCurrency(subtotal)}</td>
                </tr>
                <tr>
                  <td>VAT (${(VAT_RATE * 100).toFixed(0)}%):</td>
                  <td>${formatCurrency(vatAmount)}</td>
                </tr>
                <tr class="total">
                  <td>Total:</td>
                  <td>${formatCurrency(totalPrice)}</td>
                </tr>
              </table>
            </div>

            <div class="footer">
              <p><strong>Payment Terms:</strong> ${PAYMENT_TERMS}</p>
              <p>Thank you for your business!</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    Deno.serve(async (req) => {
      const signature = req.headers.get('stripe-signature');
      const body = await req.text();

      let event;
      try {
        event = await stripe.webhooks.constructEventAsync(
          body,
          signature!,
          Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''
        );
      } catch (err) {
        console.error('Stripe webhook signature verification failed:', err.message);
        return new Response(err.message, { status: 400 });
      }

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const amendment_token = paymentIntent.metadata.amendment_token;

        if (amendment_token) {
          try {
            const { data: amend, error: amendErr } = await supabaseClient
              .from("booking_amendments")
              .select("*, bookings!inner(id, calendar_event_id, rooms(calendar_id), profiles(*))")
              .eq("token", amendment_token)
              .maybeSingle();

            if (amendErr || !amend) {
              console.error('Webhook Error: Amendment token not found or invalid.', amendment_token);
              return new Response('Amendment not found', { status: 404 });
            }

            if (amend.bookings.calendar_event_id) {
              await supabaseClient.functions.invoke('delete-google-calendar-event', { body: { booking_id: amend.booking_id } });
            }
            
            const startZoned = DateTime.fromISO(`${amend.new_date}T${amend.new_start_time}`, { zone: 'Europe/London' });
            const endZoned = startZoned.plus({ hours: Math.round((new Date(amend.new_end_time).getTime() - new Date(amend.new_start_time).getTime()) / (1000 * 60 * 60)) });
            const startISO = startZoned.toISO({ suppressMilliseconds: true });
            const endISO = endZoned.toISO({ suppressMilliseconds: true });

            const { data: updatedBooking, error: updateErr } = await supabaseClient.from("bookings").update({
              room_id: amend.new_room_id,
              date: amend.new_date,
              start_time: startISO,
              end_time: endISO,
              duration: Math.round((new Date(amend.new_end_time).getTime() - new Date(amend.new_start_time).getTime()) / (1000 * 60 * 60)),
              total_price: amend.new_total_price,
              status: "confirmed"
            }).eq("id", amend.booking_id).select('*, rooms(*), profiles(*, company_name)').single();

            if (updateErr) throw updateErr;

            const googleCreds = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS') || '{}');
            const newCalendarEventId = await createCalendarEvent(updatedBooking, googleCreds);
            const invoiceHtml = generateInvoiceHtml(updatedBooking, 'AMENDED INVOICE');

            await Promise.allSettled([
              supabaseClient.from('bookings').update({ calendar_event_id: newCalendarEventId }).eq('id', updatedBooking.id),
              supabaseClient.from('invoices').insert({ booking_id: updatedBooking.id, html_content: invoiceHtml }),
              sendConfirmationEmail(updatedBooking, 'Your Booking Has Been Amended'),
              supabaseClient.from("booking_amendments").delete().eq("token", amendment_token)
            ]);

          } catch (processingError) {
            console.error('Webhook Amendment Processing Error:', processingError.message);
            return new Response(processingError.message, { status: 500 });
          }
          return new Response(JSON.stringify({ received: true, message: 'Amendment processed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }

        const booking_id = paymentIntent.metadata.booking_id;
        if (booking_id) {
          try {
              const { data: booking, error: bookingError } = await supabaseClient
                  .from('bookings')
                  .select('*, rooms(*), profiles(*, company_name)')
                  .eq('id', booking_id)
                  .single();

              if (bookingError || !booking) {
                  console.error('Webhook Error: Booking not found for ID:', booking_id);
                  return new Response('Booking not found', { status: 404 });
              }
              
              if (booking.status === 'confirmed' || booking.status === 'processing') {
                  return new Response(JSON.stringify({ received: true, message: 'Already processed' }));
              }

              await supabaseClient.from('bookings').update({ status: 'processing' }).eq('id', booking_id);

              const googleCreds = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS') || '{}');
              const calendarEventId = await createCalendarEvent(booking, googleCreds);
              const invoiceHtml = generateInvoiceHtml(booking);
              
              await Promise.allSettled([
                supabaseClient.from('bookings').update({ calendar_event_id: calendarEventId }).eq('id', booking_id),
                supabaseClient.from('invoices').insert({ booking_id: booking.id, html_content: invoiceHtml }),
                sendConfirmationEmail(booking)
              ]);

              await supabaseClient.from('bookings').update({ status: 'confirmed' }).eq('id', booking_id);

          } catch (processingError) {
              console.error('Webhook Processing Error:', processingError.message);
              await supabaseClient.from('bookings').update({ status: 'payment_failed' }).eq('id', booking_id);
              return new Response(processingError.message, { status: 500 });
          }
        }
      }

      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    });
