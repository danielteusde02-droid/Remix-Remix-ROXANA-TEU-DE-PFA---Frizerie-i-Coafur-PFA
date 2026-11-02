import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRomanianPhone,
  validateEmail,
  generateBookingReference,
  calculateBarberEstimate,
  AVAILABLE_TIME_SLOTS,
  getTimeSlotsForDate,
  getAvailableTimeSlotsForDate,
  validateBookingScheduleAndDuration,
  extractAdminScheduleExceptionReason,
  formatAdminScheduleExceptionTag,
  doBookingsOverlap,
  isTimeSlotPastForToday,
  formatRon,
  formatRomanianDate,
  formatRomanianDateWithDay,
} from './bookingUtils.js';
import {
  isValidSupabaseUrl,
  isValidSupabaseKey,
  getSecurityAudit,
  generateSupabaseSQLSchema,
} from './securityUtils.js';
import {
  hashPassword,
  verifyPassword,
  createAdminSession,
  validateAdminSession,
  authenticateAdmin,
  verifyUserIsAdmin,
} from './authUtils.js';
import {
  calculateDynamicRoute,
  getGoogleMapsDirectionsUrl,
  PRESET_ORIGINS,
} from './mapsUtils.js';
import { dataService } from '../services/dataService.js';
import { normalizeSupabaseUrl, getTurnstileSiteKey } from '../lib/supabase.js';

test('validateRomanianPhone correctly validates standard Romanian numbers', () => {
  assert.equal(validateRomanianPhone('0741234567'), true);
  assert.equal(validateRomanianPhone('+40741234567'), true);
  assert.equal(validateRomanianPhone('0741 234 567'), true);
  assert.equal(validateRomanianPhone('0741-234-567'), true);
  assert.equal(validateRomanianPhone('0040741234567'), true);

  // Invalid numbers
  assert.equal(validateRomanianPhone('123456'), false);
  assert.equal(validateRomanianPhone('0212345678'), false);
  assert.equal(validateRomanianPhone(''), false);
});

test('validateEmail correctly validates email addresses', () => {
  assert.equal(validateEmail('client@frizerie.ro'), true);
  assert.equal(validateEmail('alex.popa@gmail.com'), true);
  assert.equal(validateEmail('not-an-email'), false);
  assert.equal(validateEmail(''), false);
});

test('generateBookingReference produces expected FRZ prefix', () => {
  const fixedDate = new Date('2026-06-15');
  const ref = generateBookingReference(fixedDate);
  assert.match(ref, /^FRZ-2026-\d{4}$/);
});

test('calculateBarberEstimate correctly adds base haircut price, addons and extra duration', () => {
  const baseHaircutPrice = 70;
  const addons = {
    hotTowelTreatment: true,
    blackMask: true,
  };

  const result = calculateBarberEstimate(baseHaircutPrice, 40, addons);
  assert.equal(result.basePrice, 70);
  assert.equal(result.addonsTotal, 60);
  assert.equal(result.finalTotal, 130);
  assert.equal(result.totalDurationMin, 65);
});

test('AVAILABLE_TIME_SLOTS and getTimeSlotsForDate enforce official working hours (Luni ÎNCHIS, Ma-Vi 09:00 - 16:00, Sâm 09:00 - 13:00, Dum ÎNCHIS)', () => {
  assert.ok(AVAILABLE_TIME_SLOTS.includes('09:00'));
  assert.ok(AVAILABLE_TIME_SLOTS.includes('12:00'));
  assert.ok(AVAILABLE_TIME_SLOTS.includes('15:00'));
  assert.ok(AVAILABLE_TIME_SLOTS.length >= 8);

  // Tuesday check (Nov 10 2026 is a Tuesday - Open 09:00 - 16:00)
  const tueSlots = getTimeSlotsForDate('2026-11-10');
  assert.ok(tueSlots.includes('09:00'));
  assert.ok(tueSlots.includes('15:30'));

  // Saturday check (Nov 7 2026 is a Saturday - Open 09:00 - 13:00)
  const satSlots = getTimeSlotsForDate('2026-11-07');
  assert.ok(satSlots.includes('09:00'));
  assert.ok(satSlots.includes('12:30'));
  assert.equal(satSlots.includes('15:00'), false);

  // Sunday check (Nov 8 2026 is a Sunday - Closed)
  const sunSlots = getTimeSlotsForDate('2026-11-08');
  assert.equal(sunSlots.length, 0);

  // Monday check (Nov 9 2026 is a Monday - Closed)
  const monSlots = getTimeSlotsForDate('2026-11-09');
  assert.equal(monSlots.length, 0);
});

test('Scenariile obligatorii 1–7 și 12: validarea programului, duratei totale până la închidere, orelor trecute azi și excepțiilor admin', () => {
  // Referință temporală fixă: Luni 2 noiembrie 2026, ora 11:00 în România (09:00 UTC)
  const fixedNow = new Date('2026-11-02T09:00:00.000Z');

  // Scenariul 1: Programare Luni -> respinsă (2026-11-09 este Luni)
  const mondayRes = validateBookingScheduleAndDuration({
    eventDate: '2026-11-09',
    eventTime: '10:30',
    durationMin: 40,
    isAdmin: false,
    now: fixedNow,
  });
  assert.equal(mondayRes.valid, false);
  assert.equal(mondayRes.violationType, 'CLOSED_MONDAY');

  // Scenariul 2: Programare Duminică -> respinsă (2026-11-08 este Duminică)
  const sundayRes = validateBookingScheduleAndDuration({
    eventDate: '2026-11-08',
    eventTime: '10:30',
    durationMin: 40,
    isAdmin: false,
    now: fixedNow,
  });
  assert.equal(sundayRes.valid, false);
  assert.equal(sundayRes.violationType, 'CLOSED_SUNDAY');

  // Scenariul 3: Programare Marți 09:00 (40 min) -> acceptată (2026-11-10 este Marți)
  const tuesday900Res = validateBookingScheduleAndDuration({
    eventDate: '2026-11-10',
    eventTime: '09:00',
    durationMin: 40,
    isAdmin: false,
    now: fixedNow,
  });
  assert.equal(tuesday900Res.valid, true);

  // Scenariul 4: Programare Vineri 15:30 (60 min) -> respinsă (15:30 + 60m = 16:30 > 16:00)
  const friday1530Res = validateBookingScheduleAndDuration({
    eventDate: '2026-11-13',
    eventTime: '15:30',
    durationMin: 60,
    isAdmin: false,
    now: fixedNow,
  });
  assert.equal(friday1530Res.valid, false);
  assert.equal(friday1530Res.violationType, 'OUTSIDE_HOURS_TUE_FRI');

  // Verificare getAvailableTimeSlotsForDate pentru Vineri cu serviciu de 60 min: 15:30 este dezactivat
  const fridaySlots60 = getAvailableTimeSlotsForDate('2026-11-13', 60, fixedNow);
  const slot1500Fri = fridaySlots60.find(s => s.time === '15:00');
  const slot1530Fri = fridaySlots60.find(s => s.time === '15:30');
  assert.equal(slot1500Fri?.disabled, false, '15:00 + 60m = 16:00 should be allowed');
  assert.equal(slot1530Fri?.disabled, true, '15:30 + 60m = 16:30 should be disabled');

  // Scenariul 5: Programare Sâmbătă 12:00 (60 min) -> acceptată (12:00 + 60m = 13:00 <= 13:00)
  const saturday1200Res = validateBookingScheduleAndDuration({
    eventDate: '2026-11-14',
    eventTime: '12:00',
    durationMin: 60,
    isAdmin: false,
    now: fixedNow,
  });
  assert.equal(saturday1200Res.valid, true);

  // Scenariul 6: Programare Sâmbătă 12:30 (45 min) -> respinsă (12:30 + 45m = 13:15 > 13:00)
  const saturday1230Res = validateBookingScheduleAndDuration({
    eventDate: '2026-11-14',
    eventTime: '12:30',
    durationMin: 45,
    isAdmin: false,
    now: fixedNow,
  });
  assert.equal(saturday1230Res.valid, false);
  assert.equal(saturday1230Res.violationType, 'OUTSIDE_HOURS_SATURDAY');

  // Verificare getAvailableTimeSlotsForDate pentru Sâmbătă cu serviciu de 45 min: 12:30 este dezactivat
  const saturdaySlots45 = getAvailableTimeSlotsForDate('2026-11-14', 45, fixedNow);
  const slot1200Sat = saturdaySlots45.find(s => s.time === '12:00');
  const slot1230Sat = saturdaySlots45.find(s => s.time === '12:30');
  assert.equal(slot1200Sat?.disabled, false);
  assert.equal(slot1230Sat?.disabled, true);

  // Scenariul 7: Programare în trecut sau la o oră deja trecută în ziua curentă -> respinsă
  // Setăm "acum" la Marți 2026-11-10 ora 12:15 în România (10:15 UTC)
  const tuesdayMiddayNow = new Date('2026-11-10T10:15:00.000Z');
  assert.equal(isTimeSlotPastForToday('2026-11-10', '11:15', tuesdayMiddayNow), true);
  assert.equal(isTimeSlotPastForToday('2026-11-10', '12:45', tuesdayMiddayNow), false);

  const pastHourTodayRes = validateBookingScheduleAndDuration({
    eventDate: '2026-11-10',
    eventTime: '11:15',
    durationMin: 40,
    isAdmin: false,
    now: tuesdayMiddayNow,
  });
  assert.equal(pastHourTodayRes.valid, false);
  assert.equal(pastHourTodayRes.violationType, 'PAST_TIME_TODAY');

  const pastDateRes = validateBookingScheduleAndDuration({
    eventDate: '2026-11-05',
    eventTime: '10:30',
    durationMin: 40,
    isAdmin: false,
    now: tuesdayMiddayNow,
  });
  assert.equal(pastDateRes.valid, false);
  assert.equal(pastDateRes.violationType, 'PAST_DATE');

  // Scenariul 12: Admin fără excepție explicită (sau motiv < 5 caractere) -> respinsă Luni/Duminică
  const adminMondayNoException = validateBookingScheduleAndDuration({
    eventDate: '2026-11-09',
    eventTime: '11:00',
    durationMin: 40,
    isAdmin: true,
    adminNotes: '',
    now: fixedNow,
  });
  assert.equal(adminMondayNoException.valid, false);

  const adminMondayShortReason = validateBookingScheduleAndDuration({
    eventDate: '2026-11-09',
    eventTime: '11:00',
    durationMin: 40,
    isAdmin: true,
    adminNotes: '[EXCEPTIE_PROGRAM: ok]',
    now: fixedNow,
  });
  assert.equal(adminMondayShortReason.valid, false);

  const validTag = formatAdminScheduleExceptionTag('Client fidel eveniment special');
  assert.equal(extractAdminScheduleExceptionReason(validTag), 'Client fidel eveniment special');

  const adminMondayWithValidException = validateBookingScheduleAndDuration({
    eventDate: '2026-11-09',
    eventTime: '11:00',
    durationMin: 40,
    isAdmin: true,
    adminNotes: validTag,
    now: fixedNow,
  });
  assert.equal(adminMondayWithValidException.valid, true);
  assert.equal(adminMondayWithValidException.exceptionReason, 'Client fidel eveniment special');
});

test('Scenariul 8: doBookingsOverlap detectează corect suprapunerea intervalelor pe baza duratei reale', () => {
  const firstBooking = {
    eventDate: '2026-11-10',
    eventTime: '10:00',
    durationMin: 45, // 10:00 - 10:45
    barberName: 'Roxana Teușde (Buie)',
  };

  const overlappingSecond = {
    eventDate: '2026-11-10',
    eventTime: '10:30',
    durationMin: 40, // 10:30 - 11:10 (se suprapune 10:30 - 10:45)
    barberName: 'Roxana Teușde (Buie)',
  };

  const nonOverlappingAdjacent = {
    eventDate: '2026-11-10',
    eventTime: '10:45',
    durationMin: 40, // 10:45 - 11:25 (începe exact când prima se termină)
    barberName: 'Roxana Teușde (Buie)',
  };

  assert.equal(doBookingsOverlap(firstBooking, overlappingSecond), true);
  assert.equal(doBookingsOverlap(firstBooking, nonOverlappingAdjacent), false);
});

test('formatRon produces valid currency output', () => {
  const formatted = formatRon(120);
  assert.ok(formatted.includes('120'));
  assert.ok(formatted.includes('RON') || formatted.includes('lei'));
});

test('formatRomanianDate produces Romanian month names', () => {
  const formatted = formatRomanianDate('2026-08-15');
  assert.ok(formatted.includes('august'));
  assert.ok(formatted.includes('2026'));
});

test('formatRomanianDateWithDay includes weekday and Romanian month', () => {
  // 2026-11-23 is Monday
  const formatted = formatRomanianDateWithDay('2026-11-23');
  assert.ok(formatted.toLowerCase().includes('luni'));
  assert.ok(formatted.toLowerCase().includes('noiembrie'));
  assert.ok(formatted.includes('2026'));
});

test('isValidSupabaseUrl and isValidSupabaseKey accept both legacy JWT and new sb_publishable_ keys while rejecting secret keys', () => {
  assert.equal(isValidSupabaseUrl('https://xyzbarbershop.supabase.co'), true);
  assert.equal(isValidSupabaseUrl('https://xyzbarbershop.supabase.co/rest/v1'), true);
  assert.equal(isValidSupabaseUrl('https://example.com'), false);

  // normalizeSupabaseUrl strips trailing slashes, /rest/v1, /auth/v1, and query params
  assert.equal(normalizeSupabaseUrl('https://xyzbarbershop.supabase.co/rest/v1'), 'https://xyzbarbershop.supabase.co');
  assert.equal(normalizeSupabaseUrl('https://xyzbarbershop.supabase.co/auth/v1/'), 'https://xyzbarbershop.supabase.co');
  assert.equal(normalizeSupabaseUrl('https://xyzbarbershop.supabase.co/'), 'https://xyzbarbershop.supabase.co');
  assert.equal(normalizeSupabaseUrl('xyzbarbershop.supabase.co'), 'https://xyzbarbershop.supabase.co');

  // getTurnstileSiteKey returns valid non-empty public key
  const siteKey = getTurnstileSiteKey();
  assert.ok(siteKey.startsWith('0x4AAAAAA') || siteKey.length >= 20);

  // Legacy JWT anon key
  assert.equal(
    isValidSupabaseKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5eiJ9.abc123sign'),
    true
  );

  // New Supabase publishable key
  assert.equal(
    isValidSupabaseKey('sb_publishable_AbCdEfGhIjKlMnOpQrStUvWxYz123456'),
    true
  );

  // Reject secret and service_role keys
  assert.equal(isValidSupabaseKey('sb_secret_AbCdEfGhIjKlMnOpQrStUvWxYz123456'), false);
  assert.equal(isValidSupabaseKey('service_role_key_example'), false);
  assert.equal(isValidSupabaseKey('short'), false);
});

test('getSecurityAudit and generateSupabaseSQLSchema include all 8 audited tables including booking_schedule_exceptions_audit', () => {
  const audit = getSecurityAudit();
  assert.equal(audit.length, 8);
  const tables = audit.map(a => a.tableName);
  assert.ok(tables.includes('bookings'));
  assert.ok(tables.includes('booking_schedule_exceptions_audit'));
  assert.ok(tables.includes('services'));
  assert.ok(tables.includes('service_addons'));
  assert.ok(tables.includes('reviews'));
  assert.ok(tables.includes('gallery_items'));
  assert.ok(tables.includes('admin_auth_audit'));
  assert.ok(tables.includes('pfa_settings'));

  // Verify bookings RLS prevents public read AND prevents direct public insert without Turnstile Edge Function
  const bookingsPolicy = audit.find(a => a.tableName === 'bookings');
  assert.equal(bookingsPolicy?.publicSelect, false);
  assert.equal(bookingsPolicy?.publicInsert, false);
  assert.equal(bookingsPolicy?.adminUpdate, true);
  assert.equal(bookingsPolicy?.adminDelete, true);

  const sql = generateSupabaseSQLSchema();
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.admin_users'));
  assert.ok(sql.includes('user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE'));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.is_admin()'));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.is_super_admin()'));
  assert.ok(sql.includes('SECURITY DEFINER'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.services'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.service_addons'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.bookings'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.reviews'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.gallery_items'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.admin_auth_audit'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.pfa_settings'));
  assert.ok(sql.includes('WITH CHECK (public.is_admin())'));
  assert.ok(sql.includes('WITH CHECK (public.is_super_admin())'));
  assert.ok(sql.includes("status IN ('SUCCESS', 'LOGOUT')"));
  assert.ok(sql.includes("'atelier-media'"));
  // Ensure no app_metadata fallback or auth.role() = 'authenticated' write access
  assert.equal(sql.includes('app_metadata'), false);
  assert.equal(sql.includes("USING (auth.role() = 'authenticated')"), false);
});

test('Scenariul 11: hashPassword, verifyPassword, verifyUserIsAdmin, createAdminSession and authenticateAdmin block non-admin users', async () => {
  const password = 'TestPassword2026!';
  const hash = await hashPassword(password);
  assert.ok(hash.length >= 32);

  const isValid = await verifyPassword(password, hash);
  assert.equal(isValid, true);

  const isInvalid = await verifyPassword('WrongPassword', hash);
  assert.equal(isInvalid, false);

  // Verify admin role verification never grants access based on email or app_metadata alone without DB verification
  assert.equal(await verifyUserIsAdmin({ id: '00000000-0000-0000-0000-000000000001', email: 'admin@roxanateusde.ro' }), false);
  assert.equal(await verifyUserIsAdmin(null), false);

  const session = createAdminSession('admin@roxanateusde.ro');
  assert.equal(session.username, 'admin@roxanateusde.ro');
  assert.equal(session.role, 'admin');
  assert.equal(validateAdminSession(session), true);

  const expiredSession = { ...session, expiresAt: Date.now() - 1000 };
  assert.equal(validateAdminSession(expiredSession), false);

  // Rejects unconfigured or unauthorized login attempts without hardcoded password fallback
  const failedAuth = await authenticateAdmin('admin@roxanateusde.ro', 'orice-parola');
  assert.equal(failedAuth.success, false);
});

test('Scenariul 10 & 12 în dataService: createBooking și updateBookingStatus aplică Turnstile, programul oficial și excepția administrativă cu motiv', async () => {
  // Mock localStorage in Node environment
  const store = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  };

  // 1. Bookings CRUD + deleting all bookings must return [] and NOT restore demo bookings
  const initialBookings = await dataService.getBookings();
  assert.ok(initialBookings.length > 0);
  for (const b of initialBookings) {
    await dataService.deleteBooking(b.id);
  }
  const afterDeleteAll = await dataService.getBookings();
  assert.equal(afterDeleteAll.length, 0, 'Deleting all bookings should not re-populate demo bookings');

  // 1b. Scenariul 10: Verify createBooking strictly blocks missing or invalid Turnstile tokens
  await assert.rejects(
    async () => {
      await dataService.createBooking(
        {
          clientName: 'Ionut Test',
          clientEmail: 'ionut@example.ro',
          clientPhone: '0740112233',
          serviceId: 'tuns-skin-fade',
          serviceName: 'Tuns Modern Skin Fade',
          eventDate: '2026-11-12',
          eventTime: '11:00',
          location: 'Atelier Tileagd',
          estimatedTotal: 70,
          depositAmount: 0,
        },
        ''
      );
    },
    /Turnstile/i
  );

  // 1c. Verify createBooking rejects Friday 15:30 with 60-minute service + addon before even calling network
  await assert.rejects(
    async () => {
      await dataService.createBooking(
        {
          clientName: 'Ionut Test',
          clientEmail: 'ionut@example.ro',
          clientPhone: '0740112233',
          serviceId: 'pachet-complet-tuns-barba', // 60 min
          serviceName: 'Pachet Complet',
          eventDate: '2026-11-13', // Friday
          eventTime: '15:30', // 15:30 + 60m = 16:30 > 16:00
          location: 'Atelier Tileagd',
          estimatedTotal: 100,
          depositAmount: 0,
        },
        '0.valid_turnstile_test_token_length_exceeding_twenty_chars'
      );
    },
    /16:00/i
  );

  // 1d. Verify createBooking strictly blocks bypass when Supabase Edge Function is not reachable/configured
  await assert.rejects(
    async () => {
      await dataService.createBooking(
        {
          clientName: 'Ionut Test',
          clientEmail: 'ionut@example.ro',
          clientPhone: '0740112233',
          serviceId: 'tuns-skin-fade',
          serviceName: 'Tuns Modern Skin Fade',
          eventDate: '2026-11-12',
          eventTime: '11:00',
          location: 'Atelier Tileagd',
          estimatedTotal: 70,
          depositAmount: 0,
        },
        '0.valid_turnstile_test_token_length_exceeding_twenty_chars'
      );
    },
    /Turnstile|Supabase/i
  );

  // 1e. Scenariul 12 în dataService.updateBookingStatus: o programare în ziua de Luni nu poate fi confirmată fără [EXCEPTIE_PROGRAM: <motiv min. 5 caractere>]
  store.set(
    'rxt_barber_bookings_data',
    JSON.stringify([
      {
        id: 'test-monday-booking',
        referenceCode: 'FRZ-2026-9999',
        clientName: 'Client Luni',
        clientEmail: 'luni@example.ro',
        clientPhone: '0740112233',
        serviceId: 'tuns-skin-fade',
        serviceName: 'Tuns Modern Skin Fade',
        eventDate: '2026-11-09', // Luni
        eventTime: '11:00',
        location: 'Atelier Tileagd',
        estimatedTotal: 70,
        depositAmount: 0,
        status: 'in_asteptare',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
  );

  await assert.rejects(
    async () => {
      await dataService.updateBookingStatus('test-monday-booking', 'confirmat', '');
    },
    /EXCEPTIE_PROGRAM/i
  );

  await assert.rejects(
    async () => {
      await dataService.updateBookingStatus('test-monday-booking', 'confirmat', '[EXCEPTIE_PROGRAM: abc]');
    },
    /EXCEPTIE_PROGRAM/i
  );

  const okWithValidException = await dataService.updateBookingStatus(
    'test-monday-booking',
    'confirmat',
    '[EXCEPTIE_PROGRAM: Programare speciala aprobata de Roxana]'
  );
  assert.equal(okWithValidException, true);

  // 2. Services CRUD
  const newSvc = await dataService.addService({
    title: 'Serviciu Test',
    category: 'tuns',
    price: 85,
    duration: '45 minute',
    durationMin: 45,
    popular: false,
    description: 'Descriere test',
    imageUrl: 'https://example.com/test.jpg',
    features: ['F1'],
  });
  assert.equal(newSvc.price, 85);
  await dataService.updateService({ ...newSvc, price: 95 });
  const svcsAfterUpdate = await dataService.getServices();
  assert.equal(svcsAfterUpdate.find(s => s.id === newSvc.id)?.price, 95);
  await dataService.deleteService(newSvc.id);
  const svcsAfterDelete = await dataService.getServices();
  assert.equal(svcsAfterDelete.some(s => s.id === newSvc.id), false);

  // 3. Addons CRUD
  const newAddon = await dataService.addAddon({
    name: 'Tratament Test',
    priceRon: 30,
    durationMin: 15,
    description: 'Extra',
  });
  await dataService.updateAddon({ ...newAddon, priceRon: 45 });
  const addonsAfterUpdate = await dataService.getAddons();
  assert.equal(addonsAfterUpdate.find(a => a.id === newAddon.id)?.priceRon, 45);
  await dataService.deleteAddon(newAddon.id);
  const addonsAfterDelete = await dataService.getAddons();
  assert.equal(addonsAfterDelete.some(a => a.id === newAddon.id), false);

  delete (globalThis as any).window;
});

test('mapsUtils calculates route to Str. Plopilor 28', () => {
  const preset = PRESET_ORIGINS[0];
  assert.ok(preset.distanceKm > 0);
  assert.ok(preset.durationDriveMin > 0);

  const navUrl = getGoogleMapsDirectionsUrl('Tileagd (Centru)');
  assert.ok(navUrl.includes('47.0720225') && navUrl.includes('22.1974235'));
  assert.equal(getGoogleMapsDirectionsUrl(), 'https://maps.app.goo.gl/5VWHefyfAgicsNBn6');

  const dynamic = calculateDynamicRoute('Salonta, Bihor');
  assert.ok(dynamic.distanceKm > 0);
  assert.ok(dynamic.turnByTurn.length > 0);
});

test('Migrarea incrementală 20261102000000 și Edge Function create-booking-turnstile respectă toate cerințele de securitate și non-distructivitate', async () => {
  const fs = await import('node:fs');
  const incrementalSql = fs.readFileSync(
    'supabase/migrations/20261102000000_incremental_booking_security_remediation.sql',
    'utf8'
  );
  const executableSqlOnly = incrementalSql.replace(/--.*$/gm, '');
  const edgeFnCode = fs.readFileSync('supabase/functions/create-booking-turnstile/index.ts', 'utf8');

  // 1. Zero comenzi distructive în migrarea incrementală
  assert.equal(/\bTRUNCATE\b/i.test(executableSqlOnly), false, 'Incremental migration must NEVER use TRUNCATE');
  assert.equal(/\bDROP\s+TABLE\b/i.test(executableSqlOnly), false, 'Incremental migration must NEVER use DROP TABLE');

  // 2. Funcția safe_jwt_role() și tratarea NULL în public.is_admin()
  assert.ok(incrementalSql.includes('CREATE OR REPLACE FUNCTION public.safe_jwt_role()'));
  assert.ok(incrementalSql.includes('COALESCE(public.is_admin(), FALSE)'));

  // 3. RPC atomică create_public_booking_with_turnstile + legarea strictă token_hash <-> reference_code (fără consumarea „celui mai recent nonce”)
  assert.ok(incrementalSql.includes('CREATE OR REPLACE FUNCTION public.create_public_booking_with_turnstile('));
  assert.ok(incrementalSql.includes("PERFORM set_config('app.turnstile_token_hash', v_clean_hash, true);"));
  assert.ok(incrementalSql.includes("PERFORM set_config('app.turnstile_reference_code', v_clean_ref, true);"));
  assert.ok(incrementalSql.includes('WHERE token_hash = v_guc_token_hash'));
  assert.ok(incrementalSql.includes('AND expected_reference_code = NEW.reference_code'));
  assert.equal(
    incrementalSql.includes('ORDER BY created_at DESC'),
    false,
    'Must NOT consume the latest unconsumed nonce without binding to the current request'
  );

  // 4. Edge Function verifică siteverify, action === create_booking, hostname, challenge_ts și apelează RPC-ul atomic
  assert.ok(edgeFnCode.includes('https://challenges.cloudflare.com/turnstile/v0/siteverify'));
  assert.ok(edgeFnCode.includes("verifyResult.action !== 'create_booking'"));
  assert.ok(edgeFnCode.includes('isHostnameAuthorized('));
  assert.ok(edgeFnCode.includes("supabaseAdmin.rpc('create_public_booking_with_turnstile'"));

  // 5. Tabelul de audit pentru excepții de program și verificarea suprapunerilor înainte de EXCLUDE USING gist
  assert.ok(incrementalSql.includes('CREATE TABLE IF NOT EXISTS public.booking_schedule_exceptions_audit'));
  assert.ok(incrementalSql.includes('bookings_no_overlapping_active_slots_excl'));
  assert.ok(incrementalSql.includes('IF v_overlap_count = 0 THEN'));
});
