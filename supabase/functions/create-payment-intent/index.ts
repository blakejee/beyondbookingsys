import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';
import { corsHeaders } from './cors.ts';
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient()
});
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
    const { booking_id } = await req.json();
    if (!booking_id) throw new Error('Booking ID is required.');
    const { data: booking, error: bookingError } = await supabaseClient.from('bookings').select('total_price, currency, payment_intent_id').eq('id', booking_id).single();
    if (bookingError || !booking) throw new Error('Booking not found.');
    const amount = Math.round(booking.total_price * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: booking.currency || 'gbp',
      metadata: {
        booking_id
      }
    });
    const { error: updateError } = await supabaseClient.from('bookings').update({
      payment_intent_id: paymentIntent.id
    }).eq('id', booking_id);
    if (updateError) throw new Error(`Failed to update booking with Payment Intent ID: ${updateError.message}`);
    return new Response(JSON.stringify({
      clientSecret: paymentIntent.client_secret
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
