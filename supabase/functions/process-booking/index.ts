import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DateTime } from 'https://esm.sh/luxon@3.5.0';
import { corsHeaders } from './cors.ts';
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      global: {
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        }
      }
    });
    const { user_id, room_id, date, startTime, duration } = await req.json();
    if (!user_id || !room_id || !date || !startTime || !duration) {
      throw new Error('Missing required booking details.');
    }
    // 1) Fetch room pricing/currency
    const { data: room, error: roomError } = await supabaseClient.from('rooms').select('hourly_price, currency, calendar_id').eq('id', room_id).single();
    if (roomError || !room) throw new Error('Room not found or could not be fetched.');
    // 2) Build times in *Europe/London* (wall clock), then convert to UTC for storage
    const startLondon = DateTime.fromISO(`${date}T${startTime}`, {
      zone: 'Europe/London'
    });
    if (!startLondon.isValid) throw new Error('Invalid date/startTime.');
    const endLondon = startLondon.plus({
      hours: Number(duration)
    });
    // 15-minute buffer either side
    const bufferStartLondon = startLondon.minus({
      minutes: 15
    });
    const bufferEndLondon = endLondon.plus({
      minutes: 15
    });
    // Convert to UTC instants for DB and overlap checks
    const startUTC = startLondon.toUTC().toISO(); // e.g. 2025-10-21T15:00:00Z
    const endUTC = endLondon.toUTC().toISO();
    const bufStartUTC = bufferStartLondon.toUTC().toISO();
    const bufEndUTC = bufferEndLondon.toUTC().toISO();
    // 3) Check conflicts in DB (pending/confirmed) with buffer
    const { data: dbBookings, error: dbError } = await supabaseClient.from('bookings').select('id').eq('room_id', room_id).in('status', [
      'pending',
      'confirmed'
    ]).lt('start_time', bufEndUTC).gt('end_time', bufStartUTC);
    if (dbError) throw new Error(`Database check failed: ${dbError.message}`);
    if ((dbBookings ?? []).length > 0) throw new Error('This time slot is already booked.');
    // 4) Price calc
    const total_price = Number(room.hourly_price) * Number(duration);
    // 5) Insert booking (store UTC instants; keep date field as provided)
    const { data: newBooking, error: insertError } = await supabaseClient.from('bookings').insert({
      user_id,
      room_id,
      date,
      start_time: startUTC,
      end_time: endUTC,
      duration: Number(duration),
      total_price,
      currency: room.currency,
      status: 'pending'
    }).select('id').single();
    if (insertError) throw new Error(`Could not create booking: ${insertError.message}`);
    return new Response(JSON.stringify({
      booking_id: newBooking.id
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
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
