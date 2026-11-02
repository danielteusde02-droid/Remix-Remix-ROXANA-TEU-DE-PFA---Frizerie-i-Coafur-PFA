/**
 * SUPABASE EDGE FUNCTION: create-booking-turnstile
 *
 * Scop:
 * 1. Primește cererea de programare din formularul public + tokenul Cloudflare Turnstile.
 * 2. Verifică tokenul Turnstile exclusiv server-side la https://challenges.cloudflare.com/turnstile/v0/siteverify
 *    folosind secretul TURNSTILE_SECRET_KEY din Supabase Secrets (niciodată expus în frontend).
 * 3. Validează suplimentar:
 *    - domeniul autorizat (hostname)
 *    - acțiunea așteptată (action === 'create_booking')
 *    - vârsta/expirarea tokenului (challenge_ts <= 5 minute)
 * 4. Apelează procedura atomică PostgreSQL `public.create_public_booking_with_turnstile`
 *    folosind SUPABASE_SERVICE_ROLE_KEY, legând strict hash-ul SHA-256 al tokenului Turnstile
 *    de `reference_code`-ul cererii curente în aceeași tranzacție cu triggerul
 *    `public.validate_and_compute_booking()`.
 */

// @ts-ignore: Deno URL import in Supabase Edge Runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function isHostnameAuthorized(
  verifiedHostname: string | undefined,
  allowedHostnamesEnv: string | undefined,
  originHeader: string | null
): boolean {
  if (!verifiedHostname || typeof verifiedHostname !== 'string') {
    return false;
  }
  const normalizedHost = verifiedHostname.trim().toLowerCase();
  if (!normalizedHost) return false;

  // 1. Dacă TURNSTILE_ALLOWED_HOSTNAMES este configurat în Supabase Secrets, verificăm strict lista
  if (allowedHostnamesEnv && allowedHostnamesEnv.trim().length > 0) {
    const allowedList = allowedHostnamesEnv
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    if (allowedList.length > 0) {
      return allowedList.includes(normalizedHost);
    }
  }

  // 2. Dacă există headerul Origin, verificăm concordanța cu hostname-ul raportat de Cloudflare
  if (originHeader) {
    try {
      const originHost = new URL(originHeader).hostname.trim().toLowerCase();
      if (originHost && originHost !== normalizedHost) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Metoda HTTP nu este permisă.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const allowedHostnamesEnv = Deno.env.get('TURNSTILE_ALLOWED_HOSTNAMES');

    if (!turnstileSecret || !supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configurația de securitate server-side (TURNSTILE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY) este incompletă.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ success: false, error: 'Payload JSON invalid.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const turnstileToken =
      typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';

    if (!turnstileToken || turnstileToken.length < 20 || turnstileToken.length > 2048) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Verificarea anti-bot (Cloudflare Turnstile) lipsește sau este invalidă.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientIp =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      '';

    // 1. Verificare server-side a tokenului Cloudflare Turnstile
    const formData = new URLSearchParams();
    formData.append('secret', turnstileSecret);
    formData.append('response', turnstileToken);
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const verifyRes = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      }
    );

    if (!verifyRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Serviciul de verificare anti-bot nu a putut fi contactat. Vă rugăm să reîncercați.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const verifyResult = (await verifyRes.json()) as TurnstileVerifyResponse;

    if (!verifyResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Verificarea anti-bot (Cloudflare Turnstile) a eșuat sau a expirat. Vă rugăm să reîncercați.',
          codes: verifyResult['error-codes'] || [],
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verificare acțiune așteptată (action === 'create_booking')
    if (verifyResult.action && verifyResult.action !== 'create_booking') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Acțiunea tokenului anti-bot (Cloudflare Turnstile) nu corespunde formularului de programări.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Verificare domeniu autorizat (hostname)
    const originHeader = req.headers.get('origin');
    if (!isHostnameAuthorized(verifyResult.hostname, allowedHostnamesEnv, originHeader)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Domeniul de pe care a fost generat tokenul Turnstile nu este autorizat.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Verificare suplimentară că tokenul nu este mai vechi de 5 minute (anti-replay)
    if (verifyResult.challenge_ts) {
      const challengeTime = new Date(verifyResult.challenge_ts).getTime();
      if (!Number.isNaN(challengeTime) && Date.now() - challengeTime > 5 * 60 * 1000) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Tokenul anti-bot a expirat. Vă rugăm să bifați din nou verificarea de securitate.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const referenceCode = String(body.reference_code || '').trim();
    if (!referenceCode || referenceCode.length < 6 || referenceCode.length > 32) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Codul de referință al programării lipsește sau este invalid.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Apel atomic în baza de date (leagă token_hash de reference_code și inserează programarea în aceeași tranzacție)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tokenHash = await sha256Hex(turnstileToken);

    const { data, error } = await supabaseAdmin.rpc('create_public_booking_with_turnstile', {
      p_token_hash: tokenHash,
      p_client_ip: clientIp || 'unknown',
      p_reference_code: referenceCode,
      p_client_name: String(body.client_name || '').trim(),
      p_client_email: String(body.client_email || '').trim().toLowerCase(),
      p_client_phone: String(body.client_phone || '').trim(),
      p_service_id: String(body.service_id || '').trim(),
      p_service_name: String(body.service_name || '').trim(),
      p_barber_name: String(body.barber_name || 'Roxana Teușde (Buie)').trim(),
      p_event_date: String(body.event_date || '').trim(),
      p_event_time: String(body.event_time || '').trim(),
      p_location: String(body.location || 'Atelier Tileagd').trim(),
      p_notes: String(body.notes || '').trim(),
      p_addons: body.addons && typeof body.addons === 'object' ? body.addons : {},
    });

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Programarea nu a putut fi salvată.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        booking: data,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Eroare internă la procesarea programării.';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
