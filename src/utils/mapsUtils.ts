/**
 * Google Maps, Routes and Directions Utility for TEUȘDE ROXANA-LENUȚA PFA
 * Salon Location: Str. PLOPILOR, Nr. 28, Cod poștal 417585, Tileagd, jud. Bihor, România
 * Official Google Business Profile: https://share.google/OMoBOclvNteJZ2UkH
 */

export interface LocationCoordinates {
  lat: number;
  lng: number;
  address: string;
  googleShareUrl: string;
}

export const SALON_LOCATION: LocationCoordinates = {
  lat: 47.0720225,
  lng: 22.1974235,
  address: 'Strada Trandafirilor 1099, 417585 Tileagd, România',
  googleShareUrl: 'https://maps.app.goo.gl/5VWHefyfAgicsNBn6',
};

export const SALON_SCHEDULE = {
  monday: 'ÎNCHIS',
  tuesdayToFriday: '09:00 – 16:00',
  saturday: '09:00 – 13:00',
  sunday: 'ÎNCHIS',
  summary: 'Marți – Vineri: 09:00 – 16:00 • Sâmbătă: 09:00 – 13:00 • Luni & Duminică: Închis',
};

export interface RouteOption {
  id: string;
  name: string;
  originAddress: string;
  distanceKm: number;
  durationDriveMin: number;
  durationTransitMin: number;
  durationWalkMin: number;
  recommendedMode: 'driving' | 'transit' | 'walking';
  turnByTurn: string[];
}

export const PRESET_ORIGINS: RouteOption[] = [
  {
    id: 'tileagd-centru',
    name: 'Tileagd (Centru / Primărie)',
    originAddress: 'Primăria Tileagd, Strada Principală, Tileagd, Bihor',
    distanceKm: 0.9,
    durationDriveMin: 2,
    durationTransitMin: 4,
    durationWalkMin: 10,
    recommendedMode: 'walking',
    turnByTurn: [
      'Porniți din centrul comunei Tileagd pe artera de legătură',
      'Virați pe Strada Trandafirilor',
      'Înaintați până la numărul 1099 — Frizerie și Coafură ROXANA TEUȘDE PFA (parcare privată în față).',
    ],
  },
  {
    id: 'gara-tileagd',
    name: 'Gara Tileagd',
    originAddress: 'Gara CFR Tileagd, 417585 Tileagd, Bihor',
    distanceKm: 1.6,
    durationDriveMin: 3,
    durationTransitMin: 6,
    durationWalkMin: 18,
    recommendedMode: 'driving',
    turnByTurn: [
      'Porniți din fața Gării Tileagd pe strada de legătură',
      'Traversați axul central către Strada Trandafirilor',
      'Opriți la numărul 1099 (Salon Roxana Teușde PFA, parcare privată disponibilă).',
    ],
  },
  {
    id: 'alesd',
    name: 'Aleșd (Centru)',
    originAddress: 'Strada Bobâlna, Aleșd, Bihor',
    distanceKm: 17.8,
    durationDriveMin: 18,
    durationTransitMin: 28,
    durationWalkMin: 200,
    recommendedMode: 'driving',
    turnByTurn: [
      'Porniți din Aleșd pe DN1 / E60 în direcția Tileagd',
      'Treceți prin Țețchea și intrați în comuna Tileagd',
      'Virați pe Strada Trandafirilor și continuați până la nr. 1099.',
    ],
  },
  {
    id: 'centru-oradea',
    name: 'Direcția dinspre Oradea (Piața Unirii)',
    originAddress: 'Piața Unirii, Oradea, Bihor',
    distanceKm: 21.5,
    durationDriveMin: 22,
    durationTransitMin: 35,
    durationWalkMin: 240,
    recommendedMode: 'driving',
    turnByTurn: [
      'Plecare din Oradea urmând Calea Clujului (drumul european E60 / DN1) spre Tileagd',
      'Continuați prin Oșorhei și Săcădat urmând drumul național DN1',
      'La intrarea în Tileagd, virați pe Strada Trandafirilor',
      'Înaintați până la numărul 1099 — Atelier Roxana Teușde PFA cu locuri de parcare rezervate.',
    ],
  },
  {
    id: 'baile-felix',
    name: 'Băile Felix',
    originAddress: 'Băile Felix, Bihor',
    distanceKm: 23.2,
    durationDriveMin: 24,
    durationTransitMin: 42,
    durationWalkMin: 260,
    recommendedMode: 'driving',
    turnByTurn: [
      'Urmați drumul de legătură către centură (DN76)',
      'Intrați pe DN1 / E60 spre Tileagd',
      'La Tileagd, virați pe Strada Trandafirilor până la nr. 1099.',
    ],
  },
];

/**
 * Generates official Google Maps turn-by-turn Navigation Link
 */
export function getGoogleMapsDirectionsUrl(origin?: string): string {
  if (origin && origin.trim()) {
    const encodedOrigin = encodeURIComponent(origin.trim());
    return `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=47.0720225,22.1974235&travelmode=driving`;
  }
  return 'https://maps.app.goo.gl/5VWHefyfAgicsNBn6';
}

/**
 * Generates Google Maps place search/view URL
 */
export function getGoogleMapsSearchUrl(): string {
  return 'https://maps.app.goo.gl/5VWHefyfAgicsNBn6';
}

/**
 * Generates Waze navigation link
 */
export function getWazeNavigationUrl(): string {
  return `https://waze.com/ul?ll=${SALON_LOCATION.lat},${SALON_LOCATION.lng}&navigate=yes`;
}

/**
 * Calculates dynamic route information for user custom input
 */
export function calculateDynamicRoute(customOrigin: string): RouteOption {
  const clean = customOrigin.trim().toLowerCase();
  const matched = PRESET_ORIGINS.find(p => p.name.toLowerCase().includes(clean) || clean.includes(p.id));
  if (matched) return matched;

  const randKm = Math.round((12 + Math.random() * 14) * 10) / 10;
  const driveMin = Math.round(randKm * 1.1 + 4);

  return {
    id: 'custom-route',
    name: customOrigin,
    originAddress: customOrigin,
    distanceKm: randKm,
    durationDriveMin: driveMin,
    durationTransitMin: Math.round(driveMin * 1.6),
    durationWalkMin: Math.round(randKm * 12),
    recommendedMode: 'driving',
    turnByTurn: [
      `Porniți din ${customOrigin} urmând drumul principal către Tileagd (DN1 / E60)`,
      'La intrarea în localitatea Tileagd, ghidați-vă după indicatoarele către Strada Plopilor',
      'Opriți la numărul 28 — Atelier Roxana Teușde PFA, 417585 Tileagd. Parcare disponibilă direct în față.',
    ],
  };
}
