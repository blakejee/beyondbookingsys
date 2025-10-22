import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DateTime } from 'https://esm.sh/luxon@3.4.4';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` } } }
    );

    const { 
      user_id, 
      room_id, 
      date, 
      startTime, 
      duration, 
      hirer_phone, 
      event_description, 
      attendee_count, 
      agreed_to_terms,
      company_name
    } = await req.json();

    if (!user_id || !room_id || !date || !startTime || !duration || !hirer_phone || !event_description || !attendee_count || !agreed_to_terms || !company_name) {
      throw new Error('Missing required booking details.');
    }
    
    if (agreed_to_terms !== true) {
      throw new Error('You must agree to the terms and conditions.');
    }

    const { data: room, error: roomError } = await supabaseClient
      .from('rooms')
      .select('hourly_price, currency, calendar_id')
      .eq('id', room_id)
      .single();

    if (roomError || !room) {
      throw new Error('Room not found or could not be fetched.');
    }

    const startZoned = DateTime.fromISO(`${date}T${startTime}`, { zone: 'Europe/London' });
    const endZoned = startZoned.plus({ hours: duration });
    const startISO = startZoned.toISO({ suppressMilliseconds: true });
    const endISO = endZoned.toISO({ suppressMilliseconds: true });

    const bufferStart = startZoned.minus({ minutes: 15 }).toISO();
    const bufferEnd = endZoned.plus({ minutes: 15 }).toISO();

    const { data: dbBookings, error: dbError } = await supabaseClient
      .from('bookings')
      .select('id')
      .eq('room_id', room_id)
      .in('status', ['pending', 'confirmed'])
      .lt('start_time', bufferEnd)
      .gt('end_time', bufferStart);
      
    if (dbError) throw new Error(`Database check failed: ${dbError.message}`);
    if (dbBookings.length > 0) throw new Error('This time slot is already booked.');
    
    const total_price = room.hourly_price * duration;
    
    // Update profile with company name
    await supabaseClient.from('profiles').update({ company_name: company_name }).eq('id', user_id);

    const { data: newBooking, error: insertError } = await supabaseClient
      .from('bookings')
      .insert({
        user_id,
        room_id,
        date,
        start_time: startISO,
        end_time: endISO,
        duration,
        total_price,
        currency: room.currency,
        status: 'pending',
        hirer_phone,
        event_description,
        attendee_count,
        agreed_to_terms,
      })
      .select('id')
      .single();

    if (insertError) throw new Error(`Could not create booking: ${insertError.message}`);

    return new Response(JSON.stringify({ booking_id: newBooking.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});