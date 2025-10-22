import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DateTime } from 'https://esm.sh/luxon@3.5.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
async function getGoogleAccessToken(credentials) {
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
const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { booking_id, date, startTime, duration } = await req.json();
    if (!booking_id || !date || !startTime || !duration) {
      return new Response(JSON.stringify({
        error: 'booking_id, date, startTime, duration required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    // 1) Fetch original booking (+ room + profile)
    const { data: booking, error: fetchError } = await supabase.from('bookings').select('*, rooms(*), profiles(*)').eq('id', booking_id).single();
    if (fetchError || !booking) throw new Error('Booking not found');
    // 2) Build NEW times as Europe/London wall clock, then convert to UTC for storage/checks
    const startLondon = DateTime.fromISO(`${date}T${startTime}`, {
      zone: 'Europe/London'
    });
    if (!startLondon.isValid) throw new Error('Invalid date/startTime');
    const endLondon = startLondon.plus({
      hours: Number(duration)
    });
    // 15 min buffers
    const bufferStartLondon = startLondon.minus({
      minutes: 15
    });
    const bufferEndLondon = endLondon.plus({
      minutes: 15
    });
    // UTC instants
    const startUTC = startLondon.toUTC().toISO();
    const endUTC = endLondon.toUTC().toISO();
    const bufStartUTC = bufferStartLondon.toUTC().toISO();
    const bufEndUTC = bufferEndLondon.toUTC().toISO();
    // 3) DB conflict check (excluding this booking)
    const { data: dbConflicts, error: dbErr } = await supabase.from('bookings').select('id,start_time,end_time').eq('room_id', booking.room_id).neq('id', booking_id).lt('start_time', bufEndUTC).gt('end_time', bufStartUTC);
    if (dbErr) throw new Error(`DB conflict check failed: ${dbErr.message}`);
    if ((dbConflicts ?? []).length > 0) {
      return new Response(JSON.stringify({
        error: 'The selected time conflicts with another booking.',
        reason: 'db_conflict'
      }), {
        status: 409,
        headers: corsHeaders
      });
    }
    // 4) Google free/busy conflict (using UTC instants)
    const googleCreds = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS') || '{}');
    const token = await getGoogleAccessToken(googleCreds);
    const gcalCheckUrl = `https://www.googleapis.com/calendar/v3/freeBusy`;
    const gcalResp = await fetch(gcalCheckUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timeMin: bufStartUTC,
        timeMax: bufEndUTC,
        items: [
          {
            id: booking.rooms.calendar_id
          }
        ]
      })
    });
    if (!gcalResp.ok) throw new Error(`Google freeBusy failed: ${await gcalResp.text()}`);
    const freeBusy = await gcalResp.json();
    const busy = freeBusy?.calendars?.[booking.rooms.calendar_id]?.busy ?? [];
    // NOTE: freeBusy does NOT include event IDs; if any busy block exists, treat as conflict
    if (busy.length > 0) {
      return new Response(JSON.stringify({
        error: 'Time conflicts with a Google Calendar event.',
        reason: 'gcal_conflict'
      }), {
        status: 409,
        headers: corsHeaders
      });
    }
    // 5) Delete old calendar event (if any)
    if (booking.calendar_event_id) {
      await supabase.functions.invoke('delete-google-calendar-event', {
        body: {
          booking_id: booking.id
        }
      });
    }
    // 6) Create NEW Google Calendar event with local wall clock + timeZone (no "Z")
    const customerName = booking?.profiles?.full_name ?? 'Customer';
    const customerEmail = booking?.profiles?.email ?? '';
    // local strings without Z
    const startLocalStr = startLondon.toFormat("yyyy-LL-dd'T'HH:mm:ss");
    const endLocalStr = endLondon.toFormat("yyyy-LL-dd'T'HH:mm:ss");
    const eventBody = {
      summary: `Booking: ${booking.rooms.name} — ${customerName}`,
      description: `Booked by: ${customerName}${customerEmail ? `\nEmail: ${customerEmail}` : ''}\nBooking #${booking.id}`,
      start: {
        dateTime: startLocalStr,
        timeZone: 'Europe/London'
      },
      end: {
        dateTime: endLocalStr,
        timeZone: 'Europe/London'
      },
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: false
    };
    const createUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(booking.rooms.calendar_id)}/events?sendUpdates=none`;
    const createResp = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventBody)
    });
    if (!createResp.ok) {
      const err = await createResp.text();
      throw new Error(`Failed to create new calendar event: ${err}`);
    }
    const newEvent = await createResp.json();
    // 7) Update booking record with NEW UTC instants
    const { error: updateError } = await supabase.from('bookings').update({
      date,
      start_time: startUTC,
      end_time: endUTC,
      duration: Number(duration),
      calendar_event_id: newEvent.id
    }).eq('id', booking_id);
    if (updateError) throw new Error(`Failed to update booking: ${updateError.message}`);
    return new Response(JSON.stringify({
      ok: true,
      message: 'Booking rescheduled successfully.'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
