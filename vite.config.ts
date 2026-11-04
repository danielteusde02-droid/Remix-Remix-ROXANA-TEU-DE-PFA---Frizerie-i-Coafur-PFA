import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const EXPECTED_ACTION = 'create_booking';
const PRIMARY_AUTHORIZED_HOSTNAME = 'roxanateusdepfa.netlify.app';

function apiServerPlugin(): Plugin {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      const handleBookingRequest = async (req: any, res: any) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          });
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              error: 'Metoda HTTP nu este permisă. Folosiți POST.',
            })
          );
          return;
        }

        let rawBody = '';
        req.on('data', (chunk: any) => {
          rawBody += chunk;
        });

        req.on('end', async () => {
          try {
            const body = JSON.parse(rawBody || '{}');
            const turnstileSecret = (process.env.TURNSTILE_SECRET_KEY || '').trim();

            if (!turnstileSecret) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'Cheia secretă de securitate (TURNSTILE_SECRET_KEY) nu este configurată în mediul serverului.',
                })
              );
              return;
            }

            const rawToken =
              typeof body?.turnstileToken === 'string'
                ? body.turnstileToken
                : typeof body?.['cf-turnstile-response'] === 'string'
                ? body['cf-turnstile-response']
                : '';
            const turnstileToken = rawToken.trim();

            if (!turnstileToken || turnstileToken.length < 20 || turnstileToken.length > 2048) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'Verificarea anti-bot (Cloudflare Turnstile) lipsește sau este invalidă. Vă rugăm să validați provocarea de securitate.',
                })
              );
              return;
            }

            // Apel oficial către API-ul Cloudflare Siteverify cu cheia secretă de pe server
            const verifyParams = new URLSearchParams();
            verifyParams.append('secret', turnstileSecret);
            verifyParams.append('response', turnstileToken);

            const verifyRes = await fetch(
              'https://challenges.cloudflare.com/turnstile/v0/siteverify',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                signal: AbortSignal.timeout(10000),
                body: verifyParams.toString(),
              }
            );

            if (!verifyRes.ok) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'Serviciul Cloudflare Turnstile Siteverify nu a putut fi contactat. Vă rugăm să reîncercați.',
                })
              );
              return;
            }

            const verifyResult = (await verifyRes.json()) as any;

            if (verifyResult.success !== true) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'Verificarea anti-bot (Cloudflare Turnstile) a eșuat sau tokenul a expirat. Vă rugăm să reîncercați.',
                  codes: verifyResult['error-codes'] || [],
                })
              );
              return;
            }

            if (verifyResult.action !== EXPECTED_ACTION) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error: `Acțiunea tokenului anti-bot (${verifyResult.action || 'lipsă'}) nu corespunde acțiunii așteptate (${EXPECTED_ACTION}).`,
                })
              );
              return;
            }

            const verifiedHostname = (verifyResult.hostname || '').toLowerCase().trim();
            const extraAllowedHostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || '')
              .split(',')
              .map(h => h.trim().toLowerCase())
              .filter(Boolean);
            const expectedHostnames = new Set<string>([
              PRIMARY_AUTHORIZED_HOSTNAME,
              'localhost',
              '127.0.0.1',
              ...extraAllowedHostnames,
            ]);

            if (!verifiedHostname || !expectedHostnames.has(verifiedHostname)) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error: `Domeniul raportat (${verifiedHostname || 'necunoscut'}) nu corespunde domeniului autorizat (${PRIMARY_AUTHORIZED_HOSTNAME}).`,
                })
              );
              return;
            }

            // Inserare în baza de date Supabase tabela bookings
            const rawSupabaseUrl =
              process.env.VITE_SUPABASE_URL || 'https://pjosobviitajlnjxwbza.supabase.co';
            let supabaseUrl = 'https://pjosobviitajlnjxwbza.supabase.co';
            try {
              supabaseUrl = new URL(rawSupabaseUrl.trim()).origin;
            } catch {
              supabaseUrl = rawSupabaseUrl.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
            }
            const supabaseKey =
              process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_SRHimk0zyqIFt1Tkb_9_iw_olt5tGHm';

            const supabase = createClient(supabaseUrl, supabaseKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            });

            const barberName = body.barber_name || 'Roxana Teușde (Buie)';

            const { data: existingDuplicate } = await supabase
              .from('bookings')
              .select('id, reference_code')
              .eq('event_date', body.event_date)
              .eq('event_time', body.event_time)
              .eq('barber_name', barberName)
              .in('status', ['in_asteptare', 'confirmat'])
              .limit(1)
              .maybeSingle();

            if (existingDuplicate) {
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'Acest interval orar tocmai a fost rezervat. Vă rugăm să alegeți o altă oră disponibilă.',
                })
              );
              return;
            }

            const bookingRow = {
              reference_code: body.reference_code,
              client_name: body.client_name,
              client_email: body.client_email,
              client_phone: body.client_phone,
              service_id: body.service_id,
              service_name: body.service_name,
              barber_name: barberName,
              event_date: body.event_date,
              event_time: body.event_time,
              location:
                body.location || 'Atelier Roxana Teusde • Str. Plopilor, Nr. 28, Tileagd',
              guests_count: typeof body.guests_count === 'number' ? body.guests_count : 1,
              estimated_total: typeof body.estimated_total === 'number' ? body.estimated_total : 70,
              deposit_amount: typeof body.deposit_amount === 'number' ? body.deposit_amount : 0,
              notes: body.notes || '',
              addons: body.addons || {},
              status: 'in_asteptare',
              admin_notes: '',
            };

            const { data: dbData, error: dbError } = await supabase
              .from('bookings')
              .insert(bookingRow)
              .select()
              .single();

            if (dbError) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error: `Eroare salvare Supabase: ${dbError.message}`,
                })
              );
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, booking: dbData }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                error: err.message || 'Eroare internă server.',
              })
            );
          }
        });
      };

      server.middlewares.use('/.netlify/functions/create-booking', handleBookingRequest);
      server.middlewares.use('/api/create-booking', handleBookingRequest);
    },
  };
}

const ACTIVE_TURNSTILE_SITE_KEY = '0x4AAAAAAFy_iG_g6jNTFe-I';
const DEPRECATED_SITE_KEYS = new Set([
  '0x4AAAAAAFwOexYPqmzq_p4n',
  '0x4AAAAAAAFxuvMnfQmIDu7nE',
  '0x4AAAAAAFxuvMnfQmIDu7nE',
]);

if (
  !process.env.VITE_TURNSTILE_SITE_KEY ||
  DEPRECATED_SITE_KEYS.has(process.env.VITE_TURNSTILE_SITE_KEY.trim())
) {
  process.env.VITE_TURNSTILE_SITE_KEY = ACTIVE_TURNSTILE_SITE_KEY;
}

export default defineConfig(() => {
  return {
    base: './',
    define: {
      'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(
        process.env.VITE_TURNSTILE_SITE_KEY || ACTIVE_TURNSTILE_SITE_KEY
      ),
    },
    plugins: [react(), tailwindcss(), apiServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
