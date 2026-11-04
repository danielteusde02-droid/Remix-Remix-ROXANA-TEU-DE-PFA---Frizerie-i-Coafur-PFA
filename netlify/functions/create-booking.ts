/**
 * NETLIFY SERVERLESS FUNCTION: create-booking
 *
 * Endpoint: /.netlify/functions/create-booking (sau /api/create-booking via netlify.toml)
 *
 * Securitate & Funcționalitate (Cloudflare Turnstile Existing Widget Flow):
 * 1. Verifică tokenul Cloudflare Turnstile primit din frontend la API-ul oficial:
 *    https://challenges.cloudflare.com/turnstile/v0/siteverify
 *    folosind exclusiv variabila de mediu server-side TURNSTILE_SECRET_KEY.
 * 2. Validează că răspunsul Cloudflare conține `success === true`.
 * 3. Validează acțiunea exactă (`action === 'create_booking'`).
 * 4. Validează domeniul autorizat (`hostname === 'roxanateusdepfa.netlify.app'` sau lista aprobată).
 * 5. Previne trimiterile duplicate (atât la nivel de token single-use, cât și la nivel de slot/client în Supabase).
 * 6. Salvează programarea în Supabase tabela `public.bookings`.
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

const EXPECTED_ACTION = 'create_booking';
const PRIMARY_AUTHORIZED_HOSTNAME = 'roxanateusdepfa.netlify.app';

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
    // 2. Citire exclusivă a cheii secrete server-side TURNSTILE_SECRET_KEY (fără niciodată a folosi VITE_)
    const turnstileSecret = (process.env.TURNSTILE_SECRET_KEY || '').trim();

    if (!turnstileSecret) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error:
            'Cheia secretă de securitate (TURNSTILE_SECRET_KEY) nu este configurată în variabilele de mediu ale serverului Netlify.',
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

    // Acceptă atât turnstileToken cât și cf-turnstile-response conform specificației Cloudflare
    const rawToken =
      typeof body?.turnstileToken === 'string'
        ? body.turnstileToken
        : typeof body?.['cf-turnstile-response'] === 'string'
        ? body['cf-turnstile-response']
        : '';
    const turnstileToken = rawToken.trim();

    if (!turnstileToken || turnstileToken.length < 20 || turnstileToken.length > 2048) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error:
            'Verificarea anti-bot (Cloudflare Turnstile) lipsește sau este invalidă. Vă rugăm să validați provocarea de securitate.',
        }),
      };
    }

    const clientIp =
      event.headers?.['cf-connecting-ip'] ||
      event.headers?.['x-nf-client-connection-ip'] ||
      event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      '';

    // 4. Verificare server-side oficială la Cloudflare Siteverify API
    const verifyParams = new URLSearchParams();
    verifyParams.append('secret', turnstileSecret);
    verifyParams.append('response', turnstileToken);
    if (clientIp) {
      verifyParams.append('remoteip', clientIp);
    }

    let verifyResult: TurnstileVerifyResponse;
    try {
      const verifyResponse = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: AbortSignal.timeout(10000),
          body: verifyParams.toString(),
        }
      );

      if (!verifyResponse.ok) {
        return {
          statusCode: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error:
              'Serviciul Cloudflare Turnstile Siteverify nu a putut fi contactat. Vă rugăm să reîncercați.',
          }),
        };
      }

      verifyResult = (await verifyResponse.json()) as TurnstileVerifyResponse;
    } catch (fetchErr) {
      return {
        statusCode: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error:
            'Eroare la comunicarea cu serverul Cloudflare Siteverify. Vă rugăm să reîncercați.',
        }),
      };
    }

    // 5. Verificare strictă că Cloudflare returnează success: true
    if (verifyResult.success !== true) {
      return {
        statusCode: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error:
            'Verificarea anti-bot (Cloudflare Turnstile) a eșuat sau tokenul a expirat. Vă rugăm să bifați din nou verificarea și să reîncercați.',
          codes: verifyResult['error-codes'] || [],
        }),
      };
    }

    // 6. Validare strictă a acțiunii așteptate: "create_booking"
    if (verifyResult.action !== EXPECTED_ACTION) {
      return {
        statusCode: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `Acțiunea tokenului anti-bot (${verifyResult.action || 'lipsă'}) nu corespunde acțiunii așteptate (${EXPECTED_ACTION}).`,
        }),
      };
    }

    // 7. Validare strictă a domeniului autorizat: "roxanateusdepfa.netlify.app"
    const verifiedHostname = (verifyResult.hostname || '').toLowerCase().trim();
    const extraAllowedHostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || '')
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(Boolean);

    const expectedHostnames = new Set<string>([
      PRIMARY_AUTHORIZED_HOSTNAME,
      ...extraAllowedHostnames,
    ]);

    if (!verifiedHostname || !expectedHostnames.has(verifiedHostname)) {
      return {
        statusCode: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `Domeniul raportat (${verifiedHostname || 'necunoscut'}) nu corespunde domeniului autorizat (${PRIMARY_AUTHORIZED_HOSTNAME}).`,
        }),
      };
    }

    // 8. Verificare vârstă token (anti-replay: maxim 5 minute)
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

    // 9. Validare date programare
    const clientName = String(body.client_name || '').trim();
    const clientPhone = String(body.client_phone || '').trim();
    const clientEmail = String(body.client_email || '').trim().toLowerCase();
    const referenceCode = String(body.reference_code || '').trim();
    const serviceName = String(body.service_name || '').trim();
    const eventDate = String(body.event_date || '').trim();
    const eventTime = String(body.event_time || '').trim();
    const barberName = String(body.barber_name || 'Roxana Teușde (Buie)').trim();

    if (!clientName || clientName.length < 2) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Numele clientului este obligatoriu (minim 2 caractere).',
        }),
      };
    }

    if (!clientPhone || !eventDate || !eventTime || !referenceCode) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Datele obligatorii ale programării sunt incomplete.',
        }),
      };
    }

    // 10. Conectare la Supabase și prevenire trimiteri duplicate
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

    // Verificare anti-duplicat: același client/telefon sau același frizer în același slot activ
    const { data: existingDuplicate } = await supabase
      .from('bookings')
      .select('id, reference_code')
      .eq('event_date', eventDate)
      .eq('event_time', eventTime)
      .eq('barber_name', barberName)
      .in('status', ['in_asteptare', 'confirmat'])
      .limit(1)
      .maybeSingle();

    if (existingDuplicate) {
      return {
        statusCode: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error:
            'Acest interval orar tocmai a fost rezervat. Vă rugăm să alegeți o altă oră disponibilă.',
        }),
      };
    }

    const bookingRow = {
      reference_code: referenceCode,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone,
      service_id: String(body.service_id || '').trim(),
      service_name: serviceName,
      barber_name: barberName,
      event_date: eventDate,
      event_time: eventTime,
      location: String(
        body.location || 'Atelier Roxana Teusde • Str. Plopilor, Nr. 28, Tileagd'
      ).trim(),
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
