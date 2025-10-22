import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
    import { DateTime } from 'https://esm.sh/luxon@3.4.4';

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    async function getGoogleAccessToken(credentials: any) {
      const now = Math.floor(Date.now() / 1000);
      const header = { alg: "RS256", typ: "JWT" };
      const payload = { iss: credentials.client_email, scope: "https://www.googleapis.com/auth/calendar", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
      const b64u = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const enc = (o: any) => b64u(JSON.stringify(o));
      const unsigned = `${enc(header)}.${enc(payload)}`;

      const pem = credentials.private_key.replace(/\\n/g, "\n");
      const raw = atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, ""));
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

      const key = await crypto.subtle.importKey("pkcs8", bytes.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
      const jwt = `${unsigned}.${b64u(String.fromCharCode(...new Uint8Array(sig)))}`;

      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
      });
      if (!resp.ok) throw new Error(`Google token error: ${resp.status} ${await resp.text()}`);
      const data = await resp.json();
      return data.access_token as string;
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    Deno.serve(async (req) => {
      if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
      }

      try {
        const { booking_id, date, startTime, duration } = await req.json();

        // 1. Fetch original booking
        const { data: booking, error: fetchError } = await supabase
          .from('bookings')
          .select('*, rooms(*), profiles(*)')
          .eq('id', booking_id)
          .single();

        if (fetchError || !booking) {
          throw new Error("Booking not found");
        }

        // 2. Calculate new times with Luxon
        const startZoned = DateTime.fromISO(`${date}T${startTime}`, { zone: 'Europe/London' });
        const endZoned = startZoned.plus({ hours: duration });
        const newStartISO = startZoned.toISO({ suppressMilliseconds: true });
        const newEndISO = endZoned.toISO({ suppressMilliseconds: true });

        // 3. Check for conflicts
        const { data: dbConflicts } = await supabase
          .from('bookings')
          .select('id')
          .eq('room_id', booking.room_id)
          .neq('id', booking_id)
          .gte('end_time', newStartISO)
          .lt('start_time', newEndISO);

        if (dbConflicts && dbConflicts.length > 0) {
          return new Response(JSON.stringify({ error: 'The selected time conflicts with another booking.', reason: 'db_conflict' }), { status: 409, headers: corsHeaders });
        }
        
        const googleCreds = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS') || '{}');
        const token = await getGoogleAccessToken(googleCreds);
        
        const gcalCheckUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(booking.rooms.calendar_id)}/freeBusy`;
        const gcalCheckResp = await fetch(gcalCheckUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ timeMin: newStartISO, timeMax: newEndISO, items: [{id: booking.rooms.calendar_id}] })
        });
        const freeBusy = await gcalCheckResp.json();
        const busySlots = freeBusy.calendars[booking.rooms.calendar_id].busy;
        const conflictingEvent = busySlots.find(slot => slot.id !== booking.calendar_event_id);

        if (conflictingEvent) {
            return new Response(JSON.stringify({ error: 'Time conflicts with a Google Calendar event.', reason: 'gcal_conflict' }), { status: 409, headers: corsHeaders });
        }
        
        // 4. Delete old calendar event if it exists
        if (booking.calendar_event_id) {
          await supabase.functions.invoke('delete-google-calendar-event', {
            body: { booking_id: booking.id }
          });
        }
        
        // 5. Create new calendar event
        const customerName = booking?.profiles?.full_name ?? "Customer";
        const customerEmail = booking?.profiles?.email ?? "";
        
        const eventBody = {
          summary: `Booking: ${booking.rooms.name} — ${customerName}`,
          description: `Booked by: ${customerName}${customerEmail ? `\nEmail: ${customerEmail}` : ""}\nBooking #${booking.id}`,
          start: { dateTime: newStartISO },
          end:   { dateTime: newEndISO },
          guestsCanInviteOthers: false,
          guestsCanSeeOtherGuests: false,
        };
        
        const createUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(booking.rooms.calendar_id)}/events?sendUpdates=none`;
        const createResp = await fetch(createUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(eventBody),
        });

        if (!createResp.ok) {
            const err = await createResp.json();
            throw new Error(`Failed to create new calendar event: ${err.error.message}`);
        }
        const newEvent = await createResp.json();

        // 6. Update booking
        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            date: date,
            start_time: newStartISO,
            end_time: newEndISO,
            duration: duration,
            calendar_event_id: newEvent.id,
          })
          .eq('id', booking_id);

        if (updateError) {
          throw new Error(`Failed to update booking: ${updateError.message}`);
        }
        
        return new Response(JSON.stringify({ ok: true, message: 'Booking rescheduled successfully.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    });