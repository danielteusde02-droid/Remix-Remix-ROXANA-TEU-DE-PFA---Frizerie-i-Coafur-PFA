/**
 * Pure utility functions for ROXANA TEUSDE PFA - Frizerie & Barbershop
 * Barbershop appointment validations, calculations, reference generators, and currency formatters.
 */

export interface BarbershopAddons {
  hotTowelTreatment?: boolean;
  hairWashStyling?: boolean;
  blackMask?: boolean;
  beardCamouflage?: boolean;
  headMassage?: boolean;
  eyebrowStyling?: boolean;
  [key: string]: boolean | undefined;
}

export const BARBERSHOP_ADDON_PRICES: Record<keyof BarbershopAddons, { name: string; priceRon: number; durationMin: number }> = {
  hotTowelTreatment: { name: 'Tratament cu prosop cald și uleiuri esențiale', priceRon: 25, durationMin: 10 },
  hairWashStyling: { name: 'Spălat dublu revitalizant + Styling profesional', priceRon: 20, durationMin: 10 },
  blackMask: { name: 'Mască neagră detoxifiantă cu cărbune activ (Black Mask)', priceRon: 35, durationMin: 15 },
  beardCamouflage: { name: 'Camuflaj & nuanțare fire albe barbă', priceRon: 40, durationMin: 15 },
  headMassage: { name: 'Masaj capilar relaxant cu tonic mentolat', priceRon: 30, durationMin: 10 },
  eyebrowStyling: { name: 'Stilizare & conturare sprâncene', priceRon: 15, durationMin: 5 },
};

/**
 * Official Working Hours for Frizerie & Coafură Roxana Teușde PFA (Buie):
 * - Luni: ÎNCHIS
 * - Marți – Vineri: 09:00 – 16:00
 * - Sâmbătă: 09:00 – 13:00
 * - Duminică: ÎNCHIS
 */
export const SALON_WORKING_HOURS = {
  monday: 'Închis',
  tuesdayToFriday: '09:00 – 16:00',
  saturday: '09:00 – 13:00',
  sunday: 'Închis',
  summaryShort: 'Marți – Vineri: 09:00 – 16:00 • Sâmbătă: 09:00 – 13:00 • Luni & Duminică: Închis',
};

export const WEEKDAY_OPEN_MIN = 9 * 60; // 09:00 (540)
export const WEEKDAY_CLOSE_MIN = 16 * 60; // 16:00 (960)
export const SATURDAY_OPEN_MIN = 9 * 60; // 09:00 (540)
export const SATURDAY_CLOSE_MIN = 13 * 60; // 13:00 (780)

export const WEEKDAY_TIME_SLOTS = [
  '09:00', '09:45', '10:30', '11:15', '12:00', '12:45', '13:30', '14:15', '15:00', '15:30'
];

export const SATURDAY_TIME_SLOTS = [
  '09:00', '09:45', '10:30', '11:15', '12:00', '12:30'
];

export const AVAILABLE_TIME_SLOTS = WEEKDAY_TIME_SLOTS;

export type ScheduleViolationType =
  | 'INVALID_FORMAT'
  | 'PAST_DATE'
  | 'PAST_TIME_TODAY'
  | 'CLOSED_MONDAY'
  | 'CLOSED_SUNDAY'
  | 'OUTSIDE_HOURS_TUE_FRI'
  | 'OUTSIDE_HOURS_SATURDAY';

export interface ScheduleValidationResult {
  valid: boolean;
  error?: string;
  violationType?: ScheduleViolationType;
  exceptionReason?: string;
}

export interface TimeSlotAvailability {
  time: string;
  disabled: boolean;
  reason?: string;
}

/**
 * Strictly parses HH:MM into minutes from midnight (0..1439), or null if invalid.
 */
export function parseTimeMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(trimmed)) return null;
  const [h, m] = trimmed.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Returns current date (YYYY-MM-DD) and minutes since midnight in Europe/Bucharest timezone.
 */
export function getRomaniaNowParts(now: Date = new Date()): { dateString: string; minutesSinceMidnight: number } {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Bucharest',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hourRaw = parseInt(getPart('hour'), 10);
    const hour = hourRaw === 24 ? 0 : hourRaw;
    const minute = parseInt(getPart('minute'), 10);

    if (year && month && day && !Number.isNaN(hour) && !Number.isNaN(minute)) {
      return {
        dateString: `${year}-${month}-${day}`,
        minutesSinceMidnight: hour * 60 + minute,
      };
    }
  } catch {
    // Fallback to local time if Intl timezone fails
  }

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return {
    dateString: `${y}-${m}-${d}`,
    minutesSinceMidnight: now.getHours() * 60 + now.getMinutes(),
  };
}

/**
 * Checks if a date/time is in the past or if the time has already passed today in Europe/Bucharest.
 */
export function isTimeSlotPastForToday(eventDate: string, eventTime: string, now: Date = new Date()): boolean {
  if (!eventDate || !eventTime) return false;
  const startMin = parseTimeMinutes(eventTime);
  if (startMin === null) return false;

  const romaniaNow = getRomaniaNowParts(now);
  if (eventDate < romaniaNow.dateString) {
    return true;
  }
  if (eventDate === romaniaNow.dateString && startMin <= romaniaNow.minutesSinceMidnight) {
    return true;
  }
  return false;
}

/**
 * Extracts and validates the explicit administrative schedule exception reason from adminNotes.
 * Requires format: `[EXCEPTIE_PROGRAM: <motiv de minimum 5 caractere>]`
 */
export function extractAdminScheduleExceptionReason(adminNotes?: string): string | null {
  if (!adminNotes || typeof adminNotes !== 'string') return null;
  const match = adminNotes.match(/\[EXCEPTIE_PROGRAM:\s*([^\]]+)\]/);
  if (!match || !match[1]) return null;
  const reason = match[1].trim();
  return reason.length >= 5 ? reason : null;
}

/**
 * Formats an administrative schedule exception tag with mandatory reason.
 */
export function formatAdminScheduleExceptionTag(reason: string): string {
  const cleanReason = (reason || '').replace(/[\[\]]/g, '').trim();
  return `[EXCEPTIE_PROGRAM: ${cleanReason}]`;
}

/**
 * Checks whether a given YYYY-MM-DD date falls on a closed day (Monday = 1 or Sunday = 0)
 */
export function isSalonClosedOnDate(dateString: string): boolean {
  if (!dateString) return false;
  const parts = dateString.split('-');
  if (parts.length !== 3) return false;
  const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(dateObj.getTime())) return false;
  const dayOfWeek = dateObj.getDay();
  return dayOfWeek === 0 || dayOfWeek === 1;
}

/**
 * Returns the next open salon date (YYYY-MM-DD), skipping Sunday (0) and Monday (1),
 * and moving to the next day if today's closing time has already passed.
 */
export function getNextOpenDateString(baseDate = new Date()): string {
  const romaniaNow = getRomaniaNowParts(baseDate);
  const [yInit, mInit, dInit] = romaniaNow.dateString.split('-').map(Number);
  const candidate = new Date(yInit, mInit - 1, dInit);

  const checkNeedsNextDay = (dt: Date, isToday: boolean) => {
    const dow = dt.getDay();
    if (dow === 0 || dow === 1) return true;
    if (isToday) {
      const closeMin = dow === 6 ? SATURDAY_CLOSE_MIN : WEEKDAY_CLOSE_MIN;
      // If less than 30 minutes remain before closing today, advance to next day
      if (romaniaNow.minutesSinceMidnight + 30 > closeMin) {
        return true;
      }
    }
    return false;
  };

  let isFirstIteration = true;
  while (checkNeedsNextDay(candidate, isFirstIteration)) {
    candidate.setDate(candidate.getDate() + 1);
    isFirstIteration = false;
  }

  const y = candidate.getFullYear();
  const m = String(candidate.getMonth() + 1).padStart(2, '0');
  const d = String(candidate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns available booking slots based on the chosen day of the week:
 * - Luni (1) & Duminică (0): [] (Închis)
 * - Marți – Vineri (2..5): 09:00 – 16:00
 * - Sâmbătă (6): 09:00 – 13:00
 */
export function getTimeSlotsForDate(dateString: string): string[] {
  if (!dateString) return WEEKDAY_TIME_SLOTS;
  const parts = dateString.split('-');
  if (parts.length !== 3) return WEEKDAY_TIME_SLOTS;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const dateObj = new Date(year, month, day);
  const dayOfWeek = dateObj.getDay(); // 0: Duminică, 1: Luni, 2..5: Marți..Vineri, 6: Sâmbătă

  if (dayOfWeek === 0 || dayOfWeek === 1) {
    return []; // Luni și Duminică este închis
  }
  if (dayOfWeek === 6) {
    return SATURDAY_TIME_SLOTS; // Sâmbătă: 09:00 - 13:00
  }
  return WEEKDAY_TIME_SLOTS; // Marți - Vineri: 09:00 - 16:00
}

/**
 * Returns detailed slot availability for a date, taking into account:
 * 1. Closed days (Luni & Duminică)
 * 2. Hours that have already passed on the current day (Europe/Bucharest)
 * 3. Total duration (service + addons) exceeding closing time (16:00 Tue-Fri, 13:00 Sat)
 */
export function getAvailableTimeSlotsForDate(
  dateString: string,
  durationMin = 40,
  now: Date = new Date()
): TimeSlotAvailability[] {
  const baseSlots = getTimeSlotsForDate(dateString);
  if (baseSlots.length === 0) return [];

  const parts = dateString.split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayOfWeek = dateObj.getDay();
  const closeMin = dayOfWeek === 6 ? SATURDAY_CLOSE_MIN : WEEKDAY_CLOSE_MIN;
  const closeLabel = dayOfWeek === 6 ? '13:00' : '16:00';
  const effectiveDuration = Math.max(10, durationMin || 40);

  return baseSlots.map(slot => {
    const startMin = parseTimeMinutes(slot);
    if (startMin === null) {
      return { time: slot, disabled: true, reason: 'Format oră invalid' };
    }

    if (isTimeSlotPastForToday(dateString, slot, now)) {
      return {
        time: slot,
        disabled: true,
        reason: 'Ora a trecut deja pentru ziua de astăzi',
      };
    }

    if (startMin + effectiveDuration > closeMin) {
      return {
        time: slot,
        disabled: true,
        reason: `Durata serviciului (${effectiveDuration} min) depășește ora închiderii (${closeLabel})`,
      };
    }

    return { time: slot, disabled: false };
  });
}

/**
 * Validates a booking's date, start time, and total duration against the official salon schedule,
 * past-time rules, and administrative exception rules.
 */
export function validateBookingScheduleAndDuration(params: {
  eventDate: string;
  eventTime: string;
  durationMin: number;
  isAdmin?: boolean;
  adminNotes?: string;
  now?: Date;
}): ScheduleValidationResult {
  const { eventDate, eventTime, durationMin, isAdmin = false, adminNotes = '', now = new Date() } = params;

  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate.trim())) {
    return {
      valid: false,
      violationType: 'INVALID_FORMAT',
      error: 'Data programării este invalidă.',
    };
  }

  const startMin = parseTimeMinutes(eventTime);
  if (startMin === null) {
    return {
      valid: false,
      violationType: 'INVALID_FORMAT',
      error: 'Formatul orei este invalid. Folosiți formatul HH:MM.',
    };
  }

  const parts = eventDate.trim().split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  if (
    isNaN(dateObj.getTime()) ||
    dateObj.getFullYear() !== parts[0] ||
    dateObj.getMonth() !== parts[1] - 1 ||
    dateObj.getDate() !== parts[2]
  ) {
    return {
      valid: false,
      violationType: 'INVALID_FORMAT',
      error: 'Data calendaristică selectată nu există.',
    };
  }

  const romaniaNow = getRomaniaNowParts(now);

  if (!isAdmin) {
    if (eventDate < romaniaNow.dateString) {
      return {
        valid: false,
        violationType: 'PAST_DATE',
        error: 'Data programării nu poate fi în trecut.',
      };
    }
    if (eventDate === romaniaNow.dateString && startMin <= romaniaNow.minutesSinceMidnight) {
      return {
        valid: false,
        violationType: 'PAST_TIME_TODAY',
        error: `Ora selectată (${eventTime}) a trecut deja pentru ziua de astăzi. Vă rugăm să alegeți o oră viitoare.`,
      };
    }
  }

  const effectiveDuration = Math.max(10, Math.min(480, Number(durationMin) || 40));
  const endMin = startMin + effectiveDuration;
  const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, 2..5 = Tue..Fri, 6 = Sat

  let violationType: ScheduleViolationType | undefined;
  let publicErrorMsg = '';

  if (dayOfWeek === 1) {
    violationType = 'CLOSED_MONDAY';
    publicErrorMsg = 'Atelierul este închis lunea. Programul de lucru este Marți–Vineri 09:00–16:00 și Sâmbătă 09:00–13:00.';
  } else if (dayOfWeek === 0) {
    violationType = 'CLOSED_SUNDAY';
    publicErrorMsg = 'Atelierul este închis duminica. Programul de lucru este Marți–Vineri 09:00–16:00 și Sâmbătă 09:00–13:00.';
  } else if (dayOfWeek >= 2 && dayOfWeek <= 5) {
    if (startMin < WEEKDAY_OPEN_MIN || startMin >= WEEKDAY_CLOSE_MIN || endMin > WEEKDAY_CLOSE_MIN) {
      violationType = 'OUTSIDE_HOURS_TUE_FRI';
      publicErrorMsg = `De marți până vineri, programările trebuie să înceapă după ora 09:00 și să se finalizeze cel târziu la ora 16:00 (ora ${eventTime} + durata ${effectiveDuration} min depășește ora închiderii 16:00).`;
    }
  } else if (dayOfWeek === 6) {
    if (startMin < SATURDAY_OPEN_MIN || startMin >= SATURDAY_CLOSE_MIN || endMin > SATURDAY_CLOSE_MIN) {
      violationType = 'OUTSIDE_HOURS_SATURDAY';
      publicErrorMsg = `Sâmbăta, programările trebuie să înceapă după ora 09:00 și să se finalizeze cel târziu la ora 13:00 (ora ${eventTime} + durata ${effectiveDuration} min depășește ora închiderii 13:00).`;
    }
  }

  if (violationType) {
    if (!isAdmin) {
      return {
        valid: false,
        violationType,
        error: publicErrorMsg,
      };
    }

    const exceptionReason = extractAdminScheduleExceptionReason(adminNotes);
    if (!exceptionReason) {
      return {
        valid: false,
        violationType,
        error:
          violationType === 'CLOSED_MONDAY' || violationType === 'CLOSED_SUNDAY'
            ? `Atelierul este închis ${dayOfWeek === 1 ? 'lunea' : 'duminica'}. Confirmarea sau mutarea unei programări în zilele închise necesită o excepție administrativă explicită cu motiv de minimum 5 caractere: [EXCEPTIE_PROGRAM: motiv].`
            : `Intervalul (${eventTime}, ${effectiveDuration} min) depășește programul oficial. Pentru excepții administrative este obligatorie menționarea motivului (min. 5 caractere): [EXCEPTIE_PROGRAM: motiv].`,
      };
    }

    return {
      valid: true,
      violationType,
      exceptionReason,
    };
  }

  return { valid: true };
}

/**
 * Checks whether two active bookings overlap on the same date and barber.
 */
export function doBookingsOverlap(
  a: { eventDate: string; eventTime: string; durationMin?: number; barberName?: string },
  b: { eventDate: string; eventTime: string; durationMin?: number; barberName?: string }
): boolean {
  if (!a.eventDate || !b.eventDate || a.eventDate !== b.eventDate) return false;
  const barberA = (a.barberName || 'Roxana Teușde (Buie)').trim();
  const barberB = (b.barberName || 'Roxana Teușde (Buie)').trim();
  if (barberA !== barberB) return false;

  const startA = parseTimeMinutes(a.eventTime);
  const startB = parseTimeMinutes(b.eventTime);
  if (startA === null || startB === null) return false;

  const durA = Math.max(10, Number(a.durationMin) || 40);
  const durB = Math.max(10, Number(b.durationMin) || 40);

  return startA < startB + durB && startB < startA + durA;
}

/**
 * Validates Romanian phone number format (accepts 07xxxxxxxx, +407xxxxxxxx, 00407xxxxxxxx, with or without spaces/dashes)
 */
export function validateRomanianPhone(phone: string): boolean {
  if (!phone) return false;
  const clean = phone.replace(/[\s\-\.\(\)]/g, '');
  const roPhoneRegex = /^(?:(?:\+40|0040)|0)7[0-9]{8}$/;
  return roPhoneRegex.test(clean);
}

/**
 * Validates email address format
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(trimmed);
}

/**
 * Generates a unique frizerie appointment reference code (e.g., FRZ-2026-7842)
 */
export function generateBookingReference(date = new Date()): string {
  const year = date.getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `FRZ-${year}-${randomSuffix}`;
}

/**
 * Calculates total appointment cost and duration based on service price and chosen addons
 */
export function calculateBarberEstimate(
  baseServicePriceRon: number,
  baseDurationMin = 30,
  addons: BarbershopAddons = {},
  addonCatalog?: Array<{ id: string; priceRon: number; durationMin: number }>
): {
  basePrice: number;
  addonsTotal: number;
  finalTotal: number;
  totalDurationMin: number;
} {
  const basePrice = Math.max(0, baseServicePriceRon);
  let addonsTotal = 0;
  let extraDuration = 0;

  for (const [key, enabled] of Object.entries(addons)) {
    if (enabled) {
      if (addonCatalog && addonCatalog.length > 0) {
        const item = addonCatalog.find(a => a.id === key);
        if (item) {
          addonsTotal += item.priceRon;
          extraDuration += item.durationMin;
          continue;
        }
      }
      if (BARBERSHOP_ADDON_PRICES[key as keyof BarbershopAddons]) {
        addonsTotal += BARBERSHOP_ADDON_PRICES[key as keyof BarbershopAddons].priceRon;
        extraDuration += BARBERSHOP_ADDON_PRICES[key as keyof BarbershopAddons].durationMin;
      }
    }
  }

  const finalTotal = basePrice + addonsTotal;
  const totalDurationMin = baseDurationMin + extraDuration;

  return {
    basePrice,
    addonsTotal,
    finalTotal,
    totalDurationMin,
  };
}

/**
 * Formats RON currency
 */
export function formatRon(amount: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats a Romanian date (e.g. "18 iulie 2026")
 */
export function formatRomanianDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Formats a Romanian date with the day of the week (e.g. "Luni, 23 noiembrie 2026")
 */
export function formatRomanianDateWithDay(dateString: string): string {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(date.getTime())) return dateString;

  const dayNames = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
  const monthNames = [
    'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
    'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'
  ];

  const dayName = dayNames[date.getDay()];
  const dayNum = date.getDate();
  const monthName = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName}, ${dayNum} ${monthName} ${year}`;
}
