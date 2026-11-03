import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

function apiServerPlugin(): Plugin {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      server.middlewares.use('/api/create-booking', async (req, res) => {
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
          res.end(JSON.stringify({ success: false, error: 'Metoda HTTP nu este permisă. Folosiți POST.' }));
          return;
        }

        let rawBody = '';
        req.on('data', chunk => {
          rawBody += chunk;
        });

        req.on('end', async () => {
          try {
            const body = JSON.parse(rawBody || '{}');
            const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || '';

            if (!turnstileSecret) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'Cheia secretă de securitate (TURNSTILE_SECRET_KEY) nu este configurată în fișierul .env.',
                })
              );
              return;
            }

            const turnstileToken =
              typeof body?.turnstileToken === 'string' ? body.turnstileToken.trim() : '';

            if (!turnstileToken || turnstileToken.length < 20) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'Verificarea anti-bot (Cloudflare Turnstile) lipsește. Vă rugăm să validați provocarea de securitate.',
                })
              );
              return;
            }

            // Apel oficial către API-ul Cloudflare Siteverify cu cheia secretă de pe server
            const verifyParams = new URLSearchParams();
            verifyParams.append('secret', turnstileSecret);
            verifyParams.append('response', turnstileToken);

            const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: verifyParams.toString(),
            });

            const verifyResult = (await verifyRes.json()) as any;

            if (!verifyResult.success) {
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

            // Inserare în baza de date Supabase tabela bookings
            const supabaseUrl =
              process.env.VITE_SUPABASE_URL || 'https://pjosobviitajlnjxwbza.supabase.co';
            const supabaseKey =
              process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_SRHimk0zyqIFt1Tkb_9_iw_olt5tGHm';

            const supabase = createClient(supabaseUrl, supabaseKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            });

            const bookingRow = {
              reference_code: body.reference_code,
              client_name: body.client_name,
              client_email: body.client_email,
              client_phone: body.client_phone,
              service_id: body.service_id,
              service_name: body.service_name,
              barber_name: body.barber_name || 'Roxana Teușde (Buie)',
              event_date: body.event_date,
              event_time: body.event_time,
              location: body.location || 'Atelier Roxana Teusde • Str. Plopilor, Nr. 28, Tileagd',
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
            res.end(JSON.stringify({ success: false, error: err.message || 'Eroare internă server.' }));
          }
        });
      });
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
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
