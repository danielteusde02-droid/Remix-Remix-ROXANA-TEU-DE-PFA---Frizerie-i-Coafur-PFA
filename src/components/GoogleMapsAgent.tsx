import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import {
  MapPin,
  Navigation,
  Compass,
  Car,
  Bus,
  Footprints,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Clock,
  Star,
  Layers,
  Phone,
  Scissors,
  Crosshair,
  Loader2
} from 'lucide-react';
import {
  calculateDynamicRoute,
  getGoogleMapsDirectionsUrl,
  getWazeNavigationUrl,
  PRESET_ORIGINS,
  RouteOption,
  SALON_LOCATION
} from '../utils/mapsUtils';

const CUSTOM_GOOGLE_MAPS_API_KEY = (
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
).trim();

const HAS_VALID_MAPS_SDK_KEY = Boolean(
  CUSTOM_GOOGLE_MAPS_API_KEY &&
    CUSTOM_GOOGLE_MAPS_API_KEY !== 'YOUR_API_KEY' &&
    CUSTOM_GOOGLE_MAPS_API_KEY.length >= 20
);

export const GoogleMapsAgent: React.FC = () => {
  const [originInput, setOriginInput] = useState('Tileagd (Centru / Primărie)');
  const [selectedRoute, setSelectedRoute] = useState<RouteOption>(PRESET_ORIGINS[0]);
  const [travelMode, setTravelMode] = useState<'driving' | 'transit' | 'walking'>('driving');
  const [isCalculating, setIsCalculating] = useState(false);
  const [infoOpen, setInfoOpen] = useState(true);
  const [sdkFailed, setSdkFailed] = useState<boolean>(!HAS_VALID_MAPS_SDK_KEY);
  const [viewMode, setViewMode] = useState<'sdk' | 'embed'>(
    HAS_VALID_MAPS_SDK_KEY ? 'sdk' : 'embed'
  );
  const [gpsLoading, setGpsLoading] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  React.useEffect(() => {
    const handleFallback = () => {
      setSdkFailed(true);
      setViewMode('embed');
    };
    window.addEventListener('gmp-script-fallback', handleFallback);
    window.addEventListener('gmp-quota-exceeded', handleFallback);
    return () => {
      window.removeEventListener('gmp-script-fallback', handleFallback);
      window.removeEventListener('gmp-quota-exceeded', handleFallback);
    };
  }, []);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setOriginInput('Locația Mea Curentă (GPS)');
      setGpsMessage('Dispozitivul va folosi poziția curentă la pornirea Google Maps.');
      return;
    }

    setGpsLoading(true);
    setGpsMessage('Se detectează coordonatele GPS ale dispozitivului tău...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        setOriginInput('Locația Ta Curentă (GPS Detectat)');

        // Haversine distance in km
        const R = 6371;
        const dLat = ((SALON_LOCATION.lat - latitude) * Math.PI) / 180;
        const dLon = ((SALON_LOCATION.lng - longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((latitude * Math.PI) / 180) *
            Math.cos((SALON_LOCATION.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distKm = Math.round(R * c * 10) / 10;
        const driveMin = Math.max(1, Math.round(distKm * 1.2 + 2));

        setSelectedRoute({
          id: 'user-gps-route',
          name: 'Locația Ta Curentă (GPS Direct)',
          originAddress: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          distanceKm: distKm,
          durationDriveMin: driveMin,
          durationTransitMin: Math.round(driveMin * 1.5),
          durationWalkMin: Math.round(distKm * 12),
          recommendedMode: distKm < 1 ? 'walking' : 'driving',
          turnByTurn: [
            `Pornire din coordonatele GPS curente ale dispozitivului tău`,
            distKm > 2
              ? 'Urmați traseul optim indicat de navigație către comuna Tileagd (DN1 / E60)'
              : 'Navigați pe artera principală către Strada Trandafirilor',
            'La Tileagd, virați pe Strada Trandafirilor',
            'Opriți la numărul 1099 — Frizerie și Coafură ROXANA TEUȘDE PFA (parcare privată gratuită direct în față).',
          ],
        });

        setGpsLoading(false);
        setGpsMessage(`Locație GPS detectată! Distanță până la salon: ${distKm} km.`);
      },
      () => {
        setGpsLoading(false);
        setUserCoords(null);
        setOriginInput('Locația Mea Curentă (GPS)');
        setGpsMessage('Navigația Google Maps se va deschide automat din locația ta curentă.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleSelectPreset = (preset: RouteOption) => {
    setUserCoords(null);
    setGpsMessage(null);
    setOriginInput(preset.name);
    setSelectedRoute(preset);
  };

  const handleCalculateRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originInput.trim()) return;

    if (originInput.toLowerCase().includes('locația')) {
      handleUseCurrentLocation();
      return;
    }

    setIsCalculating(true);
    setTimeout(() => {
      const calculated = calculateDynamicRoute(originInput);
      setSelectedRoute(calculated);
      setIsCalculating(false);
    }, 300);
  };

  const currentDuration =
    travelMode === 'driving'
      ? selectedRoute.durationDriveMin
      : travelMode === 'transit'
      ? selectedRoute.durationTransitMin
      : selectedRoute.durationWalkMin;

  return (
    <section id="harta-navigatie" className="py-24 bg-[#0a0b0e] border-b border-[#1c1f26]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-semibold uppercase tracking-wider mb-4">
            <Compass className="w-3.5 h-3.5" />
            <span>Google Maps Platform Live • Asistent Rute &amp; Navigație</span>
          </div>

          <h2 className="font-serif-luxury text-3xl sm:text-5xl text-white font-normal mb-3">
            Cum Ajungi la Noi • Strada Trandafirilor 1099, 417585 Tileagd
          </h2>
          <p className="text-zinc-400 text-base font-light">
            Locație oficială verificată pe Google Maps. Parcare privată gratuită direct în fața atelierului ROXANA TEUȘDE PFA, Strada Trandafirilor 1099, Tileagd, jud. Bihor.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <a
              href={SALON_LOCATION.googleShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-700 hover:border-[#d4af37] text-xs text-amber-300 font-semibold transition-colors"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Profil Oficial Google Maps: Roxana Teusde PFA</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>

            {HAS_VALID_MAPS_SDK_KEY && !sdkFailed && (
              <div className="inline-flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded-full border border-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('sdk')}
                  className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                    viewMode === 'sdk'
                      ? 'bg-[#d4af37] text-zinc-950 font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Hartă Interactivă Live
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('embed')}
                  className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                    viewMode === 'embed'
                      ? 'bg-[#d4af37] text-zinc-950 font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Vedere Rutieră (Embed)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Grid: Map on Left, Agent on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Map Viewer Column (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative rounded-3xl overflow-hidden border-2 border-zinc-700/80 bg-zinc-950 shadow-2xl h-[440px] sm:h-[500px]">
              {viewMode === 'sdk' && HAS_VALID_MAPS_SDK_KEY && !sdkFailed ? (
                <APIProvider apiKey={CUSTOM_GOOGLE_MAPS_API_KEY}>
                  <Map
                    mapId="DEMO_MAP_ID"
                    defaultCenter={{ lat: SALON_LOCATION.lat, lng: SALON_LOCATION.lng }}
                    defaultZoom={16}
                    gestureHandling="cooperative"
                    disableDefaultUI={false}
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <AdvancedMarker
                      position={{ lat: SALON_LOCATION.lat, lng: SALON_LOCATION.lng }}
                      title="Roxana Teusde PFA (Buie) - Frizerie & Barbershop"
                      onClick={() => setInfoOpen(true)}
                    >
                      <Pin
                        background="#d4af37"
                        glyphColor="#0c0d10"
                        borderColor="#ffffff"
                        scale={1.2}
                      />
                    </AdvancedMarker>

                    {infoOpen && (
                      <InfoWindow
                        position={{ lat: SALON_LOCATION.lat, lng: SALON_LOCATION.lng }}
                        onCloseClick={() => setInfoOpen(false)}
                      >
                        <div className="p-2 text-zinc-900 max-w-xs font-sans">
                          <div className="flex items-center gap-1.5 font-bold text-sm text-zinc-950 mb-1">
                            <Scissors className="w-4 h-4 text-[#b8972f]" />
                            <span>Roxana Teușde PFA (Buie)</span>
                          </div>
                          <p className="text-xs text-zinc-600 mb-2 font-medium">
                            Strada Trandafirilor 1099, 417585 Tileagd, România
                          </p>
                          <div className="flex items-center gap-1 text-[11px] text-zinc-500 mb-2">
                            <Clock className="w-3 h-3 text-[#b8972f]" />
                            <span>Ma–Vi: 09:00–16:00 • Sâm: 09:00–13:00 (Lun, Dum: Închis)</span>
                          </div>
                          <a
                            href={SALON_LOCATION.googleShareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#96781d] hover:underline"
                          >
                            <span>Deschide în Google Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </InfoWindow>
                    )}
                  </Map>
                </APIProvider>
              ) : (
                /* Embed fallback */
                <iframe
                  title="Harta Google Maps - Roxana Teusde PFA Strada Trandafirilor 1099, 417585 Tileagd"
                  src="https://maps.google.com/maps?q=47.0720225,22.1974235&t=&z=17&ie=UTF8&iwloc=&output=embed"
                  className="w-full h-full border-0 filter contrast-[1.05]"
                  loading="lazy"
                  allowFullScreen
                />
              )}

              {/* Clickable Location Badge on Map */}
              <a
                href={SALON_LOCATION.googleShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Apasă pentru a deschide Strada Trandafirilor 1099, 417585 Tileagd în Google Maps"
                className="absolute top-4 left-4 bg-[#121418f0] hover:bg-[#1a1d24] backdrop-blur-md border border-zinc-700/70 hover:border-[#d4af37] p-3 rounded-2xl shadow-xl max-w-xs z-10 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#d4af37] group-hover:bg-[#e2bd47] flex items-center justify-center text-zinc-950 shrink-0 shadow-md transition-colors">
                    <MapPin className="w-4 h-4 fill-zinc-950" />
                  </div>
                  <div>
                    <h4 className="font-serif-luxury text-sm text-white font-medium group-hover:text-[#d4af37] transition-colors flex items-center gap-1">
                      <span>ROXANA TEUȘDE PFA</span>
                      <ExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-[#d4af37]" />
                    </h4>
                    <p className="text-[11px] text-[#d4af37] font-semibold">
                      Strada Trandafirilor 1099, 417585 Tileagd
                    </p>
                  </div>
                </div>
              </a>

              {/* Action Buttons Overlay on Map */}
              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2.5 z-10">
                <a
                  href={SALON_LOCATION.googleShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e2bd47] text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                >
                  <Navigation className="w-3.5 h-3.5 fill-zinc-950" />
                  <span>Deschide în Google Maps App</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <a
                  href={getWazeNavigationUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-white font-semibold text-xs border border-zinc-700 flex items-center gap-2 shadow-lg backdrop-blur-md transition-all"
                >
                  <span>Navighează cu Waze</span>
                  <ExternalLink className="w-3 h-3 text-zinc-400" />
                </a>
              </div>
            </div>

            {/* Landmarks Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
                <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Parcare Privată Gratuită</span>
                </div>
                <p className="text-zinc-400 text-[11px]">Locuri dedicate clienților direct la nr. 1099.</p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
                <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
                  <Bus className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Transport OTL</span>
                </div>
                <p className="text-zinc-400 text-[11px]">Stație de transport în comun în proximitate.</p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
                <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>10-12 min din Centru</span>
                </div>
                <p className="text-zinc-400 text-[11px]">Acces fluid prin Bulevardul Nufărul.</p>
              </div>
            </div>
          </div>

          {/* Directions Agent Column (5 cols) */}
          <div className="lg:col-span-5 bg-gradient-to-b from-zinc-900 via-zinc-900 to-[#14161b] border-2 border-zinc-700/80 rounded-3xl p-6 sm:p-7 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#d4af37]" />
                <span className="font-serif-luxury text-lg text-white font-medium">
                  Asistent Inteligent de Traseu
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                Trafic Fluid
              </span>
            </div>

            <div className="mt-3 p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center gap-2 text-[11px] text-zinc-300">
              <Clock className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
              <span>
                <strong>Program Atelier:</strong> Marți–Vineri 09:00–16:00 • Sâmbătă 09:00–13:00 • <span className="text-red-400 font-semibold">Luni &amp; Duminică: ÎNCHIS</span>
              </span>
            </div>

            {/* Origin Input Form */}
            <form onSubmit={handleCalculateRoute} className="mt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    De unde pleci?
                  </label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={gpsLoading}
                    className="text-[11px] text-[#d4af37] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    {gpsLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d4af37]" />
                    ) : (
                      <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{gpsLoading ? 'Se detectează GPS...' : '📍 Folosește Locația Mea (GPS)'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={originInput}
                    onChange={e => {
                      setOriginInput(e.target.value);
                      setUserCoords(null);
                      setGpsMessage(null);
                    }}
                    placeholder="Introdu o adresă sau apasă pe Locația Mea..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#d4af37] focus:outline-none"
                  />
                  <Navigation className="w-3.5 h-3.5 text-[#d4af37] absolute left-3 top-3" />
                </div>
              </div>

              {gpsMessage && (
                <div className="p-2.5 rounded-xl bg-zinc-950/90 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="leading-tight">{gpsMessage}</span>
                </div>
              )}

              {/* Quick Presets */}
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1.5">
                  Repere rapide din zonă:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      userCoords || originInput.includes('Locația')
                        ? 'bg-emerald-500 text-zinc-950 shadow-md'
                        : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                  >
                    <Crosshair className="w-3 h-3 text-emerald-400" />
                    <span>📍 Locația Mea (GPS)</span>
                  </button>

                  {PRESET_ORIGINS.map(p => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => handleSelectPreset(p)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        selectedRoute.id === p.id && !userCoords
                          ? 'bg-[#d4af37] text-zinc-950 font-bold'
                          : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                      }`}
                    >
                      {p.name.split(' (')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Selector */}
              <div className="pt-2">
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Mod de Deplasare:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTravelMode('driving')}
                    className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      travelMode === 'driving'
                        ? 'bg-[#d4af37] text-zinc-950 font-bold shadow'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    <Car className="w-3.5 h-3.5" />
                    <span>Cu Mașina</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTravelMode('transit')}
                    className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      travelMode === 'transit'
                        ? 'bg-[#d4af37] text-zinc-950 font-bold shadow'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    <Bus className="w-3.5 h-3.5" />
                    <span>Transport</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTravelMode('walking')}
                    className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      travelMode === 'walking'
                        ? 'bg-[#d4af37] text-zinc-950 font-bold shadow'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    <Footprints className="w-3.5 h-3.5" />
                    <span>Pe Jos</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isCalculating}
                className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs border border-zinc-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span>{isCalculating ? 'Calculare traseu...' : 'Actualizează Traseul'}</span>
              </button>
            </form>

            {/* Calculated Route Summary Card */}
            <div className="mt-5 pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Distanță Traseu:</span>
                <span className="font-bold text-white text-sm">{selectedRoute.distanceKm} km</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Timp Estimat:</span>
                <span className="font-bold text-[#d4af37] text-base font-serif-luxury">
                  ~{currentDuration} minute
                </span>
              </div>

              {/* Turn by turn steps */}
              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs space-y-2">
                <div className="font-semibold text-zinc-300 text-[11px] uppercase tracking-wider">
                  Indicații de Orientare Pas cu Pas:
                </div>
                <ol className="space-y-1.5 text-zinc-400 list-decimal pl-4 text-[11px] leading-relaxed">
                  {selectedRoute.turnByTurn.map((step, idx) => (
                    <li key={idx}>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Direct Start Navigation Button with live exact client location */}
              <a
                href={
                  userCoords
                    ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=47.0720225,22.1974235&travelmode=${travelMode}`
                    : originInput.includes('Locația')
                    ? `https://www.google.com/maps/dir/?api=1&destination=47.0720225,22.1974235&travelmode=${travelMode}`
                    : `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originInput)}&destination=47.0720225,22.1974235&travelmode=${travelMode}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8972f] hover:from-[#e2be4a] hover:to-[#c6a237] text-zinc-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.99] transition-all"
              >
                <Navigation className="w-4 h-4 fill-zinc-950 shrink-0" />
                <span>
                  {userCoords || originInput.includes('Locația')
                    ? 'Pornește Navigația Google Maps din Locația Ta (GPS Activ)'
                    : `Pornește Navigația din ${originInput.split(' (')[0]}`}
                </span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>

              {/* Quick direct GPS & salon profile links */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=47.0720225,22.1974235&travelmode=${travelMode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors text-center"
                  title="Google Maps va prelua automat poziția GPS curentă a dispozitivului"
                >
                  <Crosshair className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>GPS Direct Dispozitiv</span>
                </a>

                <a
                  href="https://maps.app.goo.gl/5VWHefyfAgicsNBn6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors text-center"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                  <span>Vezi Salon pe Maps</span>
                  <ExternalLink className="w-3 h-3 text-zinc-400 shrink-0" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
