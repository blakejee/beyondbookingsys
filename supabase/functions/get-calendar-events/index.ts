import { corsHeaders } from "../_shared/cors.ts";
import { getGoogleAccessToken } from "../_shared/google-auth.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { calendarId, timeMin, timeMax } = await req.json();

    if (!calendarId || !timeMin || !timeMax) {
      throw new Error('Missing required parameters: calendarId, timeMin, and timeMax are required.');
    }

    const googleCredsString = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS');
    if (!googleCredsString) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS environment variable not set.");
    }
    const googleCreds = JSON.parse(googleCredsString);
    const accessToken = await getGoogleAccessToken(googleCreds, 'https://www.googleapis.com/auth/calendar.readonly');

    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('fields', 'items(start,end)');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Google API Error: ${response.status} ${errorBody}`);
    }

    const data = await response.json();
    
    const busySlots = (data.items || []).map((event) => ({
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
    }));

    return new Response(
      JSON.stringify({ busySlots }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in get-calendar-events:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});