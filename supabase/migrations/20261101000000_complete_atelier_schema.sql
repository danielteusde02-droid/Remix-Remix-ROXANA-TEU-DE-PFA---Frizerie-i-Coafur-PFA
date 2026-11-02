-- ==============================================================================
-- MIGRARE COMPLETĂ, AUDITATĂ & SECURIZATĂ SUPABASE: ROXANA TEUȘDE PFA (BUIE)
-- Fișier: supabase/migrations/20261101000000_complete_atelier_schema.sql
-- Versiune: 20261101000000 (Revizia Finală - Two-Transaction Non-Destructive)
-- ==============================================================================
-- ARHITECTURĂ ÎN DOUĂ TRANZACȚII (PROTECȚIE 100% ÎMPOTRIVA PIERDERII DATELOR):
--   • TRANZACȚIA 1 (BEGIN ... COMMIT):
--       1. Creează tabelele lipsă și adaugă coloanele noi în mod non-distructiv
--          (ADD COLUMN IF NOT EXISTS fără constrângeri blocante premature).
--       2. Populează serviciile/tratamentele/setările implicite (ON CONFLICT DO NOTHING)
--          pentru a preveni erorile de chei străine pe programările istorice valide.
--       3. Creează tabelele de backup și inventariere idempotente:
--            - public.admin_users_legacy_backup
--            - public.migration_data_conflicts_backup
--            - public.rls_policies_inventory_backup
--       4. Auditează toate cele 8 tabele (NULL-uri, duplicate PK/UNIQUE, prețuri/durate
--          invalide, servicii/addons orfane, programări în afara programului sau suprapuse)
--          și salvează integral rândurile problematice (to_jsonb) în backup.
--       5. Execută COMMIT pentru ca backup-urile să rămână salvate permanent pe disc
--          chiar dacă Tranzacția 2 oprește execuția cu RAISE EXCEPTION.
--   • TRANZACȚIA 2 (BEGIN ... COMMIT):
--       1. Verifică dacă există conflicte nerezolvate în backup și oprește migrarea
--          controlat (RAISE EXCEPTION) cu instrucțiuni clare de remediere.
--       2. Repară și validează cheile primare, cheile străine, constrângerile CHECK
--          și indecșii pe toate cele 8 tabele.
--       3. Configurează schema privată private_security, protecția anti-replay Turnstile
--          și procedura private_security.bootstrap_first_super_admin(UUID).
--       4. Configurează funcțiile SECURITY DEFINER (public.is_admin, public.is_super_admin)
--          și trigger-ul BEFORE INSERT OR UPDATE public.validate_and_compute_booking().
--       5. Configurează view-ul public.public_site_settings (security_invoker = true),
--          GRANT-urile la nivel de coloană pe public.pfa_settings și politicile RLS
--          pe cele 8 tabele și pe Supabase Storage (bucket 'atelier-media').
-- ==============================================================================

-- ==============================================================================
-- TRANZACȚIA 1: EXTINDERE NON-DISTRUCTIVĂ, INVENTARIERE RLS ȘI BACKUP PERSISTENT
-- ==============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1.1 Crearea tabelelor de bază (dacă nu există deja) și adăugarea non-distructivă
--     a coloanelor pe toate cele 8 tabele ale aplicației
-- ------------------------------------------------------------------------------

-- [Tabel 1/8]: public.admin_users
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(150),
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- [Tabel 2/8]: public.services
CREATE TABLE IF NOT EXISTS public.services (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(80) NOT NULL DEFAULT 'tuns',
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    duration VARCHAR(80) NOT NULL DEFAULT '40 minute',
    duration_min INT NOT NULL DEFAULT 40,
    popular BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS category VARCHAR(80) DEFAULT 'tuns',
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration VARCHAR(80) DEFAULT '40 minute',
  ADD COLUMN IF NOT EXISTS duration_min INT DEFAULT 40,
  ADD COLUMN IF NOT EXISTS popular BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- [Tabel 3/8]: public.service_addons
CREATE TABLE IF NOT EXISTS public.service_addons (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price_ron NUMERIC(10, 2) NOT NULL DEFAULT 0,
    duration_min INT NOT NULL DEFAULT 10,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    popular BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.service_addons
  ADD COLUMN IF NOT EXISTS id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS price_ron NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_min INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS popular BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- [Tabel 4/8]: public.bookings
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(32) NOT NULL,
    client_name VARCHAR(150) NOT NULL,
    client_email VARCHAR(150) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    service_id VARCHAR(100) NOT NULL,
    service_name VARCHAR(200) NOT NULL,
    barber_name VARCHAR(100) DEFAULT 'Roxana Teușde (Buie)',
    event_date DATE NOT NULL,
    event_time VARCHAR(20) NOT NULL,
    duration_min INT NOT NULL DEFAULT 40,
    location VARCHAR(200) DEFAULT 'Atelier Tileagd',
    guests_count INT DEFAULT 1,
    estimated_total NUMERIC(10, 2) DEFAULT 0,
    deposit_amount NUMERIC(10, 2) DEFAULT 0,
    notes TEXT DEFAULT '',
    addons JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(30) DEFAULT 'in_asteptare',
    admin_notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS reference_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS client_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS client_email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS client_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS service_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS service_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS barber_name VARCHAR(100) DEFAULT 'Roxana Teușde (Buie)',
  ADD COLUMN IF NOT EXISTS event_date DATE,
  ADD COLUMN IF NOT EXISTS event_time VARCHAR(20),
  ADD COLUMN IF NOT EXISTS duration_min INT DEFAULT 40,
  ADD COLUMN IF NOT EXISTS location VARCHAR(200) DEFAULT 'Atelier Tileagd',
  ADD COLUMN IF NOT EXISTS guests_count INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS estimated_total NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS addons JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'in_asteptare',
  ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- [Tabel 5/8]: public.reviews
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_name VARCHAR(150) NOT NULL,
    role_or_event VARCHAR(150) NOT NULL DEFAULT 'Client Atelier',
    rating INT NOT NULL,
    text TEXT NOT NULL,
    event_date VARCHAR(50) DEFAULT '',
    avatar_url TEXT DEFAULT '',
    approved BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS author_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS role_or_event VARCHAR(150) DEFAULT 'Client Atelier',
  ADD COLUMN IF NOT EXISTS rating INT,
  ADD COLUMN IF NOT EXISTS text TEXT,
  ADD COLUMN IF NOT EXISTS event_date VARCHAR(50) DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- [Tabel 6/8]: public.gallery_items
CREATE TABLE IF NOT EXISTS public.gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    category VARCHAR(80) NOT NULL,
    media_type VARCHAR(20) NOT NULL,
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

ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS category VARCHAR(80) DEFAULT 'fade',
  ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT 'photo',
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(20) DEFAULT 'square',
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS event_date VARCHAR(50) DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_names VARCHAR(150) DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- [Tabel 7/8]: public.admin_auth_audit
CREATE TABLE IF NOT EXISTS public.admin_auth_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_agent TEXT DEFAULT '',
    city VARCHAR(100) DEFAULT 'Tileagd, Bihor',
    failure_reason TEXT
);

ALTER TABLE public.admin_auth_audit
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS username VARCHAR(150),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS user_agent TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'Tileagd, Bihor',
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- [Tabel 8/8]: public.pfa_settings
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
    site_images JSONB DEFAULT '{"heroBgUrl":"/assets/aistudio/pt_site_ef4b9a1a.jpg","aboutPhotoUrl":"/assets/aistudio/fata_bruneta_2_60013457.jpg","salonBannerUrl":"/assets/aistudio/pt_site_ef4b9a1a.jpg"}'::jsonb,
    gallery_settings JSONB DEFAULT '{"badgeText":"Hair & Beauty Atelier","title":"Descoperă Stilul și Frumusețea alături de Roxana Teușde (Buie)","subtitle":"Fiecare stil este unic, iar fiecare transformare pune în valoare personalitatea ta. De la tunsori moderne și coafuri elegante, până la schimbări de look, culoare și styling, fiecare detaliu este realizat cu profesionalism, pasiune și atenție.","tags":[{"id":"all","label":"Toate Lucrările"},{"id":"barbati","label":"Tunsori Bărbați"},{"id":"femei","label":"Tunsori Femei"},{"id":"coafuri","label":"Coafuri"},{"id":"vopsit","label":"Vopsit & Culoare"},{"id":"styling","label":"Styling & Finisaje"},{"id":"transformari","label":"Transformări de Look"},{"id":"video","label":"Video & Inspirație"}]}'::jsonb,
    services_settings JSONB DEFAULT '{"badgeText":"Meniu Servicii & Tarife Frizerie","title":"Îngrijire Masculină Fără Compromis","subtitle":"Fiecare serviciu este realizat cu atenție, pasiune și profesionalism, folosind produse de calitate și tehnici adaptate stilului și dorințelor tale.","tags":[{"id":"all","label":"Toate Serviciile & Produsele"},{"id":"tuns","label":"Tunsori Masculine"},{"id":"barba","label":"Barbă & Bărbierit"},{"id":"pachet","label":"Pachete Complete"},{"id":"tratamente","label":"Tratamente Faciale"},{"id":"coafura","label":"Coafură Damă"},{"id":"produse","label":"Produse Styling"}]}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.pfa_settings
  ADD COLUMN IF NOT EXISTS id VARCHAR(50) DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS brand_name VARCHAR(150) DEFAULT 'TEUȘDE ROXANA-LENUȚA PERSOANĂ FIZICĂ AUTORIZATĂ',
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(150) DEFAULT 'Roxana-Lenuța Teușde',
  ADD COLUMN IF NOT EXISTS cui VARCHAR(50) DEFAULT '50143520',
  ADD COLUMN IF NOT EXISTS reg_com VARCHAR(50) DEFAULT 'F2024000617057',
  ADD COLUMN IF NOT EXISTS registration_date VARCHAR(50) DEFAULT '28.05.2024',
  ADD COLUMN IF NOT EXISTS caen_code VARCHAR(100) DEFAULT '9621 · Rev. 3 — Activități de coafură și frizerie',
  ADD COLUMN IF NOT EXISTS address VARCHAR(200) DEFAULT 'Str. PLOPILOR, Nr. 28, Cod poștal 417585, Tileagd, Bihor',
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT '+40 751 676 420',
  ADD COLUMN IF NOT EXISTS email VARCHAR(100) DEFAULT 'contact@roxanateusde.ro',
  ADD COLUMN IF NOT EXISTS hours_weekday VARCHAR(100) DEFAULT 'Marți - Vineri: 09:00 - 16:00',
  ADD COLUMN IF NOT EXISTS hours_saturday VARCHAR(100) DEFAULT '09:00 - 13:00',
  ADD COLUMN IF NOT EXISTS hours_sunday VARCHAR(50) DEFAULT 'Luni și Duminică: Închis',
  ADD COLUMN IF NOT EXISTS about_bio TEXT,
  ADD COLUMN IF NOT EXISTS site_images JSONB DEFAULT '{"heroBgUrl":"/assets/aistudio/pt_site_ef4b9a1a.jpg","aboutPhotoUrl":"/assets/aistudio/fata_bruneta_2_60013457.jpg","salonBannerUrl":"/assets/aistudio/pt_site_ef4b9a1a.jpg"}'::jsonb,
  ADD COLUMN IF NOT EXISTS gallery_settings JSONB DEFAULT '{"badgeText":"Hair & Beauty Atelier","title":"Descoperă Stilul și Frumusețea alături de Roxana Teușde (Buie)","subtitle":"Fiecare stil este unic, iar fiecare transformare pune în valoare personalitatea ta. De la tunsori moderne și coafuri elegante, până la schimbări de look, culoare și styling, fiecare detaliu este realizat cu profesionalism, pasiune și atenție.","tags":[{"id":"all","label":"Toate Lucrările"},{"id":"barbati","label":"Tunsori Bărbați"},{"id":"femei","label":"Tunsori Femei"},{"id":"coafuri","label":"Coafuri"},{"id":"vopsit","label":"Vopsit & Culoare"},{"id":"styling","label":"Styling & Finisaje"},{"id":"transformari","label":"Transformări de Look"},{"id":"video","label":"Video & Inspirație"}]}'::jsonb,
  ADD COLUMN IF NOT EXISTS services_settings JSONB DEFAULT '{"badgeText":"Meniu Servicii & Tarife Frizerie","title":"Îngrijire Masculină Fără Compromis","subtitle":"Fiecare serviciu este realizat cu atenție, pasiune și profesionalism, folosind produse de calitate și tehnici adaptate stilului și dorințelor tale.","tags":[{"id":"all","label":"Toate Serviciile & Produsele"},{"id":"tuns","label":"Tunsori Masculine"},{"id":"barba","label":"Barbă & Bărbierit"},{"id":"pachet","label":"Pachete Complete"},{"id":"tratamente","label":"Tratamente Faciale"},{"id":"coafura","label":"Coafură Damă"},{"id":"produse","label":"Produse Styling"}]}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- ------------------------------------------------------------------------------
-- 1.2 Populare inițială non-distructivă (WHERE NOT EXISTS) pentru servicii,
--     tratamente extra și setări PFA, astfel încât programările existente care
--     referă serviciile standard să aibă referințe valide înainte de auditul FK.
--     Nu suprascrie niciodată datele deja existente!
-- ------------------------------------------------------------------------------
INSERT INTO public.pfa_settings (
  id, brand_name, owner_name, cui, reg_com, registration_date, caen_code, address, phone, email
)
SELECT
  'current',
  'TEUȘDE ROXANA-LENUȚA PERSOANĂ FIZICĂ AUTORIZATĂ',
  'Roxana-Lenuța Teușde',
  '50143520',
  'F2024000617057',
  '28.05.2024',
  '9621 · Rev. 3 — Activități de coafură și frizerie',
  'Str. PLOPILOR, Nr. 28, Cod poștal 417585, Tileagd, Bihor',
  '+40 751 676 420',
  'contact@roxanateusde.ro'
WHERE NOT EXISTS (SELECT 1 FROM public.pfa_settings WHERE id = 'current');

-- Completare non-distructivă a JSONB-urilor publice din pfa_settings dacă sunt NULL
UPDATE public.pfa_settings
SET
  site_images = COALESCE(site_images, '{"heroBgUrl":"/assets/aistudio/pt_site_ef4b9a1a.jpg","aboutPhotoUrl":"/assets/aistudio/fata_bruneta_2_60013457.jpg","salonBannerUrl":"/assets/aistudio/pt_site_ef4b9a1a.jpg"}'::jsonb),
  gallery_settings = COALESCE(gallery_settings, '{"badgeText":"Hair & Beauty Atelier","title":"Descoperă Stilul și Frumusețea alături de Roxana Teușde (Buie)","subtitle":"Fiecare stil este unic, iar fiecare transformare pune în valoare personalitatea ta. De la tunsori moderne și coafuri elegante, până la schimbări de look, culoare și styling, fiecare detaliu este realizat cu profesionalism, pasiune și atenție.","tags":[{"id":"all","label":"Toate Lucrările"},{"id":"barbati","label":"Tunsori Bărbați"},{"id":"femei","label":"Tunsori Femei"},{"id":"coafuri","label":"Coafuri"},{"id":"vopsit","label":"Vopsit & Culoare"},{"id":"styling","label":"Styling & Finisaje"},{"id":"transformari","label":"Transformări de Look"},{"id":"video","label":"Video & Inspirație"}]}'::jsonb),
  services_settings = COALESCE(services_settings, '{"badgeText":"Meniu Servicii & Tarife Frizerie","title":"Îngrijire Masculină Fără Compromis","subtitle":"Fiecare serviciu este realizat cu atenție, pasiune și profesionalism, folosind produse de calitate și tehnici adaptate stilului și dorințelor tale.","tags":[{"id":"all","label":"Toate Serviciile & Produsele"},{"id":"tuns","label":"Tunsori Masculine"},{"id":"barba","label":"Barbă & Bărbierit"},{"id":"pachet","label":"Pachete Complete"},{"id":"tratamente","label":"Tratamente Faciale"},{"id":"coafura","label":"Coafură Damă"},{"id":"produse","label":"Produse Styling"}]}'::jsonb),
  hours_weekday = 'Marți - Vineri: 09:00 - 16:00',
  hours_saturday = '09:00 - 13:00',
  hours_sunday = 'Luni și Duminică: Închis'
WHERE id = 'current';

INSERT INTO public.services (id, title, category, price, duration, duration_min, popular, description, image_url, features, order_index)
SELECT v.id, v.title, v.category, v.price, v.duration, v.duration_min, v.popular, v.description, v.image_url, v.features::jsonb, v.order_index
FROM (
  VALUES
    ('tuns-skin-fade', 'Tuns Modern Skin Fade / Taper', 'tuns', 70::numeric, '40 minute', 40, false, 'Tranziție impecabilă de la zero pe lateral, adaptată formei craniului și texturii părului tău.', 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80', '["Consiliere stil și fizionomie înainte de tuns","Fade milimetric cu mașini profesionale Wahl & Babyliss","Contur precis cu briciul și cremă transparentă","Spălat dublu cu șampon energizant mentolat","Styling cu ceară mată sau pomadă pe bază de apă"]', 1),
    ('pachet-gentleman-vip', 'Pachetul Complet "The Gentleman"', 'pachet', 110::numeric, '65 minute', 65, true, 'Experiența completă de răsfăț masculin. Tuns, bărbierit cu prosop cald, spălat și tratament.', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80', '["Tuns complet la foarfecă sau fade la alegere","Ritual de bărbierit tradițional cu prosop fierbinte","Tratament cu aburi și uleiuri esențiale de eucalipt","Contur milimetric la briciul japonez","Spălat dublu + masaj capilar revigorant","Balsam aftershave calmant + ulei de barbă premium","Cafea espresso sau whiskey din partea casei"]', 2),
    ('aranjat-barba-prosop', 'Bărbierit Tradițional & Sculptat Barbă', 'barba', 50::numeric, '30 minute', 30, false, 'Îngrijire dedicată bărbii tale: contur curat, prosop fierbinte și finisare cu briciul.', 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80', '["Aplicare prosop cald pentru deschiderea porilor","Tuns și filat barbă la foarfecă și mașină","Bărbierit și curățare contur gât și pomeți cu briciul","Prosop rece pentru închiderea porilor","Ulei nutritiv de argan și pieptănat la perie de mistreț"]', 3),
    ('tuns-clasic-foarfeca', 'Tuns Clasic Executiv (Exclusiv Foarfecă)', 'tuns', 65::numeric, '40 minute', 40, false, 'Pentru domnii care preferă eleganța discretă a unei tunsori clasice lucrate exclusiv manual.', 'https://images.unsplash.com/photo-1517832606589-7629c3397143?auto=format&fit=crop&w=800&q=80', '["Tuns integral la foarfecă (Side Part, Scissor Cut, Pompadour clasic)","Finisaj ceafă și perciuni cu briciul","Spălat relaxant și uscat la perie","Styling cu tonic și cremă lejeră"]', 4),
    ('father-and-son', 'Pachet Father & Son (Tată & Fiu)', 'pachet', 120::numeric, '60 minute', 60, false, 'Timp de calitate petrecut împreună pe scaunul de frizerie. Două tunsori complete.', 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=800&q=80', '["2 Tunsori complete (1 adult + 1 junior)","Spălat și styling adaptat fiecăruia","Atmosferă relaxată și prietenoasă","Băuturi răcoritoare și cafea incluse"]', 5),
    ('tratament-detox-ten', 'Tratament Facial Black Mask & Masaj Capilar', 'tratamente', 60::numeric, '30 minute', 30, false, 'Curățare profundă a porilor și revitalizare completă a scalpului și a tenului.', 'https://images.unsplash.com/photo-1512290900672-1f55b9e07b8b?auto=format&fit=crop&w=800&q=80', '["Mască neagră detoxifiantă cu cărbune activ pentru zona T","Îndepărtare impurități și puncte negre","Masaj capilar relaxant cu loțiune tonică răcoritoare","Cremă hidratantă matifiantă pentru bărbați"]', 6),
    ('coafura-styling-dama', 'Coafură & Schimbare de Look Damă', 'coafura', 90::numeric, '50 minute', 50, false, 'Servicii de coafură dedicată pentru doamne și domnișoare: aranjat, bucle lejere sau finisaj drept impecabil.', '/assets/aistudio/fata_bruneta_2_60013457.jpg', '["Consiliere de stil și volum în funcție de fizionomie","Spălat cu șampon și mască nutritivă profesională","Uscat la perie / bucle texturate / îndreptat cu protecție termică","Fixare lejeră și ser de strălucire"]', 7),
    ('pudra-styling-reuzel', 'Pudră de Volum Texturantă Reuzel Matte Texture', 'produse', 65::numeric, 'Produs Salon', 0, false, 'Produs profesional de styling pentru finisaj mat și volum instant de la rădăcină. Disponibil direct în salon.', 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80', '["Formulă ultra-lejeră fără senzație lipicioasă","Fixare medie și finisaj 100% mat","Ideal pentru tunsori scurte texturate și crop","Flacon 15g cu dozator de precizie"]', 8)
) AS v(id, title, category, price, duration, duration_min, popular, description, image_url, features, order_index)
WHERE NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = v.id);

INSERT INTO public.service_addons (id, name, price_ron, duration_min, description, image_url, popular, order_index)
SELECT v.id, v.name, v.price_ron, v.duration_min, v.description, v.image_url, v.popular, v.order_index
FROM (
  VALUES
    ('hotTowelTreatment', 'Tratament cu prosop cald și uleiuri esențiale', 25::numeric, 10, 'Prosop fierbinte infuzat cu ulei de eucalipt pentru relaxarea musculaturii faciale și dilatarea porilor.', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80', true, 1),
    ('hairWashStyling', 'Spălat dublu revitalizant + Styling profesional', 20::numeric, 10, 'Șampon mentolat răcoritor cu masaj al scalpului și coafare cu pomadă sau ceară mată.', 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80', false, 2),
    ('blackMask', 'Mască neagră detoxifiantă cu cărbune activ (Black Mask)', 35::numeric, 15, 'Curățare profundă a punctelor negre și impurităților din zona T a feței.', 'https://images.unsplash.com/photo-1512290900672-1f02b947c617?auto=format&fit=crop&w=600&q=80', false, 3),
    ('beardCamouflage', 'Camuflaj & nuanțare fire albe barbă', 40::numeric, 15, 'Colorare semi-permanentă discretă fără tonuri roșiatice pentru un aspect uniform și masculin.', 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&q=80', false, 4),
    ('headMassage', 'Masaj capilar relaxant cu tonic mentolat', 30::numeric, 10, 'Stimulează circulația la rădăcina firului de păr și elimină complet tensiunea acumulată.', 'https://images.unsplash.com/photo-1517832606589-7629c3397143?auto=format&fit=crop&w=600&q=80', false, 5),
    ('eyebrowStyling', 'Stilizare & conturare sprâncene', 15::numeric, 5, 'Curățare exces și definire naturală a arcadei la brici sau pensetă.', 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=600&q=80', false, 6)
) AS v(id, name, price_ron, duration_min, description, image_url, popular, order_index)
WHERE NOT EXISTS (SELECT 1 FROM public.service_addons a WHERE a.id = v.id);

-- ------------------------------------------------------------------------------
-- 1.3 Tabele de Backup și Inventariere (100% Idempotente la rerulare)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users_legacy_backup (
    backup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    row_fingerprint TEXT NOT NULL UNIQUE,
    backed_up_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    reason TEXT NOT NULL,
    raw_row JSONB NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.migration_data_conflicts_backup (
    conflict_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_fingerprint TEXT NOT NULL UNIQUE,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT,
    conflict_type TEXT NOT NULL,
    raw_row JSONB NOT NULL,
    resolution_hint TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.rls_policies_inventory_backup (
    inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schemaname TEXT NOT NULL,
    tablename TEXT NOT NULL,
    policyname TEXT NOT NULL,
    permissive TEXT,
    roles TEXT[],
    cmd TEXT,
    qual TEXT,
    with_check TEXT,
    table_owner TEXT,
    inventoried_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (schemaname, tablename, policyname)
);

ALTER TABLE public.admin_users_legacy_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_data_conflicts_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rls_policies_inventory_backup ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_users_legacy_backup FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.migration_data_conflicts_backup FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.rls_policies_inventory_backup FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 1.4 Inventarierea tuturor politicilor RLS existente înainte de orice modificare
-- ------------------------------------------------------------------------------
INSERT INTO public.rls_policies_inventory_backup (
  schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check, table_owner
)
SELECT
  p.schemaname,
  p.tablename,
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check,
  t.tableowner
FROM pg_policies p
LEFT JOIN pg_tables t
  ON t.schemaname = p.schemaname AND t.tablename = p.tablename
WHERE (
    p.schemaname = 'public'
    AND p.tablename IN (
      'admin_users', 'services', 'service_addons', 'bookings',
      'reviews', 'gallery_items', 'admin_auth_audit', 'pfa_settings'
    )
  )
  OR (p.schemaname = 'storage' AND p.tablename = 'objects')
ON CONFLICT (schemaname, tablename, policyname) DO UPDATE SET
  permissive = EXCLUDED.permissive,
  roles = EXCLUDED.roles,
  cmd = EXCLUDED.cmd,
  qual = EXCLUDED.qual,
  with_check = EXCLUDED.with_check,
  table_owner = EXCLUDED.table_owner,
  inventoried_at = timezone('utc'::text, now());

-- ------------------------------------------------------------------------------
-- 1.5 Auditul complet al datelor existente pe toate cele 8 tabele și salvarea
--     idempotentă în tabelele de backup (fără ștergere automată!)
-- ------------------------------------------------------------------------------

-- Resetăm marcajul conflictelor anterioare doar dacă rândurile au fost deja corectate
DELETE FROM public.migration_data_conflicts_backup WHERE resolved = FALSE;

-- A. Backup și audit pentru public.admin_users
INSERT INTO public.admin_users_legacy_backup (row_fingerprint, reason, raw_row)
SELECT
  md5(to_jsonb(a.*)::text),
  CASE
    WHEN a.user_id IS NULL THEN 'MISSING_USER_ID'
    WHEN NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.user_id) THEN 'ORPHAN_AUTH_USER_ID'
    WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.user_id AND u.email_confirmed_at IS NULL) THEN 'UNCONFIRMED_AUTH_EMAIL'
    WHEN a.email IS NULL OR trim(a.email) = '' THEN 'MISSING_ADMIN_EMAIL'
    WHEN a.role IS NULL OR a.role NOT IN ('admin', 'super_admin') THEN 'INVALID_ADMIN_ROLE'
    ELSE 'LEGACY_ADMIN_ROW'
  END,
  to_jsonb(a.*)
FROM public.admin_users a
WHERE a.user_id IS NULL
   OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.user_id)
   OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.user_id AND u.email_confirmed_at IS NULL)
   OR a.email IS NULL OR trim(a.email) = ''
   OR a.role IS NULL OR a.role NOT IN ('admin', 'super_admin')
ON CONFLICT (row_fingerprint) DO NOTHING;

-- Duplicate user_id sau email în admin_users
INSERT INTO public.migration_data_conflicts_backup (
  conflict_fingerprint, table_name, record_id, conflict_type, raw_row, resolution_hint
)
SELECT
  'admin_users::DUPLICATE_USER_ID_OR_EMAIL::' || md5(to_jsonb(a.*)::text),
  'admin_users',
  COALESCE(a.user_id::text, a.email, 'NULL'),
  'DUPLICATE_USER_ID_OR_EMAIL',
  to_jsonb(a.*),
  'Eliminați sau unificați manual rândurile duplicate din public.admin_users.'
FROM public.admin_users a
WHERE (a.user_id IS NOT NULL AND (SELECT count(*) FROM public.admin_users a2 WHERE a2.user_id = a.user_id) > 1)
   OR (a.email IS NOT NULL AND (SELECT count(*) FROM public.admin_users a3 WHERE lower(trim(a3.email)) = lower(trim(a.email))) > 1)
ON CONFLICT (conflict_fingerprint) DO NOTHING;

-- Mai mult de un super_admin activ simultan
INSERT INTO public.migration_data_conflicts_backup (
  conflict_fingerprint, table_name, record_id, conflict_type, raw_row, resolution_hint
)
SELECT
  'admin_users::MULTIPLE_ACTIVE_SUPER_ADMINS::' || COALESCE(a.user_id::text, a.email, 'NULL'),
  'admin_users',
  COALESCE(a.user_id::text, a.email, 'NULL'),
  'MULTIPLE_ACTIVE_SUPER_ADMINS',
  to_jsonb(a.*),
  'Păstrați un singur cont cu role = ''super_admin'' și active = true, iar pe celelalte setați role = ''admin''.'
FROM public.admin_users a
WHERE a.active = TRUE AND a.role = 'super_admin'
  AND (SELECT count(*) FROM public.admin_users s WHERE s.active = TRUE AND s.role = 'super_admin') > 1
ON CONFLICT (conflict_fingerprint) DO NOTHING;

-- B. Audit pentru public.services (NULL, duplicate ID, preț negativ, durată invalidă, features non-array)
INSERT INTO public.migration_data_conflicts_backup (
  conflict_fingerprint, table_name, record_id, conflict_type, raw_row, resolution_hint
)
SELECT
  'services::INVALID_SERVICE_ROW::' || COALESCE(s.id, md5(to_jsonb(s.*)::text)),
  'services',
  COALESCE(s.id, 'NULL'),
  CASE
    WHEN s.id IS NULL OR trim(s.id) = '' THEN 'NULL_OR_EMPTY_PRIMARY_KEY'
    WHEN (SELECT count(*) FROM public.services s2 WHERE s2.id = s.id) > 1 THEN 'DUPLICATE_PRIMARY_KEY'
    WHEN s.title IS NULL OR trim(s.title) = '' THEN 'NULL_OR_EMPTY_TITLE'
    WHEN s.category IS NULL OR trim(s.category) = '' THEN 'NULL_OR_EMPTY_CATEGORY'
    WHEN s.price IS NULL OR s.price < 0 THEN 'NEGATIVE_OR_NULL_PRICE'
    WHEN s.duration_min IS NULL OR s.duration_min < 0 OR s.duration_min > 480 THEN 'INVALID_DURATION_MIN'
    WHEN s.category <> 'produse' AND s.duration_min <= 0 THEN 'NON_PRODUCT_ZERO_DURATION'
    WHEN s.features IS NULL OR jsonb_typeof(s.features) <> 'array' THEN 'INVALID_FEATURES_JSONB'
    ELSE 'INVALID_SERVICE_ROW'
  END,
  to_jsonb(s.*),
  'Corectați prețul (>= 0), durata (1..480 min pentru servicii, 0 pentru produse), titlul și ID-ul în public.services.'
FROM public.services s
WHERE s.id IS NULL OR trim(s.id) = ''
   OR (SELECT count(*) FROM public.services s2 WHERE s2.id = s.id) > 1
   OR s.title IS NULL OR trim(s.title) = ''
   OR s.category IS NULL OR trim(s.category) = ''
   OR s.price IS NULL OR s.price < 0
   OR s.duration_min IS NULL OR s.duration_min < 0 OR s.duration_min > 480
   OR (s.category <> 'produse' AND s.duration_min <= 0)
   OR s.features IS NULL OR jsonb_typeof(s.features) <> 'array'
ON CONFLICT (conflict_fingerprint) DO NOTHING;

-- C. Audit pentru public.service_addons (NULL, duplicate ID, preț negativ, durată invalidă)
INSERT INTO public.migration_data_conflicts_backup (
  conflict_fingerprint, table_name, record_id, conflict_type, raw_row, resolution_hint
)
SELECT
  'service_addons::INVALID_ADDON_ROW::' || COALESCE(a.id, md5(to_jsonb(a.*)::text)),
  'service_addons',
  COALESCE(a.id, 'NULL'),
  CASE
    WHEN a.id IS NULL OR trim(a.id) = '' THEN 'NULL_OR_EMPTY_PRIMARY_KEY'
    WHEN (SELECT count(*) FROM public.service_addons a2 WHERE a2.id = a.id) > 1 THEN 'DUPLICATE_PRIMARY_KEY'
    WHEN a.name IS NULL OR trim(a.name) = '' THEN 'NULL_OR_EMPTY_NAME'
    WHEN a.price_ron IS NULL OR a.price_ron < 0 THEN 'NEGATIVE_OR_NULL_PRICE'
    WHEN a.duration_min IS NULL OR a.duration_min <= 0 OR a.duration_min > 240 THEN 'INVALID_DURATION_MIN'
    ELSE 'INVALID_ADDON_ROW'
  END,
  to_jsonb(a.*),
  'Corectați prețul (>= 0), durata (1..240 min), denumirea și ID-ul în public.service_addons.'
FROM public.service_addons a
WHERE a.id IS NULL OR trim(a.id) = ''
   OR (SELECT count(*) FROM public.service_addons a2 WHERE a2.id = a.id) > 1
   OR a.name IS NULL OR trim(a.name) = ''
   OR a.price_ron IS NULL OR a.price_ron < 0
   OR a.duration_min IS NULL OR a.duration_min <= 0 OR a.duration_min > 240
ON CONFLICT (conflict_fingerprint) DO NOTHING;

-- D. Sincronizare non-distructivă a duratei reale pe programările existente (unde duration_min lipsea)
UPDATE public.bookings b
SET duration_min = GREATEST(
  15,
  COALESCE(s.duration_min, 40) + COALESCE((
    SELECT COALESCE(SUM(sa.duration_min), 0)
    FROM jsonb_each_text(COALESCE(b.addons, '{}'::jsonb)) AS kv(k, v)
    INNER JOIN public.service_addons sa ON sa.id = kv.k
    WHERE kv.v = 'true'
  ), 0)
)
FROM public.services s
WHERE b.service_id = s.id
  AND (b.duration_min IS NULL OR b.duration_min <= 0);

-- E. Audit pentru public.bookings:
--    1. Valori NULL sau câmpuri obligatorii goale
--    2. Duplicate pe id sau reference_code
--    3. Servicii principale inexistente (orphan service_id) sau produse neprogramabile
--    4. Tratamente suplimentare (addons) inexistente în public.service_addons
--    5. Prețuri negative, status invalid, format oră invalid
INSERT INTO public.migration_data_conflicts_backup (
  conflict_fingerprint, table_name, record_id, conflict_type, raw_row, resolution_hint
)
SELECT
  'bookings::STRUCTURAL_OR_FK_CONFLICT::' || COALESCE(b.id::text, b.reference_code, md5(to_jsonb(b.*)::text)),
  'bookings',
  COALESCE(b.id::text, b.reference_code, 'NULL'),
  CASE
    WHEN b.id IS NULL THEN 'NULL_PRIMARY_KEY'
    WHEN (SELECT count(*) FROM public.bookings b2 WHERE b2.id = b.id) > 1 THEN 'DUPLICATE_PRIMARY_KEY'
    WHEN b.reference_code IS NULL OR trim(b.reference_code) = '' THEN 'NULL_OR_EMPTY_REFERENCE_CODE'
    WHEN (SELECT count(*) FROM public.bookings b3 WHERE b3.reference_code = b.reference_code) > 1 THEN 'DUPLICATE_REFERENCE_CODE'
    WHEN b.client_name IS NULL OR length(trim(b.client_name)) < 2 THEN 'INVALID_CLIENT_NAME'
    WHEN b.client_phone IS NULL OR length(trim(b.client_phone)) < 6 THEN 'INVALID_CLIENT_PHONE'
    WHEN b.client_email IS NULL OR trim(b.client_email) = '' THEN 'INVALID_CLIENT_EMAIL'
    WHEN b.service_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = b.service_id) THEN 'ORPHAN_SERVICE_ID'
    WHEN EXISTS (SELECT 1 FROM public.services s WHERE s.id = b.service_id AND (s.category = 'produse' OR s.duration_min <= 0)) THEN 'NON_SCHEDULABLE_PRODUCT_BOOKING'
    WHEN b.addons IS NULL OR jsonb_typeof(b.addons) <> 'object' THEN 'INVALID_ADDONS_JSONB'
    WHEN EXISTS (
      SELECT 1
      FROM jsonb_each_text(COALESCE(b.addons, '{}'::jsonb)) kv(k, v)
      WHERE kv.v = 'true'
        AND NOT EXISTS (SELECT 1 FROM public.service_addons sa WHERE sa.id = kv.k)
    ) THEN 'ORPHAN_SERVICE_ADDON_KEY'
    WHEN b.event_date IS NULL THEN 'NULL_EVENT_DATE'
    WHEN b.event_time IS NULL OR b.event_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN 'INVALID_EVENT_TIME_FORMAT'
    WHEN b.duration_min IS NULL OR b.duration_min < 5 OR b.duration_min > 480 THEN 'INVALID_DURATION_MIN'
    WHEN b.estimated_total IS NULL OR b.estimated_total < 0 THEN 'NEGATIVE_OR_NULL_ESTIMATED_TOTAL'
    WHEN b.deposit_amount IS NULL OR b.deposit_amount < 0 THEN 'NEGATIVE_OR_NULL_DEPOSIT'
    WHEN b.guests_count IS NULL OR b.guests_count < 1 THEN 'INVALID_GUESTS_COUNT'
    WHEN b.status IS NULL OR b.status NOT IN ('in_asteptare', 'confirmat', 'finalizat', 'anulat') THEN 'INVALID_BOOKING_STATUS'
    ELSE 'INVALID_BOOKING_ROW'
  END,
  to_jsonb(b.*),
  'Verificați service_id, cheile din addons, reference_code, formatul orei HH:MM și valorile numerice din public.bookings.'
FROM public.bookings b
WHERE b.id IS NULL
   OR (SELECT count(*) FROM public.bookings b2 WHERE b2.id = b.id) > 1
   OR b.reference_code IS NULL OR trim(b.reference_code) = ''
   OR (SELECT count(*) FROM public.bookings b3 WHERE b3.reference_code = b.reference_code) > 1
   OR b.client_name IS NULL OR length(trim(b.client_name)) < 2
   OR b.client_phone IS NULL OR length(trim(b.client_phone)) < 6
   OR b.client_email IS NULL OR trim(b.client_email) = ''
   OR b.service_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = b.service_id)
   OR EXISTS (SELECT 1 FROM public.services s WHERE s.id = b.service_id AND (s.category = 'produse' OR s.duration_min <= 0))
   OR b.addons IS NULL OR jsonb_typeof(b.addons) <> 'object'
   OR EXISTS (
     SELECT 1
     FROM jsonb_each_text(COALESCE(b.addons, '{}'::jsonb)) kv(k, v)
     WHERE kv.v = 'true'
       AND NOT EXISTS (SELECT 1 FROM public.service_addons sa WHERE sa.id = kv.k)
   )
   OR b.event_date IS NULL
   OR b.event_time IS NULL OR b.event_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   OR b.duration_min IS NULL OR b.duration_min < 5 OR b.duration_min > 480
   OR b.estimated_total IS NULL OR b.estimated_total < 0
   OR b.deposit_amount IS NULL OR b.deposit_amount < 0
   OR b.guests_count IS NULL OR b.guests_count < 1
   OR b.status IS NULL OR b.status NOT IN ('in_asteptare', 'confirmat', 'finalizat', 'anulat')
ON CONFLICT (conflict_fingerprint) DO NOTHING;

-- F. Audit pentru programările active (status IN ('in_asteptare', 'confirmat')) în afara programului
--    Luni: ÎNCHIS (1), Marți-Vineri: 09:00 - 16:00 (540..960), Sâmbătă: 09:00 - 13:00 (540..780), Duminică: ÎNCHIS (0)
INSERT INTO public.migration_data_conflicts_backup (
  conflict_fingerprint, table_name, record_id, conflict_type, raw_row, resolution_hint
)
SELECT
  'bookings::OUTSIDE_WORKING_HOURS::' || b.id::text,
  'bookings',
  b.id::text,
  'ACTIVE_BOOKING_OUTSIDE_WORKING_HOURS',
  to_jsonb(b.*),
  'Reprogramați rezervarea în programul Marți-Vineri 09:00-16:00 / Sâmbătă 09:00-13:00 (Luni și Duminică este ÎNCHIS), adăugați [EXCEPTIE_PROGRAM] în admin_notes sau setați status = ''anulat'' / ''finalizat''.'
FROM public.bookings b
WHERE b.status IN ('in_asteptare', 'confirmat')
  AND COALESCE(b.admin_notes, '') NOT LIKE '%[EXCEPTIE_PROGRAM]%'
  AND b.event_date IS NOT NULL
  AND b.event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND (
    EXTRACT(DOW FROM b.event_date)::int IN (0, 1)
    OR (
      EXTRACT(DOW FROM b.event_date)::int BETWEEN 2 AND 5
      AND (
        (split_part(b.event_time, ':', 1)::int * 60 + split_part(b.event_time, ':', 2)::int) < 540
        OR (split_part(b.event_time, ':', 1)::int * 60 + split_part(b.event_time, ':', 2)::int) + COALESCE(b.duration_min, 40) > 960
      )
    )
    OR (
      EXTRACT(DOW FROM b.event_date)::int = 6
      AND (
        (split_part(b.event_time, ':', 1)::int * 60 + split_part(b.event_time, ':', 2)::int) < 540
        OR (split_part(b.event_time, ':', 1)::int * 60 + split_part(b.event_time, ':', 2)::int) + COALESCE(b.duration_min, 40) > 780
      )
    )
  )
ON CONFLICT (conflict_fingerprint) DO NOTHING;

-- G. Audit pentru programările active suprapuse (același frizer și aceeași dată)
INSERT INTO public.migration_data_conflicts_backup (
  conflict_fingerprint, table_name, record_id, conflict_type, raw_row, resolution_hint
)
SELECT DISTINCT
  'bookings::OVERLAPPING_ACTIVE_BOOKING::' || b1.id::text,
  'bookings',
  b1.id::text,
  'OVERLAPPING_ACTIVE_BOOKING',
  to_jsonb(b1.*),
  'Două programări active pe același frizer și aceeași dată se suprapun ca durată. Modificați ora sau setați statusul uneia pe ''anulat''.'
FROM public.bookings b1
INNER JOIN public.bookings b2
  ON b1.id <> b2.id
 AND b1.event_date = b2.event_date
 AND lower(trim(COALESCE(b1.barber_name, 'Roxana Teușde (Buie)'))) = lower(trim(COALESCE(b2.barber_name, 'Roxana Teușde (Buie)')))
WHERE b1.status IN ('in_asteptare', 'confirmat')
  AND b2.status IN ('in_asteptare', 'confirmat')
  AND b1.event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND b2.event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND (split_part(b1.event_time, ':', 1)::int * 60 + split_part(b1.event_time, ':', 2)::int)
      < ((split_part(b2.event_time, ':', 1)::int * 60 + split_part(b2.event_time, ':', 2)::int) + COALESCE(b2.duration_min, 40))
  AND ((split_part(b1.event_time, ':', 1)::int * 60 + split_part(b1.event_time, ':', 2)::int) + COALESCE(b1.duration_min, 40))
      > (split_part(b2.event_time, ':', 1)::int * 60 + split_part(b2.event_time, ':', 2)::int)
ON CONFLICT (conflict_fingerprint) DO NOTHING;

-- H. Audit pentru public.reviews
INSERT INTO public.migration_data_conflicts_backup (
  conflict_fingerprint, table_name, record_id, conflict_type, raw_row, resolution_hint
)
SELECT
  'reviews::INVALID_REVIEW_ROW::' || COALESCE(r.id::text, md5(to_jsonb(r.*)::text)),
  'reviews',
  COALESCE(r.id::text, 'NULL'),
  CASE
    WHEN r.id IS NULL THEN 'NULL_PRIMARY_KEY'
    WHEN (SELECT count(*) FROM public.reviews r2 WHERE r2.id = r.id) > 1 THEN 'DUPLICATE_PRIMARY_KEY'
    WHEN r.author_name IS NULL OR length(trim(r.author_name)) < 2 THEN 'INVALID_AUTHOR_NAME'
    WHEN r.text IS NULL OR length(trim(r.text)) < 2 THEN 'INVALID_REVIEW_TEXT'
    WHEN r.rating IS NULL OR r.rating < 1 OR r.rating > 5 THEN 'INVALID_RATING_RANGE'
    WHEN r.approved IS NULL THEN 'NULL_APPROVED_FLAG'
    ELSE 'INVALID_REVIEW_ROW'
  END,
  to_jsonb(r.*),
  'Verificați rating-ul (1..5), author_name, text și id în public.reviews.'
FROM public.reviews r
WHERE r.id IS NULL
   OR (SELECT count(*) FROM public.reviews r2 WHERE r2.id = r.id) > 1
   OR r.author_name IS NULL OR length(trim(r.author_name)) < 2
   OR r.text IS NULL OR length(trim(r.text)) < 2
   OR r.rating IS NULL OR r.rating < 1 OR r.rating > 5
   OR r.approved IS NULL
ON CONFLICT (conflict_fingerprint) DO NOTHING;

-- I. Audit pentru public.gallery_items
INSERT INTO public.migration_data_conflicts_backup (
  conflict_fingerprint, table_name, record_id, conflict_type, raw_row, resolution_hint
)
SELECT
  'gallery_items::INVALID_GALLERY_ROW::' || COALESCE(g.id::text, md5(to_jsonb(g.*)::text)),
  'gallery_items',
  COALESCE(g.id::text, 'NULL'),
  CASE
    WHEN g.id IS NULL THEN 'NULL_PRIMARY_KEY'
    WHEN (SELECT count(*) FROM public.gallery_items g2 WHERE g2.id = g.id) > 1 THEN 'DUPLICATE_PRIMARY_KEY'
    WHEN g.title IS NULL OR trim(g.title) = '' THEN 'NULL_OR_EMPTY_TITLE'
    WHEN g.category IS NULL OR trim(g.category) = '' THEN 'NULL_OR_EMPTY_CATEGORY'
    WHEN g.media_type IS NULL OR g.media_type NOT IN ('photo', 'video') THEN 'INVALID_MEDIA_TYPE'
    WHEN g.media_url IS NULL OR trim(g.media_url) = '' THEN 'NULL_OR_EMPTY_MEDIA_URL'
    ELSE 'INVALID_GALLERY_ROW'
  END,
  to_jsonb(g.*),
  'Verificați media_type (''photo'' sau ''video''), media_url, title și category în public.gallery_items.'
FROM public.gallery_items g
WHERE g.id IS NULL
   OR (SELECT count(*) FROM public.gallery_items g2 WHERE g2.id = g.id) > 1
   OR g.title IS NULL OR trim(g.title) = ''
   OR g.category IS NULL OR trim(g.category) = ''
   OR g.media_type IS NULL OR g.media_type NOT IN ('photo', 'video')
   OR g.media_url IS NULL OR trim(g.media_url) = ''
ON CONFLICT (conflict_fingerprint) DO NOTHING;

-- J. Audit pentru public.admin_auth_audit
INSERT INTO public.migration_data_conflicts_backup (
  conflict_fingerprint, table_name, record_id, conflict_type, raw_row, resolution_hint
)
SELECT
  'admin_auth_audit::INVALID_AUDIT_ROW::' || COALESCE(a.id::text, md5(to_jsonb(a.*)::text)),
  'admin_auth_audit',
  COALESCE(a.id::text, 'NULL'),
  CASE
    WHEN a.id IS NULL THEN 'NULL_PRIMARY_KEY'
    WHEN (SELECT count(*) FROM public.admin_auth_audit a2 WHERE a2.id = a.id) > 1 THEN 'DUPLICATE_PRIMARY_KEY'
    WHEN a.username IS NULL OR trim(a.username) = '' THEN 'NULL_OR_EMPTY_USERNAME'
    WHEN a.status IS NULL OR a.status NOT IN ('SUCCESS', 'FAILED', 'LOGOUT') THEN 'INVALID_AUDIT_STATUS'
    WHEN a.timestamp IS NULL THEN 'NULL_TIMESTAMP'
    ELSE 'INVALID_AUDIT_ROW'
  END,
  to_jsonb(a.*),
  'Verificați statusul (SUCCESS, FAILED, LOGOUT) și username-ul în public.admin_auth_audit.'
FROM public.admin_auth_audit a
WHERE a.id IS NULL
   OR (SELECT count(*) FROM public.admin_auth_audit a2 WHERE a2.id = a.id) > 1
   OR a.username IS NULL OR trim(a.username) = ''
   OR a.status IS NULL OR a.status NOT IN ('SUCCESS', 'FAILED', 'LOGOUT')
   OR a.timestamp IS NULL
ON CONFLICT (conflict_fingerprint) DO NOTHING;

-- K. Audit pentru public.pfa_settings
INSERT INTO public.migration_data_conflicts_backup (
  conflict_fingerprint, table_name, record_id, conflict_type, raw_row, resolution_hint
)
SELECT
  'pfa_settings::INVALID_PFA_ROW::' || COALESCE(p.id, md5(to_jsonb(p.*)::text)),
  'pfa_settings',
  COALESCE(p.id, 'NULL'),
  CASE
    WHEN p.id IS NULL OR trim(p.id) = '' THEN 'NULL_OR_EMPTY_PRIMARY_KEY'
    WHEN (SELECT count(*) FROM public.pfa_settings p2 WHERE p2.id = p.id) > 1 THEN 'DUPLICATE_PRIMARY_KEY'
    WHEN p.brand_name IS NULL OR trim(p.brand_name) = '' THEN 'NULL_OR_EMPTY_BRAND_NAME'
    WHEN p.cui IS NULL OR trim(p.cui) = '' THEN 'NULL_OR_EMPTY_CUI'
    WHEN p.site_images IS NULL OR jsonb_typeof(p.site_images) <> 'object' THEN 'INVALID_SITE_IMAGES_JSONB'
    WHEN p.gallery_settings IS NULL OR jsonb_typeof(p.gallery_settings) <> 'object' THEN 'INVALID_GALLERY_SETTINGS_JSONB'
    WHEN p.services_settings IS NULL OR jsonb_typeof(p.services_settings) <> 'object' THEN 'INVALID_SERVICES_SETTINGS_JSONB'
    ELSE 'INVALID_PFA_ROW'
  END,
  to_jsonb(p.*),
  'Verificați rândul current din public.pfa_settings.'
FROM public.pfa_settings p
WHERE p.id IS NULL OR trim(p.id) = ''
   OR (SELECT count(*) FROM public.pfa_settings p2 WHERE p2.id = p.id) > 1
   OR p.brand_name IS NULL OR trim(p.brand_name) = ''
   OR p.cui IS NULL OR trim(p.cui) = ''
   OR p.site_images IS NULL OR jsonb_typeof(p.site_images) <> 'object'
   OR p.gallery_settings IS NULL OR jsonb_typeof(p.gallery_settings) <> 'object'
   OR p.services_settings IS NULL OR jsonb_typeof(p.services_settings) <> 'object'
ON CONFLICT (conflict_fingerprint) DO NOTHING;

COMMIT;

-- ==============================================================================
-- TRANZACȚIA 2: VALIDARE BLOCANTĂ, CHEI PRIMARE & STRĂINE, FUNCȚII SECURITY
--               DEFINER, TRIGGER PROGRAMĂRI, VIEW PUBLIC ȘI POLITICI RLS
-- ==============================================================================
BEGIN;

-- ------------------------------------------------------------------------------
-- 2.1 Verificare blocantă a conflictelor de date și a înregistrărilor admin invalide
--     (Backup-ul din Tranzacția 1 este deja salvat prin COMMIT!)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_issues INT;
  v_data_conflicts INT;
  v_summary TEXT;
BEGIN
  SELECT count(*) INTO v_admin_issues
  FROM public.admin_users a
  WHERE a.user_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.user_id)
     OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.user_id AND u.email_confirmed_at IS NULL)
     OR a.email IS NULL OR trim(a.email) = ''
     OR a.role IS NULL OR a.role NOT IN ('admin', 'super_admin');

  IF v_admin_issues > 0 THEN
    RAISE EXCEPTION 'OPRIRE DE SIGURANȚĂ [admin_users]: S-au găsit % înregistrări invalide în public.admin_users. Toate rândurile au fost salvate în public.admin_users_legacy_backup. Inspectați cu: SELECT * FROM public.admin_users_legacy_backup; și corectați înregistrările înainte de rerulare.', v_admin_issues;
  END IF;

  SELECT count(*), string_agg(DISTINCT (table_name || ':' || conflict_type), ', ')
  INTO v_data_conflicts, v_summary
  FROM public.migration_data_conflicts_backup
  WHERE resolved = FALSE;

  IF v_data_conflicts > 0 THEN
    RAISE EXCEPTION 'OPRIRE DE SIGURANȚĂ [integritate date]: S-au detectat % conflicte în datele existente (%). Rândurile afectate au fost salvate în public.migration_data_conflicts_backup. Inspectați cu: SELECT table_name, record_id, conflict_type, resolution_hint, raw_row FROM public.migration_data_conflicts_backup WHERE resolved = FALSE;', v_data_conflicts, v_summary;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2.2 Verificarea și repararea Cheilor Primare, Cheilor Străine, Constrângerilor
--     NOT NULL / CHECK și a Indecșilor pe toate cele 8 tabele
-- ------------------------------------------------------------------------------

-- Funcție utilitară pentru actualizarea coloanei updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Reparare / verificare PK pe toate cele 8 tabele + FK + Constrângeri CHECK
DO $$
BEGIN
  -- 1. public.admin_users: PK pe user_id, UNIQUE pe email, CHECK pe role
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.admin_users'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_pkey PRIMARY KEY (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.admin_users'::regclass AND contype = 'f'
  ) THEN
    ALTER TABLE public.admin_users
      ADD CONSTRAINT admin_users_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.admin_users'::regclass AND conname = 'admin_users_role_check'
  ) THEN
    ALTER TABLE public.admin_users
      ADD CONSTRAINT admin_users_role_check CHECK (role IN ('admin', 'super_admin'));
  END IF;

  -- 2. public.services: PK pe id, CHECK pe price și duration_min
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.services'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.services ADD CONSTRAINT services_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.services'::regclass AND conname = 'services_price_non_negative_chk'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_price_non_negative_chk CHECK (price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.services'::regclass AND conname = 'services_duration_min_valid_chk'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_duration_min_valid_chk CHECK (duration_min >= 0 AND duration_min <= 480);
  END IF;

  -- 3. public.service_addons: PK pe id, CHECK pe price_ron și duration_min
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.service_addons'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.service_addons ADD CONSTRAINT service_addons_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.service_addons'::regclass AND conname = 'service_addons_price_non_negative_chk'
  ) THEN
    ALTER TABLE public.service_addons
      ADD CONSTRAINT service_addons_price_non_negative_chk CHECK (price_ron >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.service_addons'::regclass AND conname = 'service_addons_duration_min_valid_chk'
  ) THEN
    ALTER TABLE public.service_addons
      ADD CONSTRAINT service_addons_duration_min_valid_chk CHECK (duration_min > 0 AND duration_min <= 240);
  END IF;

  -- 4. public.bookings: PK pe id, FK pe service_id -> services(id), CHECK pe status, duration_min, estimated_total
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass AND conname = 'bookings_service_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_service_id_fkey
      FOREIGN KEY (service_id) REFERENCES public.services(id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass AND conname = 'bookings_status_valid_chk'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_status_valid_chk
      CHECK (status IN ('in_asteptare', 'confirmat', 'finalizat', 'anulat'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass AND conname = 'bookings_duration_min_valid_chk'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_duration_min_valid_chk
      CHECK (duration_min >= 5 AND duration_min <= 480);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass AND conname = 'bookings_totals_non_negative_chk'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_totals_non_negative_chk
      CHECK (estimated_total >= 0 AND deposit_amount >= 0 AND guests_count >= 1);
  END IF;

  -- 5. public.reviews: PK pe id, CHECK pe rating
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reviews'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reviews'::regclass AND conname = 'reviews_rating_range_chk'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_rating_range_chk CHECK (rating >= 1 AND rating <= 5);
  END IF;

  -- 6. public.gallery_items: PK pe id, CHECK pe media_type
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.gallery_items'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.gallery_items ADD CONSTRAINT gallery_items_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.gallery_items'::regclass AND conname = 'gallery_items_media_type_chk'
  ) THEN
    ALTER TABLE public.gallery_items
      ADD CONSTRAINT gallery_items_media_type_chk CHECK (media_type IN ('photo', 'video'));
  END IF;

  -- 7. public.admin_auth_audit: PK pe id, CHECK pe status
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.admin_auth_audit'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.admin_auth_audit ADD CONSTRAINT admin_auth_audit_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.admin_auth_audit'::regclass AND conname = 'admin_auth_audit_status_chk'
  ) THEN
    ALTER TABLE public.admin_auth_audit
      ADD CONSTRAINT admin_auth_audit_status_chk CHECK (status IN ('SUCCESS', 'FAILED', 'LOGOUT'));
  END IF;

  -- 8. public.pfa_settings: PK pe id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pfa_settings'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.pfa_settings ADD CONSTRAINT pfa_settings_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Setarea NOT NULL pe toate coloanele obligatorii (după validarea completă din 2.1)
ALTER TABLE public.admin_users
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN active SET NOT NULL;

ALTER TABLE public.services
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN price SET NOT NULL,
  ALTER COLUMN duration_min SET NOT NULL;

ALTER TABLE public.service_addons
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN price_ron SET NOT NULL,
  ALTER COLUMN duration_min SET NOT NULL;

ALTER TABLE public.bookings
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN reference_code SET NOT NULL,
  ALTER COLUMN client_name SET NOT NULL,
  ALTER COLUMN client_email SET NOT NULL,
  ALTER COLUMN client_phone SET NOT NULL,
  ALTER COLUMN service_id SET NOT NULL,
  ALTER COLUMN service_name SET NOT NULL,
  ALTER COLUMN event_date SET NOT NULL,
  ALTER COLUMN event_time SET NOT NULL,
  ALTER COLUMN duration_min SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.reviews
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN author_name SET NOT NULL,
  ALTER COLUMN rating SET NOT NULL,
  ALTER COLUMN text SET NOT NULL,
  ALTER COLUMN approved SET NOT NULL;

ALTER TABLE public.gallery_items
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN media_type SET NOT NULL,
  ALTER COLUMN media_url SET NOT NULL;

ALTER TABLE public.admin_auth_audit
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN username SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN timestamp SET NOT NULL;

ALTER TABLE public.pfa_settings
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN brand_name SET NOT NULL,
  ALTER COLUMN cui SET NOT NULL;

-- Indecși de performanță și unicitate (creați după verificarea absenței duplicatelor)
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_user_id_unique ON public.admin_users(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email_lower_unique ON public.admin_users(lower(trim(email)));
CREATE INDEX IF NOT EXISTS idx_admin_users_active_role ON public.admin_users(active, role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_single_active_super_admin
  ON public.admin_users ((role))
  WHERE active = TRUE AND role = 'super_admin';

CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);
CREATE INDEX IF NOT EXISTS idx_services_order ON public.services(order_index);

CREATE INDEX IF NOT EXISTS idx_service_addons_order ON public.service_addons(order_index);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_reference_code_unique ON public.bookings(reference_code);
CREATE INDEX IF NOT EXISTS idx_bookings_event_date ON public.bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_lookup ON public.bookings(event_date, barber_name, status);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_approved ON public.reviews(approved);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gallery_category ON public.gallery_items(category);
CREATE INDEX IF NOT EXISTS idx_gallery_order ON public.gallery_items(order_index ASC);

CREATE INDEX IF NOT EXISTS idx_admin_auth_audit_timestamp ON public.admin_auth_audit(timestamp DESC);

-- Triggere updated_at
DROP TRIGGER IF EXISTS set_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER set_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_services_updated_at ON public.services;
CREATE TRIGGER set_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_service_addons_updated_at ON public.service_addons;
CREATE TRIGGER set_service_addons_updated_at
  BEFORE UPDATE ON public.service_addons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_bookings_updated_at ON public.bookings;
CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_gallery_items_updated_at ON public.gallery_items;
CREATE TRIGGER set_gallery_items_updated_at
  BEFORE UPDATE ON public.gallery_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_pfa_settings_updated_at ON public.pfa_settings;
CREATE TRIGGER set_pfa_settings_updated_at
  BEFORE UPDATE ON public.pfa_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2.3 Schema Privată `private_security`:
--     1) Tabel anti-replay și verificare obligatorie pentru tokenurile Cloudflare Turnstile
--     2) Procedura de inițializare a primului super_admin (inaccesibilă din API)
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private_security;
REVOKE ALL ON SCHEMA private_security FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS private_security.turnstile_token_nonces (
    token_hash TEXT PRIMARY KEY,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    client_ip TEXT DEFAULT '',
    consumed_at TIMESTAMP WITH TIME ZONE NULL
);

ALTER TABLE private_security.turnstile_token_nonces
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMP WITH TIME ZONE NULL;

REVOKE ALL ON private_security.turnstile_token_nonces FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON private_security.turnstile_token_nonces TO service_role;

-- Funcție apelabilă de Edge Function (cu service_role) pentru înregistrarea atomică
-- a unui token Turnstile verificat (împiedică reutilizarea aceluiași token și
-- pregătește dovada criptografică cerută de triggerul validate_and_compute_booking).
CREATE OR REPLACE FUNCTION public.consume_turnstile_token_nonce(
  p_token_hash TEXT,
  p_client_ip TEXT DEFAULT ''
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private_security, public, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT;
BEGIN
  v_jwt_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    auth.role(),
    ''
  );

  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Acces interzis: funcție rezervată exclusiv pentru Supabase Edge Function (service_role).';
  END IF;

  IF p_token_hash IS NULL OR trim(p_token_hash) !~ '^[0-9a-f]{64}$' THEN
    RETURN FALSE;
  END IF;

  -- Curăță nonces mai vechi de 24 de ore
  DELETE FROM private_security.turnstile_token_nonces
  WHERE used_at < timezone('utc'::text, now()) - interval '24 hours';

  INSERT INTO private_security.turnstile_token_nonces (token_hash, client_ip, used_at, consumed_at)
  VALUES (trim(p_token_hash), COALESCE(p_client_ip, ''), timezone('utc'::text, now()), NULL)
  ON CONFLICT (token_hash) DO NOTHING;

  RETURN FOUND;
END;
$$;

ALTER FUNCTION public.consume_turnstile_token_nonce(TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.consume_turnstile_token_nonce(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_turnstile_token_nonce(TEXT, TEXT) TO service_role;

-- Funcție apelabilă de Edge Function pentru invalidarea imediată a unui nonce
-- dacă inserarea programării eșuează (de ex. conflict de interval sau număr invalid),
-- păstrând totodată hash-ul în tabel (consumed_at != NULL) contra replay-ului.
CREATE OR REPLACE FUNCTION public.release_turnstile_token_nonce(
  p_token_hash TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private_security, public, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT;
BEGIN
  v_jwt_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    auth.role(),
    ''
  );

  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Acces interzis: funcție rezervată exclusiv pentru Supabase Edge Function (service_role).';
  END IF;

  IF p_token_hash IS NOT NULL THEN
    UPDATE private_security.turnstile_token_nonces
    SET consumed_at = timezone('utc'::text, now())
    WHERE token_hash = trim(p_token_hash)
      AND consumed_at IS NULL;
  END IF;
END;
$$;

ALTER FUNCTION public.release_turnstile_token_nonce(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.release_turnstile_token_nonce(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_turnstile_token_nonce(TEXT) TO service_role;

-- Procedura de inițializare a PRIMULUI super_admin (exclusiv din Supabase SQL Editor).
-- Nu folosește current_user pentru a presupune identitatea apelantului; verifică
-- session_user și absența oricărui context HTTP/JWT PostgREST.
DROP FUNCTION IF EXISTS public.bootstrap_first_super_admin(UUID);

CREATE OR REPLACE FUNCTION private_security.bootstrap_first_super_admin(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private_security, pg_temp
AS $$
DECLARE
  v_email TEXT;
  v_confirmed_at TIMESTAMP WITH TIME ZONE;
  v_existing_super_admins INT;
  v_jwt_role TEXT;
BEGIN
  -- 1. Verificare strictă a apelantului real:
  --    Nu folosim current_user (care într-o funcție SECURITY DEFINER este proprietarul funcției).
  --    Verificăm că apelul nu vine prin PostgREST (request.jwt.claim.role / auth.role())
  --    și că session_user este rolul administrativ din SQL Editor.
  v_jwt_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  );
  IF v_jwt_role <> '' OR auth.role() IN ('anon', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Acces interzis: bootstrap_first_super_admin nu poate fi apelată prin API-ul HTTP/PostgREST.';
  END IF;

  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Acces interzis: bootstrap_first_super_admin poate fi executată exclusiv din Supabase SQL Editor (session_user actual: %).', session_user;
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Eroare: target_user_id nu poate fi NULL.';
  END IF;

  -- Lock tranzacțional pentru a preveni execuția concurentă
  PERFORM pg_advisory_xact_lock(hashtext('rxt_bootstrap_super_admin_lock'));

  -- 2. Permite NUMAI prima inițializare (dacă nu există deja un super_admin activ)
  SELECT count(*) INTO v_existing_super_admins
  FROM public.admin_users
  WHERE role = 'super_admin' AND active = TRUE;

  IF v_existing_super_admins > 0 THEN
    RAISE EXCEPTION 'Operațiune respinsă: Există deja un super_admin activ în public.admin_users. Bootstrap-ul inițial nu poate fi repetat.';
  END IF;

  -- 3. Verifică existența contului în auth.users și confirmarea adresei de email
  SELECT u.email, u.email_confirmed_at
  INTO v_email, v_confirmed_at
  FROM auth.users u
  WHERE u.id = target_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Eroare: Utilizatorul cu ID-ul % nu există în auth.users.', target_user_id;
  END IF;

  IF v_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Eroare: Contul % (%) nu are adresa de email confirmată (email_confirmed_at IS NULL).', v_email, target_user_id;
  END IF;

  -- 4. Înregistrează primul super_admin
  INSERT INTO public.admin_users (user_id, email, role, active)
  VALUES (target_user_id, lower(trim(v_email)), 'super_admin', TRUE)
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    role = 'super_admin',
    active = TRUE,
    updated_at = timezone('utc'::text, now());

  -- 5. Înregistrează operațiunea în jurnalul de audit
  INSERT INTO public.admin_auth_audit (username, status, user_agent, city, failure_reason)
  VALUES (
    lower(trim(v_email)),
    'SUCCESS',
    'Supabase SQL Editor (bootstrap_first_super_admin)',
    'SQL Editor',
    'Inițializare autorizată a primului super_admin (user_id: ' || target_user_id::text || ')'
  );

  RETURN format('SUCCES: Contul % (%s) a fost configurat ca primul super_admin activ.', v_email, target_user_id);
END;
$$;

ALTER FUNCTION private_security.bootstrap_first_super_admin(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION private_security.bootstrap_first_super_admin(UUID) FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2.4 Funcțiile SECURITY DEFINER de verificare a rolului:
--     public.is_admin() și public.is_super_admin()
--     Identifică apelantul EXCLUSIV prin rolul JWT 'authenticated' și auth.uid(),
--     verificate în timp real în public.admin_users + auth.users.
--     Garantează returnarea strictă BOOLEAN (niciodată NULL) prin COALESCE + EXCEPTION.
-- ------------------------------------------------------------------------------
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

ALTER FUNCTION public.is_admin() OWNER TO postgres;
ALTER FUNCTION public.is_super_admin() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2.5 Curățarea programărilor vechi (fără păstrarea programărilor anterioare,
--     conform cerinței, fără a afecta alte tabele sau resurse Supabase)
-- ------------------------------------------------------------------------------
TRUNCATE TABLE public.bookings;

-- ------------------------------------------------------------------------------
-- 2.6 Trigger-ul BEFORE INSERT OR UPDATE pentru validarea și calculul pe server
--     al programărilor: public.validate_and_compute_booking()
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_and_compute_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private_security, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT;
  v_is_service_role BOOLEAN NOT NULL DEFAULT FALSE;
  v_is_sql_editor_admin BOOLEAN NOT NULL DEFAULT FALSE;
  v_is_admin BOOLEAN NOT NULL DEFAULT FALSE;
  v_romania_today DATE;
  v_service RECORD;
  v_addon RECORD;
  v_addon_key TEXT;
  v_addon_val TEXT;
  v_clean_addons JSONB := '{}'::jsonb;
  v_addons_price NUMERIC(10, 2) := 0;
  v_addons_duration INT := 0;
  v_total_price NUMERIC(10, 2) := 0;
  v_total_duration INT := 0;
  v_clean_phone TEXT;
  v_canonical_phone TEXT;
  v_clean_email TEXT;
  v_normalized_barber TEXT;
  v_dow INT;
  v_start_min INT;
  v_end_min INT;
  v_recent_contact_count INT;
  v_recent_global_count INT;
  v_conflict_ref TEXT;
  v_conflict_time TEXT;
  v_admin_schedule_exception BOOLEAN NOT NULL DEFAULT FALSE;
  v_admin_email TEXT;
  v_claimed_nonce TEXT;
BEGIN
  -- 1. Identificarea sigură a apelantului și tratarea strictă a valorii NULL:
  --    • Nu folosim current_user (deoarece într-o funcție SECURITY DEFINER este proprietarul 'postgres').
  --    • Extragem rolul JWT din PostgREST (request.jwt.claim.role / request.jwt.claims / auth.role()).
  --    • Protejăm accesul administrativ direct din Supabase SQL Editor (fără JWT + session_user IN ('postgres', 'supabase_admin')).
  --    • Folosim COALESCE(public.is_admin(), FALSE) astfel încât v_is_admin să nu fie NICIODATĂ NULL.
  v_jwt_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    auth.role(),
    ''
  );

  v_is_service_role := (v_jwt_role = 'service_role');
  v_is_sql_editor_admin := (v_jwt_role = '' AND session_user IN ('postgres', 'supabase_admin'));
  v_is_admin := (COALESCE(public.is_admin(), FALSE) IS TRUE) OR v_is_sql_editor_admin;

  -- 2. La UPDATE: interzice total modificarea de către orice utilizator care nu este administrator
  --    (Administratorul autentificat în panou sau administratorul din SQL Editor au v_is_admin = TRUE)
  IF TG_OP = 'UPDATE' AND (v_is_admin IS NOT TRUE) THEN
    RAISE EXCEPTION 'Acces interzis: numai administratorul autorizat poate modifica o programare existentă.';
  END IF;

  -- 3. La INSERT de către un client public (v_is_admin IS NOT TRUE):
  --    • Verifică obligatoriu că inserarea provine EXCLUSIV din Supabase Edge Function
  --      ('service_role') după validarea server-side a tokenului Cloudflare Turnstile.
  --    • Blochează orice tentativă de INSERT direct prin PostgREST cu cheia anon / authenticated.
  --    • Forțează starea 'in_asteptare', șterge admin_notes, setează deposit_amount = 0 și guests_count = 1.
  IF TG_OP = 'INSERT' AND (v_is_admin IS NOT TRUE) THEN
    IF v_is_service_role IS NOT TRUE THEN
      RAISE EXCEPTION 'Acces interzis: programările publice nu pot fi create direct în baza de date fără verificarea server-side Cloudflare Turnstile.';
    END IF;

    NEW.status := 'in_asteptare';
    NEW.admin_notes := '';
    NEW.deposit_amount := 0;
    NEW.guests_count := 1;
  END IF;

  -- 4. Validarea datelor de contact ale clientului
  NEW.client_name := trim(COALESCE(NEW.client_name, ''));
  IF length(NEW.client_name) < 2 OR length(NEW.client_name) > 150 THEN
    RAISE EXCEPTION 'Numele clientului este invalid (minim 2 caractere).';
  END IF;

  v_clean_phone := regexp_replace(COALESCE(NEW.client_phone, ''), '[\s\-\.\(\)]', '', 'g');
  IF v_clean_phone !~ '^(?:(?:\+40|0040)|0)7[0-9]{8}$' THEN
    RAISE EXCEPTION 'Numărul de telefon este invalid. Introduceți un număr mobil valid din România (ex: 0751676420).';
  END IF;
  -- Normalizare canonică 07XXXXXXXX pentru prevenirea ocolirii limitei anti-spam prin +407... vs 07...
  v_canonical_phone := regexp_replace(v_clean_phone, '^(?:\+40|0040)', '0');
  NEW.client_phone := trim(NEW.client_phone);

  v_clean_email := lower(trim(COALESCE(NEW.client_email, '')));
  IF v_clean_email = '' OR v_clean_email = 'fara-email@atelier.local' THEN
    NEW.client_email := 'fara-email@atelier.local';
    v_clean_email := 'fara-email@atelier.local';
  ELSE
    IF v_clean_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN
      RAISE EXCEPTION 'Adresa de email este invalidă.';
    END IF;
    NEW.client_email := v_clean_email;
  END IF;

  -- 5. Validarea și normalizarea frizerului, locației, notelor și a codului de referință
  NEW.barber_name := COALESCE(NULLIF(trim(COALESCE(NEW.barber_name, '')), ''), 'Roxana Teușde (Buie)');
  v_normalized_barber := lower(NEW.barber_name);
  NEW.location := COALESCE(NULLIF(trim(COALESCE(NEW.location, '')), ''), 'Atelier Tileagd');
  NEW.notes := left(trim(COALESCE(NEW.notes, '')), 1000);
  NEW.admin_notes := left(trim(COALESCE(NEW.admin_notes, '')), 2000);
  NEW.guests_count := GREATEST(COALESCE(NEW.guests_count, 1), 1);
  NEW.deposit_amount := GREATEST(COALESCE(NEW.deposit_amount, 0), 0);

  IF NEW.status IS NULL OR NEW.status NOT IN ('in_asteptare', 'confirmat', 'finalizat', 'anulat') THEN
    RAISE EXCEPTION 'Statusul programării (%) este invalid.', COALESCE(NEW.status, 'NULL');
  END IF;

  IF NEW.reference_code IS NULL OR trim(NEW.reference_code) = '' THEN
    NEW.reference_code := 'FRZ-' || EXTRACT(YEAR FROM COALESCE(NEW.event_date, CURRENT_DATE))::text || '-' || floor(1000 + random() * 9000)::int::text;
  ELSE
    NEW.reference_code := upper(trim(NEW.reference_code));
  END IF;

  -- 6. Validarea serviciului principal în catalogul public.services și preluarea
  --    prețului și duratei EXCLUSIV de pe server
  SELECT s.id, s.title, s.category, s.price, s.duration_min
  INTO v_service
  FROM public.services s
  WHERE s.id = NEW.service_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviciul selectat (%) nu există în oferta salonului.', COALESCE(NEW.service_id, 'NULL');
  END IF;

  IF v_service.category = 'produse' OR COALESCE(v_service.duration_min, 0) <= 0 THEN
    RAISE EXCEPTION 'Produsul "%" este disponibil pentru achiziție în salon și nu poate fi programat ca serviciu pe scaun.', v_service.title;
  END IF;

  -- 7. Validarea tratamentelor suplimentare (addons) în public.service_addons
  IF NEW.addons IS NULL THEN
    NEW.addons := '{}'::jsonb;
  END IF;

  IF jsonb_typeof(NEW.addons) <> 'object' THEN
    RAISE EXCEPTION 'Formatul opțiunilor suplimentare (addons) trebuie să fie obiect JSON.';
  END IF;

  FOR v_addon_key, v_addon_val IN
    SELECT k, v FROM jsonb_each_text(NEW.addons) AS kv(k, v)
  LOOP
    IF lower(trim(COALESCE(v_addon_val, ''))) IN ('true', '1', 't', 'yes') THEN
      SELECT sa.id, sa.name, sa.price_ron, sa.duration_min
      INTO v_addon
      FROM public.service_addons sa
      WHERE sa.id = v_addon_key;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Tratamentul suplimentar selectat (%) nu există în catalogul salonului.', v_addon_key;
      END IF;

      v_clean_addons := v_clean_addons || jsonb_build_object(v_addon_key, true);
      v_addons_price := v_addons_price + COALESCE(v_addon.price_ron, 0);
      v_addons_duration := v_addons_duration + GREATEST(COALESCE(v_addon.duration_min, 0), 0);
    END IF;
  END LOOP;

  -- 8. Calculul strict pe server al numelui serviciului, duratei totale și prețului total
  --    (orice valoare trimisă din browser pentru estimated_total sau duration_min este suprascrisă!)
  v_total_price := COALESCE(v_service.price, 0) + v_addons_price;
  v_total_duration := GREATEST(COALESCE(v_service.duration_min, 40), 5) + v_addons_duration;

  IF v_total_duration < 5 OR v_total_duration > 480 THEN
    RAISE EXCEPTION 'Durata totală calculată (%) este în afara limitelor permise (5 - 480 minute).', v_total_duration;
  END IF;

  NEW.service_name := v_service.title;
  NEW.addons := v_clean_addons;
  NEW.estimated_total := v_total_price;
  NEW.duration_min := v_total_duration;

  -- 9. Validarea datei și a formatului orei (HH:MM) în fusul orar Europe/Bucharest
  IF NEW.event_date IS NULL THEN
    RAISE EXCEPTION 'Data programării este obligatorie.';
  END IF;

  v_romania_today := (timezone('Europe/Bucharest', now()))::date;

  IF TG_OP = 'INSERT' AND (v_is_admin IS NOT TRUE) AND NEW.event_date < v_romania_today THEN
    RAISE EXCEPTION 'Nu se pot efectua programări pentru o dată din trecut.';
  END IF;

  NEW.event_time := trim(COALESCE(NEW.event_time, ''));
  IF NEW.event_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'Ora programării este invalidă (%). Folosiți formatul HH:MM (ex: 10:30).', NEW.event_time;
  END IF;

  v_start_min := split_part(NEW.event_time, ':', 1)::int * 60 + split_part(NEW.event_time, ':', 2)::int;
  v_end_min := v_start_min + v_total_duration;
  v_dow := EXTRACT(DOW FROM NEW.event_date)::int; -- 0 = Duminică (ÎNCHIS), 1 = Luni (ÎNCHIS), 2..5 = Marți..Vineri, 6 = Sâmbătă

  -- 10. Protecție anti-spam cu serializare prin pg_advisory_xact_lock (pentru cereri publice la INSERT)
  IF TG_OP = 'INSERT' AND (v_is_admin IS NOT TRUE) THEN
    -- Lock pe contact (telefon canonic / email) și lock global anti-flood
    PERFORM pg_advisory_xact_lock(hashtext('rxt_rate_contact'), hashtext(v_canonical_phone));
    PERFORM pg_advisory_xact_lock(hashtext('rxt_rate_contact'), hashtext(v_clean_email));
    PERFORM pg_advisory_xact_lock(hashtext('rxt_rate_global'), 1);

    SELECT count(*) INTO v_recent_contact_count
    FROM public.bookings b
    WHERE b.created_at >= timezone('utc'::text, now()) - interval '24 hours'
      AND (
        regexp_replace(
          regexp_replace(COALESCE(b.client_phone, ''), '[\s\-\.\(\)]', '', 'g'),
          '^(?:\+40|0040)',
          '0'
        ) = v_canonical_phone
        OR (
          v_clean_email <> 'fara-email@atelier.local'
          AND lower(trim(COALESCE(b.client_email, ''))) = v_clean_email
        )
      );

    IF v_recent_contact_count >= 2 THEN
      RAISE EXCEPTION 'Limita de siguranță a fost atinsă: sunt permise maximum 2 solicitări de programare în 24 de ore pentru același număr de telefon sau email.';
    END IF;

    SELECT count(*) INTO v_recent_global_count
    FROM public.bookings b
    WHERE b.created_at >= timezone('utc'::text, now()) - interval '10 minutes';

    IF v_recent_global_count >= 15 THEN
      RAISE EXCEPTION 'Sistemul de programări primește un volum ridicat de cereri în acest moment. Vă rugăm să reîncercați în câteva minute sau să ne contactați telefonic la +40 751 676 420.';
    END IF;
  END IF;

  -- 11. Dacă programarea este activă ('in_asteptare' sau 'confirmat'), verificăm
  --     programul de lucru și suprapunerea intervalelor atât la INSERT, cât și la UPDATE!
  --     REGULĂ CRITICĂ: Luni (v_dow = 1) și Duminică (v_dow = 0) nu se pot face programări
  --     nici de către clienți, nici de către administrator, decât dacă administratorul
  --     autorizat declară explicit [EXCEPTIE_PROGRAM] în admin_notes (ceea ce este auditat).
  IF NEW.status IN ('in_asteptare', 'confirmat') THEN
    -- Verificăm dacă administratorul a marcat explicit o excepție autorizată de program
    IF (v_is_admin IS TRUE) AND COALESCE(NEW.admin_notes, '') LIKE '%[EXCEPTIE_PROGRAM]%' THEN
      v_admin_schedule_exception := TRUE;
    END IF;

    IF v_admin_schedule_exception IS NOT TRUE THEN
      IF v_dow = 1 THEN
        RAISE EXCEPTION 'Atelierul este închis lunea. Nu se pot efectua programări lunea (nici de către clienți, nici de către administrator fără excepție explicită [EXCEPTIE_PROGRAM] auditată). Programul de lucru este Marți–Vineri 09:00–16:00 și Sâmbătă 09:00–13:00.';
      ELSIF v_dow = 0 THEN
        RAISE EXCEPTION 'Atelierul este închis duminica. Programul de lucru este Marți–Vineri 09:00–16:00 și Sâmbătă 09:00–13:00 (Luni și Duminică: ÎNCHIS).';
      ELSIF v_dow BETWEEN 2 AND 5 THEN
        IF v_start_min < 540 OR v_end_min > 960 THEN
          RAISE EXCEPTION 'Programarea depășește programul de lucru de Marți–Vineri (09:00–16:00). Serviciul selectat durează % minute (interval % - %:%).',
            v_total_duration, NEW.event_time, lpad((v_end_min / 60)::text, 2, '0'), lpad((v_end_min % 60)::text, 2, '0');
        END IF;
      ELSIF v_dow = 6 THEN
        IF v_start_min < 540 OR v_end_min > 780 THEN
          RAISE EXCEPTION 'Programarea depășește programul de lucru de Sâmbătă (09:00–13:00). Serviciul selectat durează % minute (interval % - %:%).',
            v_total_duration, NEW.event_time, lpad((v_end_min / 60)::text, 2, '0'), lpad((v_end_min % 60)::text, 2, '0');
        END IF;
      END IF;
    ELSE
      -- Înregistrăm în audit folosirea excepției explicite de program de către administrator (inclusiv ziua de Luni/Duminică)
      SELECT a.email INTO v_admin_email FROM public.admin_users a WHERE a.user_id = auth.uid();
      INSERT INTO public.admin_auth_audit (username, status, user_agent, city, failure_reason)
      VALUES (
        COALESCE(v_admin_email, session_user, 'admin'),
        'SUCCESS',
        'Trigger validate_and_compute_booking',
        'Tileagd, Bihor',
        format('Excepție explicită de program [EXCEPTIE_PROGRAM] autorizată pentru %s pe %s (DOW=%s) la %s (%s min)',
               NEW.reference_code, NEW.event_date::text, v_dow::text, NEW.event_time, v_total_duration)
      );
    END IF;

    -- Lock tranzacțional pe (frizer, dată) pentru a bloca două cereri simultane pe același interval
    PERFORM pg_advisory_xact_lock(
      hashtext('rxt_slot_lock'),
      hashtext(v_normalized_barber || '::' || NEW.event_date::text)
    );

    -- Verificare suprapunere interval [v_start_min, v_end_min) cu orice altă programare activă
    -- La UPDATE exclude programarea însăși (b.id <> NEW.id)
    SELECT b.reference_code, b.event_time
    INTO v_conflict_ref, v_conflict_time
    FROM public.bookings b
    WHERE b.event_date = NEW.event_date
      AND lower(trim(COALESCE(b.barber_name, 'Roxana Teușde (Buie)'))) = v_normalized_barber
      AND b.status IN ('in_asteptare', 'confirmat')
      AND (TG_OP = 'INSERT' OR b.id <> NEW.id)
      AND b.event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND v_start_min < (
        (split_part(b.event_time, ':', 1)::int * 60 + split_part(b.event_time, ':', 2)::int)
        + GREATEST(COALESCE(b.duration_min, 40), 5)
      )
      AND v_end_min > (
        split_part(b.event_time, ':', 1)::int * 60 + split_part(b.event_time, ':', 2)::int
      )
    LIMIT 1;

    IF v_conflict_ref IS NOT NULL THEN
      RAISE EXCEPTION 'Intervalul orar selectat (% - durată % min) se suprapune cu o altă programare activă (ora %) pentru %.',
        NEW.event_time, v_total_duration, v_conflict_time, NEW.barber_name;
    END IF;
  END IF;

  -- 12. Verificarea și consumarea obligatorie a dovezii Cloudflare Turnstile la INSERT public:
  --     Chiar dacă apelul folosește service_role, o programare publică (v_is_admin IS NOT TRUE)
  --     poate fi inserată NUMAI dacă există un nonce Turnstile validat și neconsumat în
  --     private_security.turnstile_token_nonces din ultimele 2 minute.
  IF TG_OP = 'INSERT' AND (v_is_admin IS NOT TRUE) THEN
    UPDATE private_security.turnstile_token_nonces
    SET consumed_at = timezone('utc'::text, now())
    WHERE token_hash = (
      SELECT t.token_hash
      FROM private_security.turnstile_token_nonces t
      WHERE t.consumed_at IS NULL
        AND t.used_at >= timezone('utc'::text, now()) - interval '2 minutes'
      ORDER BY t.used_at DESC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING token_hash INTO v_claimed_nonce;

    IF v_claimed_nonce IS NULL THEN
      RAISE EXCEPTION 'Acces interzis: lipsă verificare activă Cloudflare Turnstile în Supabase Edge Function pentru această programare.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.validate_and_compute_booking() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.validate_and_compute_booking() FROM PUBLIC, anon, authenticated;

-- Eliminăm orice triggere vechi / redenumite și atașăm triggerul canonic la INSERT și UPDATE
DROP TRIGGER IF EXISTS validate_booking_trigger ON public.bookings;
DROP TRIGGER IF EXISTS before_insert_booking ON public.bookings;
DROP TRIGGER IF EXISTS trg_validate_booking ON public.bookings;
DROP TRIGGER IF EXISTS trg_validate_and_compute_booking ON public.bookings;

CREATE TRIGGER trg_validate_and_compute_booking
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_and_compute_booking();

-- ------------------------------------------------------------------------------
-- 2.6 View-ul public pentru setările de afișare ale site-ului:
--     public.public_site_settings (WITH security_invoker = true)
--     Expune exclusiv cele 7 coloane publice necesare afișării pe site, fără CUI,
--     Reg. Com., adresă domiciliu/sediu, telefon sau email privat.
-- ------------------------------------------------------------------------------
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

ALTER VIEW public.public_site_settings OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 2.7 Permisiuni explicite GRANT / REVOKE pe toate tabelele și pe view-ul public
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 1. public.admin_users: anon nu are niciun acces; authenticated doar cu verificare RLS
REVOKE ALL ON public.admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO authenticated;

-- 2. public.services: citire publică; scriere doar authenticated (filtrat prin RLS is_admin())
REVOKE ALL ON public.services FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.services TO authenticated;

-- 3. public.service_addons: citire publică; scriere doar authenticated (filtrat prin RLS is_admin())
REVOKE ALL ON public.service_addons FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.service_addons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.service_addons TO authenticated;

-- 4. public.bookings:
--    • anon NU are permisiune de INSERT direct (toate programările publice trec exclusiv prin Edge Function 'create-booking-turnstile' cu service_role).
--    • authenticated poate SELECT/INSERT/UPDATE/DELETE doar dacă trece de politica RLS public.is_admin().
REVOKE ALL ON public.bookings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;

-- 5. public.reviews: anon poate SELECT (doar aprobate prin RLS) și INSERT (doar neaprobate prin RLS)
REVOKE ALL ON public.reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;

-- 6. public.gallery_items: citire publică; scriere doar authenticated (filtrat prin RLS is_admin())
REVOKE ALL ON public.gallery_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gallery_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gallery_items TO authenticated;

-- 7. public.admin_auth_audit: anon și authenticated pot INSERT (FAILED prin RLS); doar admin poate SELECT; nimeni UPDATE/DELETE
REVOKE ALL ON public.admin_auth_audit FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.admin_auth_audit TO anon;
GRANT SELECT, INSERT ON public.admin_auth_audit TO authenticated;

-- 8. public.pfa_settings & public.public_site_settings:
--    • anon primește SELECT EXCLUSIV pe coloanele publice de afișare (nu poate citi cui, reg_com, owner_name, address, phone, email).
--    • authenticated primește SELECT, INSERT, UPDATE, DELETE la nivel de tabel pentru Panoul Admin,
--      însă politica RLS pe pfa_settings pentru authenticated cere obligatoriu public.is_admin()!
REVOKE ALL ON public.pfa_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,
  site_images,
  gallery_settings,
  services_settings,
  hours_weekday,
  hours_saturday,
  hours_sunday,
  updated_at
) ON public.pfa_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pfa_settings TO authenticated;

REVOKE ALL ON public.public_site_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_site_settings TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2.8 Activare Row Level Security (RLS) și înlocuirea controlată a politicilor
--     (toate politicile anterioare au fost inventariate în public.rls_policies_inventory_backup)
-- ------------------------------------------------------------------------------
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_auth_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfa_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'admin_users',
        'services',
        'service_addons',
        'bookings',
        'reviews',
        'gallery_items',
        'admin_auth_audit',
        'pfa_settings'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- [RLS 1/8]: public.admin_users
CREATE POLICY "admin_users_select_verified_admin"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_users_insert_super_admin_only"
  ON public.admin_users FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "admin_users_update_super_admin_only"
  ON public.admin_users FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "admin_users_delete_super_admin_only"
  ON public.admin_users FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- [RLS 2/8]: public.services
CREATE POLICY "services_select_public"
  ON public.services FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "services_insert_admin_only"
  ON public.services FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "services_update_admin_only"
  ON public.services FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "services_delete_admin_only"
  ON public.services FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- [RLS 3/8]: public.service_addons
CREATE POLICY "service_addons_select_public"
  ON public.service_addons FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "service_addons_insert_admin_only"
  ON public.service_addons FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "service_addons_update_admin_only"
  ON public.service_addons FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "service_addons_delete_admin_only"
  ON public.service_addons FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- [RLS 4/8]: public.bookings
-- Inserarea publică se face EXCLUSIV prin Supabase Edge Function (`create-booking-turnstile`)
-- după validarea server-side a tokenului Cloudflare Turnstile cu TURNSTILE_SECRET_KEY.
-- Direct prin API-ul PostgREST, doar administratorul verificat (`COALESCE(public.is_admin(), FALSE) = TRUE`) poate insera/citi/modifica/șterge.
CREATE POLICY "bookings_insert_admin_only"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (COALESCE(public.is_admin(), FALSE) = TRUE);

CREATE POLICY "bookings_select_admin_only"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (COALESCE(public.is_admin(), FALSE) = TRUE);

CREATE POLICY "bookings_update_admin_only"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (COALESCE(public.is_admin(), FALSE) = TRUE)
  WITH CHECK (COALESCE(public.is_admin(), FALSE) = TRUE);

CREATE POLICY "bookings_delete_admin_only"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (COALESCE(public.is_admin(), FALSE) = TRUE);

-- [RLS 5/8]: public.reviews
CREATE POLICY "reviews_select_approved_or_admin"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (approved = true OR public.is_admin());

CREATE POLICY "reviews_insert_unapproved_or_admin"
  ON public.reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (
      approved = false
      AND rating >= 1
      AND rating <= 5
      AND length(trim(author_name)) >= 2
      AND length(trim(text)) >= 2
    )
    OR public.is_admin()
  );

CREATE POLICY "reviews_update_admin_only"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "reviews_delete_admin_only"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- [RLS 6/8]: public.gallery_items
CREATE POLICY "gallery_items_select_public"
  ON public.gallery_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "gallery_items_insert_admin_only"
  ON public.gallery_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "gallery_items_update_admin_only"
  ON public.gallery_items FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "gallery_items_delete_admin_only"
  ON public.gallery_items FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- [RLS 7/8]: public.admin_auth_audit (Jurnal imutabil anti-spoofing)
CREATE POLICY "admin_auth_audit_insert_failed_attempt"
  ON public.admin_auth_audit FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'FAILED'
    AND length(trim(username)) >= 2
    AND failure_reason IS NOT NULL
    AND length(trim(failure_reason)) >= 2
  );

CREATE POLICY "admin_auth_audit_insert_verified_admin_events"
  ON public.admin_auth_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    AND status IN ('SUCCESS', 'LOGOUT')
    AND length(trim(username)) >= 2
  );

CREATE POLICY "admin_auth_audit_select_admin_only"
  ON public.admin_auth_audit FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- [RLS 8/8]: public.pfa_settings
-- • Rolul anon poate citi rândul 'current' (dar numai coloanele publice permise de GRANT SELECT(col1..col8)!)
-- • Rolul authenticated poate citi/modifica rândul din pfa_settings EXCLUSIV dacă public.is_admin() = TRUE!
--   Astfel, un utilizator autentificat fără rol de admin nu poate citi CUI, adresă, telefon sau email!
CREATE POLICY "pfa_settings_select_anon_public_cols"
  ON public.pfa_settings FOR SELECT
  TO anon
  USING (id = 'current');

CREATE POLICY "pfa_settings_select_admin_all_cols"
  ON public.pfa_settings FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "pfa_settings_insert_admin_only"
  ON public.pfa_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "pfa_settings_update_admin_only"
  ON public.pfa_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "pfa_settings_delete_admin_only"
  ON public.pfa_settings FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 2.9 SUPABASE STORAGE: Bucket 'atelier-media' și Politici PERMISSIVE + RESTRICTIVE
--     (Protejează 'atelier-media' fără a șterge politicile altor bucket-uri!)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'atelier-media',
  'atelier-media',
  true,
  52428800, -- 50 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];

-- Elimină DOAR politicile care menționează explicit 'atelier-media' sau numele politicilor noastre,
-- fără a atinge niciodată politicile altor bucket-uri!
DO $$
DECLARE
  spol RECORD;
BEGIN
  FOR spol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        policyname IN (
          'Publicul poate vizualiza fisierele media',
          'Doar admin poate incarca fisiere media',
          'Doar admin poate actualiza fisiere media',
          'Doar admin poate sterge fisiere media',
          'atelier_media_select_public',
          'atelier_media_insert_admin_only',
          'atelier_media_update_admin_only',
          'atelier_media_delete_admin_only',
          'atelier_media_restrictive_write_guard',
          'atelier_media_restrictive_update_guard',
          'atelier_media_restrictive_delete_guard'
        )
        OR (
          (COALESCE(qual, '') ILIKE '%atelier-media%' OR COALESCE(with_check, '') ILIKE '%atelier-media%')
          AND COALESCE(qual, '') NOT ILIKE '%bucket_id <>%'
        )
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', spol.policyname);
  END LOOP;
END $$;

-- Politici PERMISSIVE pentru 'atelier-media'
CREATE POLICY "atelier_media_select_public"
  ON storage.objects AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'atelier-media');

CREATE POLICY "atelier_media_insert_admin_only"
  ON storage.objects AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'atelier-media' AND public.is_admin());

CREATE POLICY "atelier_media_update_admin_only"
  ON storage.objects AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (bucket_id = 'atelier-media' AND public.is_admin())
  WITH CHECK (bucket_id = 'atelier-media' AND public.is_admin());

CREATE POLICY "atelier_media_delete_admin_only"
  ON storage.objects AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (bucket_id = 'atelier-media' AND public.is_admin());

-- Politici RESTRICTIVE pe storage.objects:
-- Dacă în proiect există o politică generală permisivă (fără filtru de bucket),
-- politicile AS RESTRICTIVE de mai jos garantează matematic că pentru bucket_id = 'atelier-media'
-- scrierea/modificarea/ștergerea este permisă DOAR dacă public.is_admin() = TRUE,
-- în timp ce pentru orice alt bucket (bucket_id <> 'atelier-media') evaluează la TRUE (nu îl afectează!).
CREATE POLICY "atelier_media_restrictive_write_guard"
  ON storage.objects AS RESTRICTIVE FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id <> 'atelier-media' OR public.is_admin());

CREATE POLICY "atelier_media_restrictive_update_guard"
  ON storage.objects AS RESTRICTIVE FOR UPDATE
  TO anon, authenticated
  USING (bucket_id <> 'atelier-media' OR public.is_admin())
  WITH CHECK (bucket_id <> 'atelier-media' OR public.is_admin());

CREATE POLICY "atelier_media_restrictive_delete_guard"
  ON storage.objects AS RESTRICTIVE FOR DELETE
  TO anon, authenticated
  USING (bucket_id <> 'atelier-media' OR public.is_admin());

COMMIT;
