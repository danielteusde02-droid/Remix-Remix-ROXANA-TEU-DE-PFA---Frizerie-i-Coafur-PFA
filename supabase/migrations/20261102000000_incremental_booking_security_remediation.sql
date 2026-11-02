-- ==============================================================================
-- MIGRARE INCREMENTALĂ DE SECURITATE ȘI VALIDARE PROGRAMĂRI: ROXANA TEUȘDE PFA (BUIE)
-- Fișier: supabase/migrations/20261102000000_incremental_booking_security_remediation.sql
--
-- REGULI RESPECTATE STRICT:
-- 1. Fără TRUNCATE, fără DROP TABLE și fără ștergeri/modificări ale datelor existente.
-- 2. Păstrează toate programările, serviciile, prețurile, recenziile, utilizatorii și fotografiile.
-- 3. Elimină complet mecanismul de consumare a „celui mai recent nonce Turnstile” și leagă
--    atomic fiecare token Turnstile de codul de referință al cererii curente (reference_code).
-- 4. Aplică programul oficial (Luni: ÎNCHIS, Marți-Vineri: 09:00-16:00, Sâmbătă: 09:00-13:00,
--    Duminică: ÎNCHIS), blochează orele deja trecute în ziua curentă (Europe/Bucharest) și
--    validează durata reală (serviciu + tratamente opționale) până la ora închiderii.
-- 5. Auditează structurat excepțiile administrative explicite ([EXCEPTIE_PROGRAM: <motiv min. 5 caractere>]).
-- 6. Verifică existența suprapunerilor în datele istorice înainte de aplicarea constrângerii
--    EXCLUDE USING gist, astfel încât migrarea să nu eșueze niciodată pe datele existente.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. EXTENSII NECESARE (NON-DISTRUCTIV)
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS private_security;
REVOKE ALL ON SCHEMA private_security FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. FUNCȚIE SECURIZATĂ PENTRU EXTRAGEREA ROLULUI JWT (FĂRĂ ERORI JSON SAU NULL)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.safe_jwt_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_claim_role TEXT;
  v_raw_claims TEXT;
  v_parsed_claims JSONB;
BEGIN
  -- 1. Extragere directă din GUC-ul setat de PostgREST
  v_claim_role := NULLIF(btrim(current_setting('request.jwt.claim.role', true)), '');
  IF v_claim_role IS NOT NULL THEN
    RETURN v_claim_role;
  END IF;

  -- 2. Extragere din JSON-ul complet request.jwt.claims (cu capturare eroare JSON)
  v_raw_claims := NULLIF(btrim(current_setting('request.jwt.claims', true)), '');
  IF v_raw_claims IS NOT NULL THEN
    BEGIN
      v_parsed_claims := v_raw_claims::jsonb;
      v_claim_role := NULLIF(btrim(v_parsed_claims ->> 'role'), '');
      IF v_claim_role IS NOT NULL THEN
        RETURN v_claim_role;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_claim_role := NULL;
    END;
  END IF;

  -- 3. Fallback la auth.role()
  BEGIN
    v_claim_role := NULLIF(btrim(auth.role()), '');
  EXCEPTION
    WHEN OTHERS THEN
      v_claim_role := NULL;
  END;

  RETURN COALESCE(v_claim_role, '');
END;
$$;

REVOKE ALL ON FUNCTION public.safe_jwt_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_jwt_role() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. ÎNTĂRIREA FUNCȚIILOR public.is_admin() ȘI public.is_super_admin()
--    Garantează returnarea strictă BOOLEAN (niciodată NULL) și diferențiază
--    rolul tehnic service_role de administratorul real autentificat.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_jwt_role TEXT;
BEGIN
  v_jwt_role := public.safe_jwt_role();
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
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_jwt_role TEXT;
BEGIN
  v_jwt_role := public.safe_jwt_role();
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

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. TABEL DE AUDIT STRUCTURAT PENTRU EXCEPȚIILE DE PROGRAM ALE ADMINISTRATORULUI
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_schedule_exceptions_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference_code VARCHAR(32) NOT NULL,
  admin_user_id UUID,
  actor_db_role TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time VARCHAR(20) NOT NULL,
  duration_min INT NOT NULL,
  violation_type VARCHAR(60) NOT NULL,
  exception_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.booking_schedule_exceptions_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_schedule_exceptions_audit FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.booking_schedule_exceptions_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.booking_schedule_exceptions_audit TO authenticated;
GRANT ALL ON public.booking_schedule_exceptions_audit TO service_role;

DROP POLICY IF EXISTS "schedule_exceptions_audit_select_admin" ON public.booking_schedule_exceptions_audit;
CREATE POLICY "schedule_exceptions_audit_select_admin"
  ON public.booking_schedule_exceptions_audit
  FOR SELECT
  TO authenticated
  USING (COALESCE(public.is_admin(), FALSE) = TRUE);

-- ------------------------------------------------------------------------------
-- 5. EXTINDEREA NON-DISTRUCTIVĂ A TABELULUI private_security.turnstile_token_nonces
--    Leagă fiecare token Turnstile de reference_code-ul exact al programării.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private_security.turnstile_token_nonces (
  token_hash TEXT PRIMARY KEY,
  client_ip TEXT DEFAULT 'unknown',
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE private_security.turnstile_token_nonces
  ADD COLUMN IF NOT EXISTS expected_reference_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS consumed_booking_id UUID,
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

REVOKE ALL ON TABLE private_security.turnstile_token_nonces FROM PUBLIC, anon, authenticated, service_role;

-- Actualizare consume_turnstile_token_nonce cu legare de reference_code
CREATE OR REPLACE FUNCTION public.consume_turnstile_token_nonce(
  p_token_hash TEXT,
  p_client_ip TEXT DEFAULT 'unknown',
  p_expected_reference_code VARCHAR(32) DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private_security, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT;
BEGIN
  v_jwt_role := public.safe_jwt_role();

  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Acces interzis: această funcție poate fi apelată exclusiv din Supabase Edge Function (service_role).';
  END IF;

  IF p_token_hash IS NULL OR length(btrim(p_token_hash)) < 32 THEN
    RAISE EXCEPTION 'Hash-ul tokenului Turnstile este invalid.';
  END IF;

  -- Curățare non-distructivă doar a tokenurilor expirate (> 24h)
  DELETE FROM private_security.turnstile_token_nonces
  WHERE created_at < timezone('utc'::text, now()) - INTERVAL '24 hours';

  INSERT INTO private_security.turnstile_token_nonces (
    token_hash,
    client_ip,
    consumed,
    expected_reference_code,
    created_at
  )
  VALUES (
    btrim(p_token_hash),
    COALESCE(NULLIF(btrim(p_client_ip), ''), 'unknown'),
    FALSE,
    NULLIF(btrim(COALESCE(p_expected_reference_code, '')), ''),
    timezone('utc'::text, now())
  )
  ON CONFLICT (token_hash) DO NOTHING;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_turnstile_token_nonce(TEXT, TEXT, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_turnstile_token_nonce(TEXT, TEXT, VARCHAR) TO service_role;

-- ------------------------------------------------------------------------------
-- 6. RPC ATOMICĂ PENTRU CREAREA PROGRAMĂRII PUBLICE CU VERIFICARE TURNSTILE
--    Garantează că nonce-ul Turnstile și inserarea în public.bookings au loc
--    în aceeași tranzacție PostgreSQL, legată strict de p_token_hash și p_reference_code.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_public_booking_with_turnstile(
  p_token_hash TEXT,
  p_client_ip TEXT,
  p_reference_code VARCHAR(32),
  p_client_name VARCHAR(150),
  p_client_email VARCHAR(150),
  p_client_phone VARCHAR(50),
  p_service_id VARCHAR(100),
  p_service_name VARCHAR(200),
  p_barber_name VARCHAR(100),
  p_event_date DATE,
  p_event_time VARCHAR(20),
  p_location VARCHAR(200),
  p_notes TEXT,
  p_addons JSONB
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private_security, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT;
  v_clean_hash TEXT;
  v_clean_ref VARCHAR(32);
  v_inserted_booking public.bookings;
BEGIN
  v_jwt_role := public.safe_jwt_role();

  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Acces interzis: crearea programărilor publice este permisă exclusiv prin Supabase Edge Function (service_role).';
  END IF;

  v_clean_hash := btrim(COALESCE(p_token_hash, ''));
  v_clean_ref := btrim(COALESCE(p_reference_code, ''));

  IF length(v_clean_hash) < 32 THEN
    RAISE EXCEPTION 'Tokenul anti-bot (Cloudflare Turnstile) este invalid.';
  END IF;

  IF length(v_clean_ref) < 6 THEN
    RAISE EXCEPTION 'Codul de referință al programării este invalid.';
  END IF;

  -- Curățare tokenuri expirate (> 24h)
  DELETE FROM private_security.turnstile_token_nonces
  WHERE created_at < timezone('utc'::text, now()) - INTERVAL '24 hours';

  -- Înregistrăm sau actualizăm nonce-ul neconsumat strict pentru această pereche (token_hash, reference_code)
  INSERT INTO private_security.turnstile_token_nonces (
    token_hash,
    client_ip,
    consumed,
    expected_reference_code,
    created_at
  )
  VALUES (
    v_clean_hash,
    COALESCE(NULLIF(btrim(p_client_ip), ''), 'unknown'),
    FALSE,
    v_clean_ref,
    timezone('utc'::text, now())
  )
  ON CONFLICT (token_hash) DO UPDATE
    SET expected_reference_code = EXCLUDED.expected_reference_code
    WHERE private_security.turnstile_token_nonces.consumed IS FALSE
      AND (
        private_security.turnstile_token_nonces.expected_reference_code IS NULL
        OR private_security.turnstile_token_nonces.expected_reference_code = EXCLUDED.expected_reference_code
      );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tokenul anti-bot (Cloudflare Turnstile) a fost deja utilizat. Reîncărcați verificarea.';
  END IF;

  -- Setăm GUC-urile tranzacționale pe care triggerul validate_and_compute_booking() le verifică strict
  PERFORM set_config('app.turnstile_token_hash', v_clean_hash, true);
  PERFORM set_config('app.turnstile_reference_code', v_clean_ref, true);

  INSERT INTO public.bookings (
    reference_code,
    client_name,
    client_email,
    client_phone,
    service_id,
    service_name,
    barber_name,
    event_date,
    event_time,
    location,
    guests_count,
    estimated_total,
    deposit_amount,
    notes,
    addons,
    status,
    admin_notes
  )
  VALUES (
    v_clean_ref,
    btrim(COALESCE(p_client_name, '')),
    btrim(COALESCE(p_client_email, '')),
    btrim(COALESCE(p_client_phone, '')),
    btrim(COALESCE(p_service_id, '')),
    btrim(COALESCE(p_service_name, '')),
    COALESCE(NULLIF(btrim(p_barber_name), ''), 'Roxana Teușde (Buie)'),
    p_event_date,
    btrim(COALESCE(p_event_time, '')),
    COALESCE(NULLIF(btrim(p_location), ''), 'Atelier Tileagd'),
    1,
    0,
    0,
    COALESCE(p_notes, ''),
    COALESCE(p_addons, '{}'::jsonb),
    'in_asteptare',
    ''
  )
  RETURNING * INTO v_inserted_booking;

  UPDATE private_security.turnstile_token_nonces
  SET consumed_booking_id = v_inserted_booking.id,
      consumed_at = timezone('utc'::text, now())
  WHERE token_hash = v_clean_hash;

  RETURN v_inserted_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_booking_with_turnstile(
  TEXT, TEXT, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, DATE, VARCHAR, VARCHAR, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_booking_with_turnstile(
  TEXT, TEXT, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, DATE, VARCHAR, VARCHAR, TEXT, JSONB
) TO service_role;

-- ------------------------------------------------------------------------------
-- 7. FUNCȚIA TRIGGER COMPLETĂ: public.validate_and_compute_booking()
--    - Fără consumarea „celui mai recent nonce” (cere potrivire exactă token_hash + reference_code)
--    - Blochează zilele Luni (1) și Duminică (0)
--    - Validează Marți-Vineri 09:00-16:00 și Sâmbătă 09:00-13:00 (inclusiv durata totală)
--    - Blochează orele deja trecute în ziua curentă (Europe/Bucharest)
--    - Auditează excepțiile explicite ale administratorului ([EXCEPTIE_PROGRAM: <motiv min. 5 caractere>])
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_and_compute_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private_security, pg_temp
AS $$
DECLARE
  v_service_price NUMERIC(10, 2);
  v_service_title VARCHAR(200);
  v_service_duration INT;
  v_addon_rec RECORD;
  v_addons_total NUMERIC(10, 2) := 0;
  v_addons_duration INT := 0;
  v_clean_addons JSONB := '{}'::jsonb;
  v_selected_val JSONB;
  v_norm_phone TEXT;
  v_norm_email TEXT;
  v_recent_client_count INT;
  v_recent_global_count INT;
  v_start_parts TEXT[];
  v_start_hour INT;
  v_start_minute INT;
  v_start_min INT;
  v_end_min INT;
  v_calc_duration INT;
  v_conflict_ref VARCHAR(32);
  v_conflict_time VARCHAR(20);
  v_jwt_role TEXT;
  v_is_admin BOOLEAN := FALSE;
  v_is_sql_editor_admin BOOLEAN := FALSE;
  v_is_privileged BOOLEAN := FALSE;
  v_nonce_hash TEXT;
  v_guc_token_hash TEXT;
  v_guc_ref_code TEXT;
  v_day_of_week INT;
  v_romania_now TIMESTAMP;
  v_romania_today DATE;
  v_romania_now_min INT;
  v_exception_reason TEXT;
  v_violation_type VARCHAR(60);
BEGIN
  -- 0. Identificarea strictă a contextului de execuție
  v_jwt_role := public.safe_jwt_role();
  v_is_admin := COALESCE(public.is_admin(), FALSE);

  IF v_jwt_role = '' AND session_user IN ('postgres', 'supabase_admin') THEN
    v_is_sql_editor_admin := TRUE;
  END IF;

  v_is_privileged := (v_is_admin OR v_is_sql_editor_admin);

  -- 1. Controlul accesului la UPDATE și INSERT
  IF TG_OP = 'UPDATE' THEN
    IF NOT v_is_privileged THEN
      RAISE EXCEPTION 'Acces interzis: doar administratorul autorizat poate modifica o programare existentă.';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF v_jwt_role = 'service_role' THEN
      -- Inserare publică prin Edge Function + RPC atomică:
      -- Verificăm obligatoriu GUC-urile tranzacționale și potrivirea exactă (token_hash + reference_code)
      v_guc_token_hash := NULLIF(btrim(current_setting('app.turnstile_token_hash', true)), '');
      v_guc_ref_code := NULLIF(btrim(current_setting('app.turnstile_reference_code', true)), '');

      IF v_guc_token_hash IS NULL OR v_guc_ref_code IS NULL OR v_guc_ref_code IS DISTINCT FROM NEW.reference_code THEN
        RAISE EXCEPTION 'Verificarea anti-bot (Cloudflare Turnstile) lipsește sau nu corespunde cererii curente. Programările publice trebuie trimise exclusiv prin procedura atomică autorizată.';
      END IF;

      UPDATE private_security.turnstile_token_nonces
      SET consumed = TRUE,
          consumed_at = timezone('utc'::text, now())
      WHERE token_hash = v_guc_token_hash
        AND expected_reference_code = NEW.reference_code
        AND consumed IS FALSE
        AND created_at >= timezone('utc'::text, now()) - INTERVAL '5 minutes'
      RETURNING token_hash INTO v_nonce_hash;

      IF v_nonce_hash IS NULL THEN
        RAISE EXCEPTION 'Verificarea anti-bot (Cloudflare Turnstile) este invalidă, expirată sau a fost deja consumată.';
      END IF;
    ELSIF NOT v_is_privileged THEN
      RAISE EXCEPTION 'Inserarea directă a programărilor este interzisă. Utilizați formularul oficial de pe site.';
    END IF;
  END IF;

  -- 2. Validare câmpuri de contact
  NEW.client_name := btrim(COALESCE(NEW.client_name, ''));
  NEW.client_email := lower(btrim(COALESCE(NEW.client_email, '')));
  NEW.client_phone := btrim(COALESCE(NEW.client_phone, ''));
  v_norm_phone := regexp_replace(NEW.client_phone, '[^0-9]', '', 'g');
  v_norm_email := NEW.client_email;

  IF length(NEW.client_name) < 2 OR length(NEW.client_name) > 120 THEN
    RAISE EXCEPTION 'Numele clientului trebuie să conțină între 2 și 120 de caractere.';
  END IF;

  IF length(v_norm_phone) < 9 OR length(v_norm_phone) > 15 THEN
    RAISE EXCEPTION 'Numărul de telefon introdus nu este valid.';
  END IF;

  -- 3. Calculul orei curente în România (Europe/Bucharest)
  v_romania_now := timezone('Europe/Bucharest', now());
  v_romania_today := v_romania_now::date;
  v_romania_now_min := EXTRACT(HOUR FROM v_romania_now)::INT * 60 + EXTRACT(MINUTE FROM v_romania_now)::INT;

  -- 4. Validarea datei pentru programările publice (sau când data se schimbă)
  IF NOT v_is_privileged THEN
    IF NEW.event_date < v_romania_today THEN
      RAISE EXCEPTION 'Data programării nu poate fi în trecut.';
    END IF;
    IF NEW.event_date > (v_romania_today + INTERVAL '90 days')::date THEN
      RAISE EXCEPTION 'Programările online se pot face cu cel mult 90 de zile în avans.';
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.event_date < v_romania_today THEN
    RAISE EXCEPTION 'Data unei programări noi nu poate fi în trecut.';
  END IF;

  -- 5. Parsarea și validarea strictă a orei de început (HH:MM)
  NEW.event_time := btrim(COALESCE(NEW.event_time, ''));
  IF NEW.event_time !~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'Formatul orei (%) este invalid. Folosiți formatul HH:MM.', NEW.event_time;
  END IF;

  v_start_parts := string_to_array(NEW.event_time, ':');
  v_start_hour := v_start_parts[1]::INT;
  v_start_minute := v_start_parts[2]::INT;
  v_start_min := (v_start_hour * 60) + v_start_minute;

  -- Blocarea orelor deja trecute în ziua curentă (Europe/Bucharest)
  IF NEW.event_date = v_romania_today AND (TG_OP = 'INSERT' OR NOT v_is_privileged) THEN
    IF (NOT v_is_privileged) AND v_start_min <= v_romania_now_min THEN
      RAISE EXCEPTION 'Ora selectată (%) a trecut deja pentru ziua de astăzi. Vă rugăm să alegeți o oră viitoare.', NEW.event_time;
    END IF;
  END IF;

  -- 6. Preluarea serviciului, prețului și duratei oficiale din catalog
  SELECT price, title, COALESCE(NULLIF(duration_min, 0), 40)
    INTO v_service_price, v_service_title, v_service_duration
  FROM public.services
  WHERE id = NEW.service_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviciul selectat (%) nu există în oferta activă.', NEW.service_id;
  END IF;

  -- 7. Calcularea tratamentelor opționale (addons)
  IF NEW.addons IS NOT NULL AND jsonb_typeof(NEW.addons) = 'object' THEN
    FOR v_addon_rec IN
      SELECT id, price_ron, duration_min FROM public.service_addons
    LOOP
      v_selected_val := NEW.addons -> v_addon_rec.id;
      IF v_selected_val IS NOT NULL AND (
        v_selected_val = 'true'::jsonb OR
        v_selected_val = '1'::jsonb OR
        v_selected_val = '"true"'::jsonb
      ) THEN
        v_addons_total := v_addons_total + COALESCE(v_addon_rec.price_ron, 0);
        v_addons_duration := v_addons_duration + COALESCE(v_addon_rec.duration_min, 0);
        v_clean_addons := jsonb_set(v_clean_addons, ARRAY[v_addon_rec.id], 'true'::jsonb, true);
      END IF;
    END LOOP;
  END IF;

  v_calc_duration := GREATEST(10, LEAST(480, COALESCE(v_service_duration, 40) + v_addons_duration));

  IF NOT v_is_privileged OR TG_OP = 'INSERT' OR NEW.service_id IS DISTINCT FROM OLD.service_id OR NEW.addons IS DISTINCT FROM OLD.addons THEN
    NEW.duration_min := v_calc_duration;
  ELSE
    NEW.duration_min := GREATEST(10, LEAST(480, COALESCE(NEW.duration_min, v_calc_duration)));
  END IF;

  v_end_min := v_start_min + NEW.duration_min;

  -- 8. Validarea programului salonului și a duratei totale până la închidere:
  --    Luni (1): ÎNCHIS
  --    Marți–Vineri (2..5): 09:00 (540) – 16:00 (960)
  --    Sâmbătă (6): 09:00 (540) – 13:00 (780)
  --    Duminică (0): ÎNCHIS
  v_day_of_week := EXTRACT(DOW FROM NEW.event_date)::INT;

  IF NEW.status IN ('in_asteptare', 'confirmat') OR NOT v_is_privileged THEN
    v_violation_type := NULL;

    IF v_day_of_week = 1 THEN
      v_violation_type := 'CLOSED_MONDAY';
    ELSIF v_day_of_week = 0 THEN
      v_violation_type := 'CLOSED_SUNDAY';
    ELSIF v_day_of_week BETWEEN 2 AND 5 THEN
      IF v_start_min < 540 OR v_start_min >= 960 OR v_end_min > 960 THEN
        v_violation_type := 'OUTSIDE_HOURS_TUE_FRI';
      END IF;
    ELSIF v_day_of_week = 6 THEN
      IF v_start_min < 540 OR v_start_min >= 780 OR v_end_min > 780 THEN
        v_violation_type := 'OUTSIDE_HOURS_SATURDAY';
      END IF;
    END IF;

    IF v_violation_type IS NOT NULL THEN
      IF NOT v_is_privileged THEN
        IF v_violation_type = 'CLOSED_MONDAY' THEN
          RAISE EXCEPTION 'Atelierul este închis lunea. Programul de lucru este Marți–Vineri 09:00–16:00 și Sâmbătă 09:00–13:00.';
        ELSIF v_violation_type = 'CLOSED_SUNDAY' THEN
          RAISE EXCEPTION 'Atelierul este închis duminica. Programul de lucru este Marți–Vineri 09:00–16:00 și Sâmbătă 09:00–13:00.';
        ELSIF v_violation_type = 'OUTSIDE_HOURS_TUE_FRI' THEN
          RAISE EXCEPTION 'De marți până vineri, programările trebuie să înceapă după ora 09:00 și să se finalizeze cel târziu la ora 16:00 (ora selectată % + durata % min depășește ora închiderii 16:00).', NEW.event_time, NEW.duration_min;
        ELSE
          RAISE EXCEPTION 'Sâmbăta, programările trebuie să înceapă după ora 09:00 și să se finalizeze cel târziu la ora 13:00 (ora selectată % + durata % min depășește ora închiderii 13:00).', NEW.event_time, NEW.duration_min;
        END IF;
      ELSE
        -- Pentru administrator: verificăm existența excepției explicite cu motiv de minimum 5 caractere
        v_exception_reason := btrim(COALESCE(
          substring(COALESCE(NEW.admin_notes, '') FROM '\[EXCEPTIE_PROGRAM:\s*([^\]]+)\]'),
          ''
        ));

        IF length(v_exception_reason) < 5 THEN
          IF v_violation_type IN ('CLOSED_MONDAY', 'CLOSED_SUNDAY') THEN
            RAISE EXCEPTION 'Atelierul este închis % . Confirmarea sau mutarea unei programări în zilele închise necesită o excepție administrativă explicită cu motiv în admin_notes: [EXCEPTIE_PROGRAM: motiv detaliat].',
              CASE WHEN v_day_of_week = 1 THEN 'lunea' ELSE 'duminica' END;
          ELSE
            RAISE EXCEPTION 'Intervalul selectat (% - % min) depășește programul oficial (Marți–Vineri 09:00–16:00, Sâmbătă 09:00–13:00). Pentru excepții administrative, specificați în admin_notes: [EXCEPTIE_PROGRAM: motiv detaliat].',
              NEW.event_time, NEW.duration_min;
          END IF;
        END IF;

        -- Înregistrăm excepția administrativă în tabelul de audit imutabil
        INSERT INTO public.booking_schedule_exceptions_audit (
          booking_reference_code,
          admin_user_id,
          actor_db_role,
          event_date,
          event_time,
          duration_min,
          violation_type,
          exception_reason
        )
        VALUES (
          COALESCE(NEW.reference_code, 'UNKNOWN'),
          auth.uid(),
          COALESCE(NULLIF(v_jwt_role, ''), session_user),
          NEW.event_date,
          NEW.event_time,
          NEW.duration_min,
          v_violation_type,
          v_exception_reason
        );
      END IF;
    END IF;
  END IF;

  -- 9. Lock tranzacțional determinist pe data și frizerul selectat (protecție cereri concurente)
  PERFORM pg_advisory_xact_lock(
    hashtext('booking_slot_lock'),
    hashtext(NEW.event_date::text || '|' || COALESCE(NEW.barber_name, 'Roxana Teușde (Buie)'))
  );

  -- 10. Verificarea suprapunerii intervalelor de timp (pentru programări active)
  IF NEW.status IN ('in_asteptare', 'confirmat') THEN
    SELECT b.reference_code, b.event_time
      INTO v_conflict_ref, v_conflict_time
    FROM public.bookings b
    WHERE b.id IS DISTINCT FROM NEW.id
      AND b.event_date = NEW.event_date
      AND COALESCE(b.barber_name, 'Roxana Teușde (Buie)') = COALESCE(NEW.barber_name, 'Roxana Teușde (Buie)')
      AND b.status IN ('in_asteptare', 'confirmat')
      AND b.event_time ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
      AND (
        (
          split_part(b.event_time, ':', 1)::INT * 60 +
          split_part(b.event_time, ':', 2)::INT
        ) < v_end_min
        AND
        v_start_min < (
          split_part(b.event_time, ':', 1)::INT * 60 +
          split_part(b.event_time, ':', 2)::INT +
          GREATEST(10, COALESCE(b.duration_min, 40))
        )
      )
    LIMIT 1;

    IF v_conflict_ref IS NOT NULL THEN
      RAISE EXCEPTION 'Intervalul selectat (% - % min) se suprapune cu o altă programare activă de la ora %.', NEW.event_time, NEW.duration_min, v_conflict_time;
    END IF;
  END IF;

  -- 11. Limite anti-spam doar pentru cererile publice la INSERT
  IF TG_OP = 'INSERT' AND NOT v_is_privileged THEN
    PERFORM pg_advisory_xact_lock(hashtext('booking_rate_limit_phone'), hashtext(v_norm_phone));

    IF v_norm_email <> '' THEN
      PERFORM pg_advisory_xact_lock(hashtext('booking_rate_limit_email'), hashtext(v_norm_email));
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('booking_rate_limit_global'), 1);

    SELECT COUNT(*)
      INTO v_recent_client_count
    FROM public.bookings
    WHERE created_at >= (timezone('utc'::text, now()) - INTERVAL '24 hours')
      AND status IN ('in_asteptare', 'confirmat')
      AND (
        regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') = v_norm_phone
        OR (
          v_norm_email <> ''
          AND lower(btrim(COALESCE(client_email, ''))) = v_norm_email
        )
      );

    IF v_recent_client_count >= 2 THEN
      RAISE EXCEPTION 'Ați atins limita maximă de 2 programări active în ultimele 24 de ore. Pentru modificări urgente, contactați atelierul telefonic.';
    END IF;

    SELECT COUNT(*)
      INTO v_recent_global_count
    FROM public.bookings
    WHERE created_at >= (timezone('utc'::text, now()) - INTERVAL '10 minutes');

    IF v_recent_global_count >= 15 THEN
      RAISE EXCEPTION 'Sistemul de programări înregistrează un volum ridicat de cereri. Vă rugăm să reîncercați în câteva minute.';
    END IF;
  END IF;

  -- 12. Setarea valorilor calculate pe server
  NEW.service_name := v_service_title;
  NEW.addons := v_clean_addons;
  NEW.estimated_total := v_service_price + v_addons_total;
  NEW.deposit_amount := 0;
  NEW.guests_count := 1;
  NEW.barber_name := COALESCE(NULLIF(btrim(NEW.barber_name), ''), 'Roxana Teușde (Buie)');
  NEW.location := COALESCE(NULLIF(btrim(NEW.location), ''), 'Atelier Tileagd');
  NEW.notes := left(btrim(COALESCE(NEW.notes, '')), 1000);

  IF TG_OP = 'INSERT' AND NOT v_is_privileged THEN
    NEW.status := 'in_asteptare';
    NEW.admin_notes := '';
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_and_compute_booking ON public.bookings;
CREATE TRIGGER trg_validate_and_compute_booking
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_and_compute_booking();

-- ------------------------------------------------------------------------------
-- 8. PROTECȚIE LA ȘTERGEREA PROGRAMĂRILOR (GUARD TRIGGER + RLS STRICT)
--    Împiedică orice ștergere neautorizată și auditează/protejează tabela bookings.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_booking_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT;
BEGIN
  v_jwt_role := public.safe_jwt_role();

  IF COALESCE(public.is_admin(), FALSE) IS TRUE THEN
    RETURN OLD;
  END IF;

  IF v_jwt_role = '' AND session_user IN ('postgres', 'supabase_admin') THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Acces interzis: doar administratorul autorizat poate șterge o programare.';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_booking_delete ON public.bookings;
CREATE TRIGGER trg_guard_booking_delete
  BEFORE DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_booking_delete();

-- ------------------------------------------------------------------------------
-- 9. CONSTRÂNGERE GIST ANTI-SUPRAPUNERE (VERIFICĂ MAI ÎNTÂI DATELE EXISTENTE)
--    Dacă există suprapuneri în datele istorice, le raportează fără a opri migrarea.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.booking_minute_start(p_time VARCHAR)
RETURNS INT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN p_time ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
    THEN split_part(p_time, ':', 1)::INT * 60 + split_part(p_time, ':', 2)::INT
    ELSE -1
  END;
$$;

DO $$
DECLARE
  v_overlap_count INT := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_overlap_count
  FROM public.bookings b1
  INNER JOIN public.bookings b2
    ON b1.id < b2.id
   AND b1.event_date = b2.event_date
   AND COALESCE(b1.barber_name, 'Roxana Teușde (Buie)') = COALESCE(b2.barber_name, 'Roxana Teușde (Buie)')
   AND b1.status IN ('in_asteptare', 'confirmat')
   AND b2.status IN ('in_asteptare', 'confirmat')
   AND public.booking_minute_start(b1.event_time) >= 0
   AND public.booking_minute_start(b2.event_time) >= 0
   AND int4range(
         public.booking_minute_start(b1.event_time),
         public.booking_minute_start(b1.event_time) + GREATEST(10, COALESCE(b1.duration_min, 40)),
         '[)'
       ) &&
       int4range(
         public.booking_minute_start(b2.event_time),
         public.booking_minute_start(b2.event_time) + GREATEST(10, COALESCE(b2.duration_min, 40)),
         '[)'
       );

  IF v_overlap_count = 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlapping_active_slots_excl'
    ) THEN
      ALTER TABLE public.bookings
        ADD CONSTRAINT bookings_no_overlapping_active_slots_excl
        EXCLUDE USING gist (
          event_date WITH =,
          COALESCE(barber_name, 'Roxana Teușde (Buie)') WITH =,
          int4range(
            public.booking_minute_start(event_time),
            public.booking_minute_start(event_time) + GREATEST(10, COALESCE(duration_min, 40)),
            '[)'
          ) WITH &&
        )
        WHERE (status IN ('in_asteptare', 'confirmat') AND public.booking_minute_start(event_time) >= 0);
    END IF;
  ELSE
    RAISE NOTICE 'S-au detectat % suprapuneri în programările existente. Datele existente NU au fost modificate sau șterse, iar protecția pentru noile programări este asigurată de triggerul trg_validate_and_compute_booking.', v_overlap_count;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 10. REÎNTĂRIREA PERMISIUNILOR ȘI A POLITICILOR RLS PE public.bookings
-- ------------------------------------------------------------------------------
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.bookings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

DROP POLICY IF EXISTS "bookings_insert_public" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_validated_public" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_admin_only" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_admin_only" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_admin_only" ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete_admin_only" ON public.bookings;

CREATE POLICY "bookings_insert_admin_only"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (COALESCE(public.is_admin(), FALSE) = TRUE);

CREATE POLICY "bookings_select_admin_only"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (COALESCE(public.is_admin(), FALSE) = TRUE);

CREATE POLICY "bookings_update_admin_only"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (COALESCE(public.is_admin(), FALSE) = TRUE)
  WITH CHECK (COALESCE(public.is_admin(), FALSE) = TRUE);

CREATE POLICY "bookings_delete_admin_only"
  ON public.bookings
  FOR DELETE
  TO authenticated
  USING (COALESCE(public.is_admin(), FALSE) = TRUE);

COMMIT;
