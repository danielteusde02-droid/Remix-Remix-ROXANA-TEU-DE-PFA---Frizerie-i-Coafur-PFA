/**
 * NETLIFY SERVERLESS FUNCTION: create-booking
 *
 * Endpoint: /.netlify/functions/create-booking (sau /api/create-booking via netlify.toml)
 *
 * Securitate & Funcționalitate:
 * 1. Verifică tokenul Cloudflare Turnstile primit din frontend la API-ul oficial:
 *    https://challenges.cloudflare.com/turnstile/v0/siteverify
 *    folosind cheia secretă TURNSTILE_SECRET_KEY exclusiv pe server (niciodată expusă în browser).
 * 2. Validează acțiunea ('create_booking'), vârsta tokenului (max 5 minute) și domeniul autorizat:
 *    - roxanateusdepfa.netlify.app
 *    - localhost / 127.0.0.1
 *    - domenii adăugate în TURNSTILE_ALLOWED_HOSTNAMES
 * 3. Salvează programarea în Supabase tabela `public.bookings`.
 * 4. Respinge ferm cererea cu HTTP 403 dacă tokenul este invalid, expirat sau lipsește.
 */

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export async function handler(event: any) {
  // 1. Tratează cererile CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Metoda HTTP nu este permisă. Folosiți POST.' }),
    };
  }

  try {
    // 2. Verificare configurare cheie secretă Turnstile pe server
    const turnstileSecret =
      process.env.TURNSTILE_SECRET_KEY ||
      process.env.VITE_TURNSTILE_SECRET_KEY ||
      '';

    if (!turnstileSecret) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error:
            'Cheia secretă de securitate (TURNSTILE_SECRET_KEY) nu este configurată în variabilele de mediu ale serverului (Netlify / Supabase).',
        }),
      };
    }

    // 3. Parsare payload cerere
    let body: any = null;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Format JSON invalid.' }),
      };
    }

    const turnstileToken = typeof body?.turnstileToken === 'string' ? body.turnstileToken.trim() : '';

    if (!turnstileToken || turnstileToken.length < 20) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Verificarea anti-bot (Cloudflare Turnstile) lipsește. Vă rugăm să validați provocarea de securitate.',
        }),
      };
    }

    const clientIp =
      event.headers['cf-connecting-ip'] ||
      event.headers['x-nf-client-connection-ip'] ||
      event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      '';

    // 4. Verificare server-side oficială la Cloudflare Siteverify API
    const verifyParams = new URLSearchParams();
    verifyParams.append('secret', turnstileSecret);
    verifyParams.append('response', turnstileToken);
    if (clientIp) {
      verifyParams.append('remoteip', clientIp);
    }

    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyParams.toString(),
    });

    if (!verifyResponse.ok) {
      return {
        statusCode: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Serviciul Cloudflare Turnstile nu a putut fi contactat. Vă rugăm să reîncercați.',
        }),
      };
    }

    const verifyResult = (await verifyResponse.json()) as TurnstileVerifyResponse;

    if (!verifyResult.success) {
      return {
        statusCode: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error:
            'Verificarea anti-bot (Cloudflare Turnstile) a eșuat sau tokenul a expirat. Vă rugăm să reîncercați.',
          codes: verifyResult['error-codes'] || [],
        }),
      };
    }

    // 5. Verificare acțiune (action === 'create_booking')
    if (verifyResult.action && verifyResult.action !== 'create_booking') {
      return {
        statusCode: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Acțiunea tokenului anti-bot nu corespunde formularului de programare.',
        }),
      };
    }

    // 6. Verificare vârstă token (anti-replay: maxim 5 minute)
    if (verifyResult.challenge_ts) {
      const challengeTime = new Date(verifyResult.challenge_ts).getTime();
      if (!Number.isNaN(challengeTime) && Date.now() - challengeTime > 5 * 60 * 1000) {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Tokenul anti-bot a expirat. Vă rugăm să reîncărcați verificarea.',
          }),
        };
      }
    }

    // 7. Verificare domeniu autorizat
    const hostname = verifyResult.hostname?.toLowerCase().trim() || '';
    const allowedEnv = process.env.TURNSTILE_ALLOWED_HOSTNAMES || '';
    const allowedList = [
      'roxanateusdepfa.netlify.app',
      'localhost',
      '127.0.0.1',
      ...allowedEnv.split(',').map(h => h.trim().toLowerCase()).filter(Boolean),
    ];

    const isDomainAllowed =
      !hostname ||
      allowedList.includes(hostname) ||
      hostname.endsWith('.netlify.app') ||
      hostname.endsWith('.run.app') ||
      hostname.endsWith('.webcontainer.io');

    if (!isDomainAllowed) {
      return {
        statusCode: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `Domeniul ${hostname} nu este autorizat pentru acest widget Turnstile.`,
        }),
      };
    }

    // 8. Validare date programare
    const clientName = String(body.client_name || '').trim();
    const clientPhone = String(body.client_phone || '').trim();
    const clientEmail = String(body.client_email || '').trim().toLowerCase();
    const referenceCode = String(body.reference_code || '').trim();
    const serviceName = String(body.service_name || '').trim();
    const eventDate = String(body.event_date || '').trim();
    const eventTime = String(body.event_time || '').trim();

    if (!clientName || clientName.length < 2) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Numele clientului este obligatoriu (minim 2 caractere).' }),
      };
    }

    if (!clientPhone || !eventDate || !eventTime || !referenceCode) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Datele obligatorii ale programării sunt incomplete.' }),
      };
    }

    // 9. Salvare în baza de date Supabase
    const supabaseUrl =
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      'https://pjosobviitajlnjxwbza.supabase.co';

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      'sb_publishable_SRHimk0zyqIFt1Tkb_9_iw_olt5tGHm';

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const bookingRow = {
      reference_code: referenceCode,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone,
      service_id: String(body.service_id || '').trim(),
      service_name: serviceName,
      barber_name: String(body.barber_name || 'Roxana Teușde (Buie)').trim(),
      event_date: eventDate,
      event_time: eventTime,
      location: String(body.location || 'Atelier Roxana Teusde • Str. Plopilor, Nr. 28, Tileagd').trim(),
      guests_count: typeof body.guests_count === 'number' ? body.guests_count : 1,
      estimated_total: typeof body.estimated_total === 'number' ? body.estimated_total : 70,
      deposit_amount: typeof body.deposit_amount === 'number' ? body.deposit_amount : 0,
      notes: String(body.notes || '').trim(),
      addons: body.addons && typeof body.addons === 'object' ? body.addons : {},
      status: 'in_asteptare',
      admin_notes: '',
    };

    const { data: dbData, error: dbError } = await supabase
      .from('bookings')
      .insert(bookingRow)
      .select()
      .single();

    if (dbError) {
      console.error('Eroare inserare Supabase bookings:', dbError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `Eroare la salvarea în baza de date Supabase: ${dbError.message}`,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        booking: dbData,
      }),
    };
  } catch (error: any) {
    console.error('Eroare internă server create-booking:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Eroare internă de server la procesarea programării.',
      }),
    };
  }
}
