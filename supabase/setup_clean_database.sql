-- ==============================================================================
-- ROXANA TEUȘDE PFA (BUIE) - CONFIGURARE BAZĂ DE DATE SUPABASE (CURATĂ & FĂRĂ ERORI)
-- Execută acest script în Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABELA PROGRAMĂRI (bookings)
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  service_id TEXT,
  service_name TEXT NOT NULL,
  barber_name TEXT DEFAULT 'Roxana Teușde (Buie)',
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL,
  location TEXT,
  guests_count INTEGER DEFAULT 1,
  estimated_total NUMERIC DEFAULT 70,
  deposit_amount NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  addons JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'in_asteptare',
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activează securitatea la nivel de rând (Row Level Security)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Permite clienților de pe site să trimită programări
DROP POLICY IF EXISTS "anon_insert_bookings" ON public.bookings;
CREATE POLICY "anon_insert_bookings"
  ON public.bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Permite citirea programărilor pentru calendar și verificări
DROP POLICY IF EXISTS "allow_read_bookings" ON public.bookings;
CREATE POLICY "allow_read_bookings"
  ON public.bookings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Permite actualizarea statusului programărilor (confirmare, anulare)
DROP POLICY IF EXISTS "allow_update_bookings" ON public.bookings;
CREATE POLICY "allow_update_bookings"
  ON public.bookings
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 2. TABELA SETĂRI SITE (public_site_settings)
CREATE TABLE IF NOT EXISTS public.public_site_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  site_images JSONB DEFAULT '{}'::jsonb,
  gallery_settings JSONB DEFAULT '{}'::jsonb,
  services_settings JSONB DEFAULT '{}'::jsonb,
  hours_weekday TEXT DEFAULT '09:00 - 16:00',
  hours_saturday TEXT DEFAULT '09:00 - 13:00',
  hours_sunday TEXT DEFAULT 'Închis',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.public_site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_read_settings" ON public.public_site_settings;
CREATE POLICY "allow_read_settings"
  ON public.public_site_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "allow_all_settings" ON public.public_site_settings;
CREATE POLICY "allow_all_settings"
  ON public.public_site_settings
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Inserează înregistrarea inițială de setări dacă nu există
INSERT INTO public.public_site_settings (id)
VALUES ('current')
ON CONFLICT (id) DO NOTHING;

-- Acordă permisiuni de citire/scriere către rolurile anonim și autentificat
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.bookings TO anon, authenticated;
GRANT ALL ON TABLE public.public_site_settings TO anon, authenticated;

-- Notifică PostgREST să reîncarce schema cache instantaneu
NOTIFY pgrst, 'reload schema';
