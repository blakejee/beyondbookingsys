// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';
import { DateTime } from 'https://esm.sh/luxon@3.5.0';
/* =====================  CONFIG / ENV  ===================== */ const LONDON = 'Europe/London';
const BIZ = {
  NAME: Deno.env.get('BUSINESS_NAME') || 'Studio Beyond',
  ADR1: Deno.env.get('BUSINESS_ADDRESS_LINE1') || '',
  ADR2: Deno.env.get('BUSINESS_ADDRESS_LINE2') || '',
  EMAIL: Deno.env.get('BUSINESS_EMAIL') || 'noreply@thestudiobeyond.co.uk',
  PHONE: Deno.env.get('BUSINESS_PHONE') || '',
  REGNO: Deno.env.get('BUSINESS_REG_NO') || '',
  VATNO: Deno.env.get('BUSINESS_VAT_NO') || '',
  TERMS: Deno.env.get('PAYMENT_TERMS') || 'Payment received via Stripe at time of booking.'
};
const VAT_RATE = Number(Deno.env.get('VAT_RATE') ?? '0'); // e.g. 0.20
const CURRENCY_SYMBOL = Deno.env.get('CURRENCY_SYMBOL') ?? '£'; // for display only
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || `${BIZ.NAME} <${BIZ.EMAIL}>`;
const EMAIL_MODE = (Deno.env.get('EMAIL_SEND_MODE') || 'live').toLowerCase(); // 'live' | 'sandbox'
const RESEND_ACCOUNT_EMAIL = Deno.env.get('RESEND_ACCOUNT_EMAIL') || '';
/* =====================  CORS  ===================== */ const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
/* =====================  GOOGLE SERVICE ACCOUNT  ===================== */ async function getGoogleAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const b64u = (s)=>btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const enc = (o)=>b64u(JSON.stringify(o));
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const pem = credentials.private_key.replace(/\\n/g, '\n');
  const raw = atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, ''));
  const bytes = new Uint8Array(raw.length);
  for(let i = 0; i < raw.length; i++)bytes[i] = raw.charCodeAt(i);
  const key = await crypto.subtle.importKey('pkcs8', bytes.buffer, {
    name: 'RSASSA-PKCS1-v1_5',
    hash: 'SHA-256'
  }, false, [
    'sign'
  ]);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64u(String.fromCharCode(...new Uint8Array(sig)))}`;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  if (!resp.ok) throw new Error(`Google token error: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.access_token;
}
/* =====================  SUPABASE & STRIPE  ===================== */ const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient()
});
/* =====================  GOOGLE CALENDAR  ===================== */ async function createCalendarEvent(booking, credentials) {
  const accessToken = await getGoogleAccessToken(credentials);
  const customerName = booking?.profiles?.full_name ?? 'Customer';
  const customerEmail = booking?.profiles?.email ?? '';
  // DB is UTC; convert to London local for API
  const startLocal = DateTime.fromISO(booking.start_time, {
    zone: 'utc'
  }).setZone(LONDON);
  const endLocal = DateTime.fromISO(booking.end_time, {
    zone: 'utc'
  }).setZone(LONDON);
  const eventBody = {
    summary: `Booking: ${booking.rooms.name} — ${customerName}`,
    description: `Booked by: ${customerName}${customerEmail ? `\nEmail: ${customerEmail}` : ''}\nBooking #${booking.id}`,
    start: {
      dateTime: startLocal.toFormat("yyyy-LL-dd'T'HH:mm:ss"),
      timeZone: LONDON
    },
    end: {
      dateTime: endLocal.toFormat("yyyy-LL-dd'T'HH:mm:ss"),
      timeZone: LONDON
    },
    guestsCanInviteOthers: false,
    guestsCanSeeOtherGuests: false
  };
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(booking.rooms.calendar_id)}/events?sendUpdates=none`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventBody)
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google Calendar API Error: ${response.status} ${errorBody}`);
  }
  const data = await response.json();
  return data.id;
}
/* =====================  EMAIL  ===================== */ async function sendConfirmationEmail(booking, subject = 'Your Studio Booking is Confirmed!') {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set. Skipping email.');
    return {
      skipped: true,
      reason: 'missing_key'
    };
  }
  const recipient = booking?.profiles?.email || '';
  const to = EMAIL_MODE === 'sandbox' ? RESEND_ACCOUNT_EMAIL || recipient : recipient;
  if (!to) {
    console.warn('[email] No recipient email; skipping for booking', booking?.id);
    return {
      skipped: true,
      reason: 'no_recipient'
    };
  }
  const startLocal = DateTime.fromISO(booking.start_time, {
    zone: 'utc'
  }).setZone(LONDON);
  const endLocal = DateTime.fromISO(booking.end_time, {
    zone: 'utc'
  }).setZone(LONDON);
  const emailHtml = `
    <h2>${BIZ.NAME} – Booking Confirmation</h2>
    <p>Dear ${booking?.profiles?.full_name || 'Customer'},</p>
    <p>Your booking has been ${subject.includes('Amended') ? 'amended and confirmed' : 'confirmed'}!</p>
    <h3>Booking Details</h3>
    <ul>
      <li><strong>Room:</strong> ${booking?.rooms?.name || ''}</li>
      <li><strong>Location:</strong> ${booking?.rooms?.location || ''}</li>
      <li><strong>Date:</strong> ${startLocal.toFormat('dd/LL/yyyy')}</li>
      <li><strong>Time:</strong> ${startLocal.toFormat('HH:mm')} - ${endLocal.toFormat('HH:mm')}</li>
      <li><strong>Duration:</strong> ${booking?.duration} hour(s)</li>
      <li><strong>Total:</strong> ${CURRENCY_SYMBOL}${Number(booking?.total_price).toFixed(2)}</li>
    </ul>
    <hr />
    <p class="muted" style="color:#6c757d;font-size:12px;margin-top:16px;">
      ${BIZ.NAME} — ${[
    BIZ.ADR1,
    BIZ.ADR2
  ].filter(Boolean).join(', ')}<br/>
      ${BIZ.EMAIL}${BIZ.PHONE ? ` · ${BIZ.PHONE}` : ''}${BIZ.REGNO ? ` · Reg ${BIZ.REGNO}` : ''}${BIZ.VATNO ? ` · VAT ${BIZ.VATNO}` : ''}
    </p>
  `;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [
          to
        ],
        subject,
        html: emailHtml
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('[email] Resend API Error:', res.status, errText, {
        mode: EMAIL_MODE,
        toAttempted: to,
        from: EMAIL_FROM
      });
      return {
        ok: false,
        status: res.status,
        error: errText
      };
    }
    return {
      ok: true
    };
  } catch (e) {
    console.error('[email] Unexpected error:', e?.message || e);
    return {
      ok: false,
      error: e?.message || String(e)
    };
  }
}
async function createInvoiceRecord({ booking, paymentIntentId, last4 }) {
  const subtotal = Number(booking.total_price) || 0;
  const tax_rate = VAT_RATE; // from ENV
  const tax_amount = +(subtotal * tax_rate).toFixed(2);
  const total = +(subtotal + tax_amount).toFixed(2);
  const nowIso = new Date().toISOString();
  const number = `INV-${DateTime.now().setZone(LONDON).toFormat('yyyy')}-${String(booking.id).padStart(5, '0')}`;
  const { data: invoice, error } = await supabaseClient.from('invoices').insert({
    booking_id: booking.id,
    number,
    issued_at: nowIso,
    paid_at: nowIso,
    subtotal,
    tax_rate,
    tax_amount,
    total,
    currency: (booking.currency || 'gbp').toLowerCase(),
    payment_method_last4: last4 ?? null,
    stripe_payment_intent_id: paymentIntentId,
    billing_name: booking?.profiles?.full_name ?? '',
    billing_email: booking?.profiles?.email ?? '',
    html_content: ''
  }).select('*').single();
  if (error) throw new Error(`Invoice insert failed: ${error.message}`);
  return invoice;
}
function generateInvoiceHtmlFromRecord(invoice, booking) {
  const startLocal = DateTime.fromISO(booking.start_time, {
    zone: 'utc'
  }).setZone(LONDON);
  const endLocal = DateTime.fromISO(booking.end_time, {
    zone: 'utc'
  }).setZone(LONDON);
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Invoice ${invoice.number}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 2rem; background-color: #f8f9fa; color: #212529; }
        .invoice-box { max-width: 900px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0,0,0,0.15); font-size: 16px; background: #fff; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 24px; }
        .brand h1 { margin:0 0 4px; font-size: 22px; }
        .muted { color:#6c757d; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; }
        thead th { background: #eee; border-bottom: 1px solid #ddd; }
        tfoot td { border-top: 2px solid #eee; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="invoice-box">
        <div class="header">
          <div class="brand">
            <h1>${BIZ.NAME}</h1>
            <div class="muted">${[
    BIZ.ADR1,
    BIZ.ADR2
  ].filter(Boolean).join(', ')}</div>
            <div class="muted">${BIZ.EMAIL}${BIZ.PHONE ? ` · ${BIZ.PHONE}` : ''}</div>
            <div class="muted">${BIZ.REGNO ? `Company No: ${BIZ.REGNO}` : ''}${BIZ.REGNO && BIZ.VATNO ? ' · ' : ''}${BIZ.VATNO ? `VAT: ${BIZ.VATNO}` : ''}</div>
          </div>
          <div class="meta">
            <div><strong>Invoice #:</strong> ${invoice.number}</div>
            <div><strong>Issued:</strong> ${DateTime.fromISO(invoice.issued_at).setZone(LONDON).toFormat('dd/LL/yyyy')}</div>
            ${invoice.paid_at ? `<div><strong>Paid:</strong> ${DateTime.fromISO(invoice.paid_at).setZone(LONDON).toFormat('dd/LL/yyyy')}</div>` : ''}
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <strong>Bill To:</strong><br/>
          ${invoice.billing_name || booking?.profiles?.full_name || ''}<br/>
          ${invoice.billing_email || booking?.profiles?.email || ''}
        </div>

        <table>
          <thead>
            <tr><th>Description</th><th>Amount</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Room Booking: ${booking.rooms.name}<br/>
                Date: ${startLocal.toFormat('dd/LL/yyyy')}<br/>
                Time: ${startLocal.toFormat('HH:mm')} - ${endLocal.toFormat('HH:mm')} (${booking.duration} hour/s)
              </td>
              <td>${CURRENCY_SYMBOL}${Number(invoice.subtotal).toFixed(2)}</td>
            </tr>
            ${Number(invoice.tax_rate) > 0 ? `
            <tr>
              <td>VAT (${(Number(invoice.tax_rate) * 100).toFixed(0)}%)</td>
              <td>${CURRENCY_SYMBOL}${Number(invoice.tax_amount).toFixed(2)}</td>
            </tr>` : ''}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td>${CURRENCY_SYMBOL}${Number(invoice.total).toFixed(2)} ${String(invoice.currency || 'gbp').toUpperCase()}</td>
            </tr>
          </tfoot>
        </table>

        ${BIZ.TERMS ? `<div class="muted" style="margin-top:12px;">${BIZ.TERMS}</div>` : ''}

        <div class="muted" style="margin-top:12px;">
          Payment: ${invoice.stripe_payment_intent_id || ''} ${invoice.payment_method_last4 ? `(**** **** **** ${invoice.payment_method_last4})` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
}
async function finalizeInvoiceHtml(invoice, booking) {
  const html = generateInvoiceHtmlFromRecord(invoice, booking);
  const { error } = await supabaseClient.from('invoices').update({
    html_content: html
  }).eq('id', invoice.id);
  if (error) throw new Error(`Invoice HTML update failed: ${error.message}`);
}
/* =====================  WEBHOOK  ===================== */ Deno.serve(async (req)=>{
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET') || '');
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return new Response(err.message, {
      status: 400
    });
  }
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    // Try to get card last4 (best effort)
    let last4 = null;
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntent.id, {
        expand: [
          'latest_charge'
        ]
      });
      const chId = pi.latest_charge;
      if (chId && typeof chId === 'string') {
        const ch = await stripe.charges.retrieve(chId);
        last4 = ch.payment_method_details?.card?.last4 ?? null;
      }
    } catch (_) {
    // ignore
    }
    // ----- Amendment flow -----
    const amendment_token = (paymentIntent.metadata || {}).amendment_token;
    if (amendment_token) {
      try {
        const { data: amend, error: amendErr } = await supabaseClient.from('booking_amendments').select('*, bookings!inner(id, calendar_event_id, rooms(calendar_id), profiles(*))').eq('token', amendment_token).maybeSingle();
        if (amendErr || !amend) {
          console.error('Webhook Error: Amendment token not found or invalid.', amendment_token);
          return new Response('Amendment not found', {
            status: 404
          });
        }
        if (amend.bookings.calendar_event_id) {
          await supabaseClient.functions.invoke('delete-google-calendar-event', {
            body: {
              booking_id: amend.booking_id
            }
          });
        }
        const { data: updatedBooking, error: updateErr } = await supabaseClient.from('bookings').update({
          room_id: amend.new_room_id,
          date: amend.new_date,
          start_time: amend.new_start_time,
          end_time: amend.new_end_time,
          duration: Math.round((new Date(amend.new_end_time).getTime() - new Date(amend.new_start_time).getTime()) / (1000 * 60 * 60)),
          total_price: amend.new_total_price,
          status: 'confirmed'
        }).eq('id', amend.booking_id).select('*, rooms(*), profiles(*)').single();
        if (updateErr) throw updateErr;
        const googleCreds = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS') || '{}');
        const newCalendarEventId = await createCalendarEvent(updatedBooking, googleCreds);
        const invoice = await createInvoiceRecord({
          booking: updatedBooking,
          paymentIntentId: paymentIntent.id,
          last4
        });
        await finalizeInvoiceHtml(invoice, updatedBooking);
        await supabaseClient.from('bookings').update({
          calendar_event_id: newCalendarEventId
        }).eq('id', updatedBooking.id);
        await sendConfirmationEmail(updatedBooking, 'Your Booking Has Been Amended');
        await supabaseClient.from('booking_amendments').delete().eq('token', amendment_token);
      } catch (processingError) {
        console.error('Webhook Amendment Processing Error:', processingError.message);
        return new Response(processingError.message, {
          status: 500
        });
      }
      return new Response(JSON.stringify({
        received: true,
        message: 'Amendment processed'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // ----- Standard booking flow -----
    const booking_id = (paymentIntent.metadata || {}).booking_id;
    if (booking_id) {
      try {
        const { data: booking, error: bookingError } = await supabaseClient.from('bookings').select('*, rooms(*), profiles(*)').eq('id', booking_id).single();
        if (bookingError || !booking) {
          console.error('Webhook Error: Booking not found for ID:', booking_id);
          return new Response('Booking not found', {
            status: 404
          });
        }
        if (booking.status === 'confirmed' || booking.status === 'processing') {
          return new Response(JSON.stringify({
            received: true,
            message: 'Already processed'
          }));
        }
        await supabaseClient.from('bookings').update({
          status: 'processing'
        }).eq('id', booking_id);
        const googleCreds = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS') || '{}');
        const calendarEventId = await createCalendarEvent(booking, googleCreds);
        const invoice = await createInvoiceRecord({
          booking,
          paymentIntentId: paymentIntent.id,
          last4
        });
        await finalizeInvoiceHtml(invoice, booking);
        await supabaseClient.from('bookings').update({
          calendar_event_id: calendarEventId
        }).eq('id', booking_id);
        await sendConfirmationEmail(booking);
        await supabaseClient.from('bookings').update({
          status: 'confirmed'
        }).eq('id', booking_id);
      } catch (processingError) {
        console.error('Webhook Processing Error:', processingError.message);
        await supabaseClient.from('bookings').update({
          status: 'payment_failed'
        }).eq('id', booking_id);
        return new Response(processingError.message, {
          status: 500
        });
      }
    }
  }
  return new Response(JSON.stringify({
    received: true
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
});
