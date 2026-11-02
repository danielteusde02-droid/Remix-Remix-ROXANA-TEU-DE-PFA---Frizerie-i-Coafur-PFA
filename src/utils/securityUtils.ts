/**
 * Supabase Schema, Security and RLS (Row Level Security) generator
 * for ROXANA TEUSDE PFA (BUIE) database
 */

export interface SecurityPolicySummary {
  tableName: string;
  rlsEnabled: boolean;
  publicSelect: boolean;
  publicInsert: boolean;
  adminUpdate: boolean;
  adminDelete: boolean;
  description: string;
}

export function isValidSupabaseUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' && parsed.hostname.includes('.supabase.co');
  } catch {
    return false;
  }
}

/**
 * Validates Supabase public / anon key.
 * Accepts both:
 * 1. New Supabase publishable keys: `sb_publishable_...`
 * 2. Legacy Supabase anon JWT keys: `eyJ...` (3 dot-separated base64url segments)
 * Explicitly rejects secret / service_role keys (`sb_secret_...`).
 */
export function isValidSupabaseKey(key: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();

  // Never allow secret or service_role keys in frontend
  if (trimmed.startsWith('sb_secret_') || trimmed.includes('service_role')) {
    return false;
  }

  // New Supabase publishable key format
  if (trimmed.startsWith('sb_publishable_')) {
    return trimmed.length >= 20;
  }

  // Legacy JWT anon key format (header.payload.signature)
  const parts = trimmed.split('.');
  return parts.length === 3 && parts[0].length > 10;
}

export function getSecurityAudit(): SecurityPolicySummary[] {
  return [
    {
      tableName: 'bookings',
      rlsEnabled: true,
      publicSelect: false,
      publicInsert: false, // Inserarea directă din browser (anon) este blocată; programările publice trec exclusiv prin Edge Function 'create-booking-turnstile' -> RPC atomică 'create_public_booking_with_turnstile'
      adminUpdate: true, // Doar administratorul verificat prin public.is_admin() poate confirma/anula/modifica (verificat și la UPDATE de trigger)
      adminDelete: true, // Doar administratorul verificat prin public.is_admin() poate șterge (protejat suplimentar prin triggerul trg_guard_booking_delete)
      description: 'Programările publice sunt create exclusiv prin Supabase Edge Function (create-booking-turnstile) + RPC atomică (create_public_booking_with_turnstile) cu token_hash legat de reference_code și validate server-side prin validate_and_compute_booking().',
    },
    {
      tableName: 'booking_schedule_exceptions_audit',
      rlsEnabled: true,
      publicSelect: false,
      publicInsert: false, // Inserarea se face exclusiv din triggerul SECURITY DEFINER validate_and_compute_booking() la excepții explicite [EXCEPTIE_PROGRAM: motiv]
      adminUpdate: false, // Jurnal imutabil
      adminDelete: false, // Jurnal imutabil
      description: 'Jurnal imutabil de audit pentru excepțiile de program ale administratorului ([EXCEPTIE_PROGRAM: <motiv min. 5 caractere>]).',
    },
    {
      tableName: 'services',
      rlsEnabled: true,
      publicSelect: true, // Publicul vede lista de servicii și tarife
      publicInsert: false, // Doar administratorul verificat prin public.is_admin() poate adăuga servicii
      adminUpdate: true, // Doar administratorul verificat prin public.is_admin() poate modifica prețuri/titluri/imagini
      adminDelete: true, // Doar administratorul verificat prin public.is_admin() poate șterge servicii
      description: 'Lista oficială de servicii și pachete. Publică pentru citire, protejată prin RLS + public.is_admin() împotriva oricărui utilizator neautorizat.',
    },
    {
      tableName: 'service_addons',
      rlsEnabled: true,
      publicSelect: true, // Publicul vede tratamentele opționale în calculator și formular
      publicInsert: false, // Doar administratorul verificat prin public.is_admin() poate adăuga tratamente
      adminUpdate: true, // Doar administratorul verificat prin public.is_admin() poate modifica preț/timp/denumire
      adminDelete: true, // Doar administratorul verificat prin public.is_admin() poate șterge tratamente
      description: 'Tratamente opționale și servicii extra. Vizibile public, editabile exclusiv de administratorul verificat prin public.is_admin().',
    },
    {
      tableName: 'reviews',
      rlsEnabled: true,
      publicSelect: true, // Publicul vede doar recenziile aprobate (approved = true)
      publicInsert: true, // Clienții pot trimite recenzii noi cu approved = false spre moderare
      adminUpdate: true, // Doar adminul verificat prin public.is_admin() poate aproba sau edita
      adminDelete: true, // Doar adminul verificat prin public.is_admin() poate șterge
      description: 'Recenziile sunt moderate. Clienții pot trimite doar recenzii neaprobate; doar administratorul (public.is_admin()) le poate aproba.',
    },
    {
      tableName: 'gallery_items',
      rlsEnabled: true,
      publicSelect: true, // Publicul vede fotografiile și videoclipurile
      publicInsert: false, // Doar adminul verificat prin public.is_admin() poate încărca media
      adminUpdate: true, // Doar adminul verificat prin public.is_admin() poate schimba imaginile sau titlurile
      adminDelete: true, // Doar adminul verificat prin public.is_admin() poate șterge
      description: 'Galeria foto-video este publică pentru vizualizare. Modificarea și adăugarea necesită rol de administrator verificat în baza de date (public.is_admin()).',
    },
    {
      tableName: 'admin_auth_audit',
      rlsEnabled: true,
      publicSelect: false, // Jurnalul de securitate este strict confidențial (doar public.is_admin())
      publicInsert: true, // Utilizatorii neautentificați pot înregistra doar FAILED; SUCCESS/LOGOUT cer public.is_admin()
      adminUpdate: false, // Jurnal imutabil
      adminDelete: false, // Nu se șterg înregistrările de audit
      description: 'Jurnal imutabil anti-spoofing: anon poate înregistra doar FAILED; SUCCESS și LOGOUT cer public.is_admin().',
    },
    {
      tableName: 'pfa_settings',
      rlsEnabled: true,
      publicSelect: true, // Vizitatorii (anon) au GRANT SELECT doar pe coloanele publice și view-ul public_site_settings; datele private PFA cer public.is_admin()
      publicInsert: false, // Doar adminul verificat prin public.is_admin()
      adminUpdate: true, // Doar adminul verificat prin public.is_admin() poate actualiza setările site-ului
      adminDelete: false,
      description: 'Vizitatorii (anon) pot citi doar coloanele publice prin GRANT SELECT pe coloane și view-ul public_site_settings (security_invoker = true); datele private PFA sunt accesibile exclusiv administratorului (public.is_admin()).',
    },
  ];
}

export function generateSupabaseSQLSchema(): string {
  return `-- ==============================================================================
-- MIGRARE COMPLETĂ & INCREMENTALĂ SUPABASE: ROXANA TEUȘDE PFA (BUIE)
-- Fișiere de referință:
--   1. supabase/migrations/20261101000000_complete_atelier_schema.sql (Schema de bază)
--   2. supabase/migrations/20261102000000_incremental_booking_security_remediation.sql (Migrare incrementală non-distructivă)
-- ==============================================================================

-- TRANZACȚIA 1: EXTINDERE NON-DISTRUCTIVĂ, INVENTARIERE RLS ȘI BACKUP PERSISTENT
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.services (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(80) NOT NULL DEFAULT 'tuns',
    price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    duration VARCHAR(80) NOT NULL DEFAULT '40 minute',
    duration_min INT NOT NULL DEFAULT 40 CHECK (duration_min >= 0 AND duration_min <= 480),
    popular BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.service_addons (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price_ron NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price_ron >= 0),
    duration_min INT NOT NULL DEFAULT 10 CHECK (duration_min > 0 AND duration_min <= 240),
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    popular BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(32) NOT NULL UNIQUE,
    client_name VARCHAR(150) NOT NULL,
    client_email VARCHAR(150) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    service_id VARCHAR(100) NOT NULL REFERENCES public.services(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    service_name VARCHAR(200) NOT NULL,
    barber_name VARCHAR(100) DEFAULT 'Roxana Teușde (Buie)',
    event_date DATE NOT NULL,
    event_time VARCHAR(20) NOT NULL,
    duration_min INT NOT NULL DEFAULT 40 CHECK (duration_min >= 5 AND duration_min <= 480),
    location VARCHAR(200) DEFAULT 'Atelier Tileagd',
    guests_count INT DEFAULT 1 CHECK (guests_count >= 1),
    estimated_total NUMERIC(10, 2) DEFAULT 0 CHECK (estimated_total >= 0),
    deposit_amount NUMERIC(10, 2) DEFAULT 0 CHECK (deposit_amount >= 0),
    notes TEXT DEFAULT '',
    addons JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(30) DEFAULT 'in_asteptare' CHECK (status IN ('in_asteptare', 'confirmat', 'finalizat', 'anulat')),
    admin_notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_name VARCHAR(150) NOT NULL,
    role_or_event VARCHAR(150) NOT NULL DEFAULT 'Client Atelier',
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    text TEXT NOT NULL,
    event_date VARCHAR(50) DEFAULT '',
    avatar_url TEXT DEFAULT '',
    approved BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    category VARCHAR(80) NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('photo', 'video')),
    media_url TEXT NOT NULL,
    thumbnail_url TEXT DEFAULT '',
    aspect_ratio VARCHAR(20) DEFAULT 'square',
    featured BOOLEAN DEFAULT FALSE NOT NULL,
    order_index INT DEFAULT 0 NOT NULL,
    description TEXT DEFAULT '',
    event_date VARCHAR(50) DEFAULT '',
    client_names VARCHAR(150) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_auth_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'LOGOUT')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_agent TEXT DEFAULT '',
    city VARCHAR(100) DEFAULT 'Tileagd, Bihor',
    failure_reason TEXT
);

CREATE TABLE IF NOT EXISTS public.pfa_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'current',
    brand_name VARCHAR(150) NOT NULL DEFAULT 'TEUȘDE ROXANA-LENUȚA PERSOANĂ FIZICĂ AUTORIZATĂ',
    owner_name VARCHAR(150) NOT NULL DEFAULT 'Roxana-Lenuța Teușde',
    cui VARCHAR(50) NOT NULL DEFAULT '50143520',
    reg_com VARCHAR(50) NOT NULL DEFAULT 'F2024000617057',
    registration_date VARCHAR(50) NOT NULL DEFAULT '28.05.2024',
    caen_code VARCHAR(100) NOT NULL DEFAULT '9621 · Rev. 3 — Activități de coafură și frizerie',
    address VARCHAR(200) NOT NULL DEFAULT 'Str. PLOPILOR, Nr. 28, Cod poștal 417585, Tileagd, Bihor',
    phone VARCHAR(50) NOT NULL DEFAULT '+40 751 676 420',
    email VARCHAR(100) NOT NULL DEFAULT 'contact@roxanateusde.ro',
    hours_weekday VARCHAR(100) NOT NULL DEFAULT 'Marți - Vineri: 09:00 - 16:00',
    hours_saturday VARCHAR(100) NOT NULL DEFAULT '09:00 - 13:00',
    hours_sunday VARCHAR(50) NOT NULL DEFAULT 'Luni și Duminică: Închis',
    about_bio TEXT,
    site_images JSONB,
    gallery_settings JSONB,
    services_settings JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMIT;

-- TRANZACȚIA 2: FUNCȚII SECURITY DEFINER, TRIGGER PROGRAMĂRI, VIEW PUBLIC & POLITICI RLS
BEGIN;

CREATE SCHEMA IF NOT EXISTS private_security;
REVOKE ALL ON SCHEMA private_security FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_jwt_role TEXT;
BEGIN
  v_jwt_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    auth.role(),
    ''
  );
  IF v_jwt_role IS DISTINCT FROM 'authenticated' THEN
    RETURN FALSE;
  END IF;
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN COALESCE(
    EXISTS (
      SELECT 1
      FROM public.admin_users a
      INNER JOIN auth.users u ON u.id = a.user_id
      WHERE a.user_id = v_uid
        AND a.active IS TRUE
        AND a.role IN ('admin', 'super_admin')
        AND u.email_confirmed_at IS NOT NULL
    ),
    FALSE
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_jwt_role TEXT;
BEGIN
  v_jwt_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    auth.role(),
    ''
  );
  IF v_jwt_role IS DISTINCT FROM 'authenticated' THEN
    RETURN FALSE;
  END IF;
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN COALESCE(
    EXISTS (
      SELECT 1
      FROM public.admin_users a
      INNER JOIN auth.users u ON u.id = a.user_id
      WHERE a.user_id = v_uid
        AND a.active IS TRUE
        AND a.role = 'super_admin'
        AND u.email_confirmed_at IS NOT NULL
    ),
    FALSE
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE VIEW public.public_site_settings
WITH (security_invoker = true)
AS
SELECT
  id,
  site_images,
  gallery_settings,
  services_settings,
  hours_weekday,
  hours_saturday,
  hours_sunday,
  updated_at
FROM public.pfa_settings
WHERE id = 'current';

REVOKE ALL ON public.pfa_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, site_images, gallery_settings, services_settings, hours_weekday, hours_saturday, hours_sunday, updated_at) ON public.pfa_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pfa_settings TO authenticated;
GRANT SELECT ON public.public_site_settings TO anon, authenticated;

REVOKE ALL ON public.bookings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

-- Politici RLS admin_users (WITH CHECK (public.is_super_admin()))
CREATE POLICY "admin_users_select_verified_admin" ON public.admin_users FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_users_insert_super_admin_only" ON public.admin_users FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "admin_users_update_super_admin_only" ON public.admin_users FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "admin_users_delete_super_admin_only" ON public.admin_users FOR DELETE TO authenticated USING (public.is_super_admin());

-- Politici RLS services (WITH CHECK (public.is_admin()))
CREATE POLICY "services_select_public" ON public.services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "services_insert_admin_only" ON public.services FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "services_update_admin_only" ON public.services FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "services_delete_admin_only" ON public.services FOR DELETE TO authenticated USING (public.is_admin());

-- Politici RLS bookings (fără INSERT direct anon; doar admin prin PostgREST sau Edge Function create-booking-turnstile)
CREATE POLICY "bookings_insert_admin_only" ON public.bookings FOR INSERT TO authenticated WITH CHECK (COALESCE(public.is_admin(), FALSE) = TRUE);
CREATE POLICY "bookings_select_admin_only" ON public.bookings FOR SELECT TO authenticated USING (COALESCE(public.is_admin(), FALSE) = TRUE);
CREATE POLICY "bookings_update_admin_only" ON public.bookings FOR UPDATE TO authenticated USING (COALESCE(public.is_admin(), FALSE) = TRUE) WITH CHECK (COALESCE(public.is_admin(), FALSE) = TRUE);
CREATE POLICY "bookings_delete_admin_only" ON public.bookings FOR DELETE TO authenticated USING (COALESCE(public.is_admin(), FALSE) = TRUE);

-- Politici RLS admin_auth_audit (status IN ('SUCCESS', 'LOGOUT') doar cu public.is_admin())
CREATE POLICY "admin_auth_audit_insert_failed_attempt" ON public.admin_auth_audit FOR INSERT TO anon, authenticated WITH CHECK (status = 'FAILED' AND length(trim(username)) >= 2 AND failure_reason IS NOT NULL AND length(trim(failure_reason)) >= 2);
CREATE POLICY "admin_auth_audit_insert_verified_admin_events" ON public.admin_auth_audit FOR INSERT TO authenticated WITH CHECK (public.is_admin() AND status IN ('SUCCESS', 'LOGOUT') AND length(trim(username)) >= 2);
CREATE POLICY "admin_auth_audit_select_admin_only" ON public.admin_auth_audit FOR SELECT TO authenticated USING (public.is_admin());

-- Politici RLS pfa_settings
CREATE POLICY "pfa_settings_select_anon_public_cols" ON public.pfa_settings FOR SELECT TO anon USING (id = 'current');
CREATE POLICY "pfa_settings_select_admin_all_cols" ON public.pfa_settings FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "pfa_settings_insert_admin_only" ON public.pfa_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "pfa_settings_update_admin_only" ON public.pfa_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "pfa_settings_delete_admin_only" ON public.pfa_settings FOR DELETE TO authenticated USING (public.is_admin());

-- SUPABASE STORAGE BUCKET ('atelier-media')
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('atelier-media', 'atelier-media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800;

CREATE POLICY "atelier_media_select_public" ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated USING (bucket_id = 'atelier-media');
CREATE POLICY "atelier_media_insert_admin_only" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (bucket_id = 'atelier-media' AND public.is_admin());
CREATE POLICY "atelier_media_update_admin_only" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (bucket_id = 'atelier-media' AND public.is_admin()) WITH CHECK (bucket_id = 'atelier-media' AND public.is_admin());
CREATE POLICY "atelier_media_delete_admin_only" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (bucket_id = 'atelier-media' AND public.is_admin());
CREATE POLICY "atelier_media_restrictive_write_guard" ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (bucket_id <> 'atelier-media' OR public.is_admin());
CREATE POLICY "atelier_media_restrictive_update_guard" ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (bucket_id <> 'atelier-media' OR public.is_admin()) WITH CHECK (bucket_id <> 'atelier-media' OR public.is_admin());
CREATE POLICY "atelier_media_restrictive_delete_guard" ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (bucket_id <> 'atelier-media' OR public.is_admin());

COMMIT;
-- Nota: Pentru scriptul SQL complet (inclusiv backup-urile din Tranzacția 1, validate_and_compute_booking și bootstrap_first_super_admin), utilizați fișierul supabase/migrations/20261101000000_complete_atelier_schema.sql.
`;
}
