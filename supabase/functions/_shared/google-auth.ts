import { decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

async function createJwt(email, privateKey, scope) {
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: email,
        scope: scope,
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
    };

    const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signingInputBytes = new TextEncoder().encode(signingInput);
    
    const pem = privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\n/g, '');
    const binaryDer = decode(pem);

    const key = await crypto.subtle.importKey(
        'pkcs8',
        binaryDer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, signingInputBytes);
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    return `${signingInput}.${encodedSignature}`;
}

export async function getGoogleAccessToken(credentials, scope) {
    if (!credentials.client_email || !credentials.private_key) {
        throw new Error('Google credentials missing client_email or private_key');
    }

    const jwt = await createJwt(credentials.client_email, credentials.private_key, scope);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });

    if (!tokenResponse.ok) {
        throw new Error(`Google token fetch failed: ${await tokenResponse.text()}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
}