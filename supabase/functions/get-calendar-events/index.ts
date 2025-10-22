import { corsHeaders } from "./cors.ts";
async function getAccessToken(credentials) {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const privateKeyPEM = credentials.private_key.replace(/\\n/g, '\n');
  const privateKey = atob(privateKeyPEM.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, ''));
  const keyBuffer = new Uint8Array(privateKey.length).map((_, i)=>privateKey.charCodeAt(i)).buffer;
  const key = await crypto.subtle.importKey("pkcs8", keyBuffer, {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsignedToken));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const jwt = `${unsignedToken}.${encodedSignature}`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { calendarId, timeMin, timeMax } = await req.json();
    if (!calendarId || !timeMin || !timeMax) {
      throw new Error('Missing required parameters');
    }
    const googleCreds = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS') || '{}');
    const accessToken = await getAccessToken(googleCreds);
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('fields', 'items(start,end)');
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google API Error: ${response.status} ${errorBody}`);
    }
    const data = await response.json();
    const busySlots = (data.items || []).map((event)=>({
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date
      }));
    return new Response(JSON.stringify({
      busySlots
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
