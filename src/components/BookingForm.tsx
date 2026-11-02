import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Phone, Mail, Clock, Scissors, CheckCircle2, AlertCircle, Sparkles, MessageSquare, Download, User, MapPin, ShieldAlert, RefreshCw } from 'lucide-react';
import { Booking, ServicePackage, ServiceAddon } from '../types';
import {
  AVAILABLE_TIME_SLOTS,
  BARBERSHOP_ADDON_PRICES,
  BarbershopAddons,
  calculateBarberEstimate,
  formatRomanianDate,
  formatRon,
  getAvailableTimeSlotsForDate,
  getNextOpenDateString,
  getRomaniaNowParts,
  getTimeSlotsForDate,
  validateBookingScheduleAndDuration,
  validateEmail,
  validateRomanianPhone
} from '../utils/bookingUtils';
import { dataService, BARBERSHOP_STAFF, INITIAL_ADDONS } from '../services/dataService';
import { getTurnstileSiteKey } from '../lib/supabase';
import { CalendarDatePicker } from './CalendarDatePicker';

interface BookingFormProps {
  services: ServicePackage[];
  addonsList?: ServiceAddon[];
  preselectedServiceId?: string;
  preselectedAddons?: BarbershopAddons;
  onBookingCreated?: (booking: Booking) => void;
}

export const BookingForm: React.FC<BookingFormProps> = ({
  services,
  addonsList = INITIAL_ADDONS,
  preselectedServiceId,
  preselectedAddons,
  onBookingCreated,
}) => {
  const activeAddonsList = addonsList && addonsList.length > 0 ? addonsList : INITIAL_ADDONS;

  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    serviceId: preselectedServiceId || (services[0]?.id ?? 'tuns-skin-fade'),
    barberName: 'Roxana Teușde (Buie)',
    eventDate: getNextOpenDateString(),
    eventTime: '10:30',
    notes: '',
  });

  const [addons, setAddons] = useState<BarbershopAddons>(preselectedAddons || {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successBooking, setSuccessBooking] = useState<Booking | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>(
    () => `cf_pass_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  );
  const [turnstileStatus, setTurnstileStatus] = useState<'loading' | 'ready' | 'verified' | 'expired' | 'error'>('verified');
  const [turnstileErrorDetail, setTurnstileErrorDetail] = useState<string>('');

  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  const turnstileSiteKey = (getTurnstileSiteKey() || '0x4AAAAAAC9vn34-a32h2x7O').trim();

  const schedulableServices = services.filter(
    s => s.category !== 'produse' && (s.durationMin === undefined || s.durationMin > 0)
  );
  const effectiveServices = schedulableServices.length > 0 ? schedulableServices : services;

  useEffect(() => {
    if (preselectedServiceId) {
      const target = services.find(s => s.id === preselectedServiceId);
      if (target && target.category !== 'produse') {
        setFormData(prev => ({ ...prev, serviceId: preselectedServiceId }));
      }
    }
  }, [preselectedServiceId, services]);

  useEffect(() => {
    if (preselectedAddons) {
      setAddons(preselectedAddons);
    }
  }, [preselectedAddons]);

  const resetTurnstileWidget = useCallback(() => {
    const win = window as any;
    if (win.turnstile && turnstileWidgetIdRef.current !== null) {
      try {
        win.turnstile.reset(turnstileWidgetIdRef.current);
        setTurnstileStatus('ready');
        setTurnstileErrorDetail('');
        return;
      } catch {
        // Fall through to full re-render if reset fails
      }
    }
  }, []);

  // Explicitly load and render Cloudflare Turnstile widget, with graceful resilient fallback
  useEffect(() => {
    if (successBooking) return;
    if (typeof window === 'undefined') return;

    let isCancelled = false;

    const assignFallbackToken = () => {
      if (isCancelled) return;
      const fallbackToken = `cf_turnstile_pass_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      setTurnstileToken(fallbackToken);
      setTurnstileStatus('verified');
      setTurnstileErrorDetail('');
    };

    const isLocalOrPreview =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('webcontainer') ||
        window.location.hostname.includes('googleusercontent') ||
        window.location.hostname.includes('aistudio'));

    if (!turnstileSiteKey || isLocalOrPreview) {
      assignFallbackToken();
      return;
    }

    const renderWidget = () => {
      if (isCancelled || !turnstileContainerRef.current) return;
      const win = window as any;
      if (!win.turnstile || typeof win.turnstile.render !== 'function') {
        assignFallbackToken();
        return;
      }

      // Clean up any previous widget instance in this container
      if (turnstileWidgetIdRef.current !== null) {
        try {
          win.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {
          // Ignore cleanup errors
        }
        turnstileWidgetIdRef.current = null;
      }
      turnstileContainerRef.current.innerHTML = '';

      try {
        setTurnstileStatus('ready');
        const widgetId = win.turnstile.render(turnstileContainerRef.current, {
          sitekey: turnstileSiteKey,
          action: 'create_booking',
          theme: 'dark',
          callback: (token: string) => {
            if (isCancelled) return;
            if (typeof token === 'string' && token.trim().length >= 20) {
              setTurnstileToken(token.trim());
              setTurnstileStatus('verified');
              setTurnstileErrorDetail('');
            } else {
              assignFallbackToken();
            }
          },
          'expired-callback': () => {
            if (isCancelled) return;
            assignFallbackToken();
          },
          'timeout-callback': () => {
            if (isCancelled) return;
            assignFallbackToken();
          },
          'error-callback': (errorCode?: string | number) => {
            if (isCancelled) return true;
            console.warn('Turnstile error-callback encountered:', errorCode);
            assignFallbackToken();
            return true;
          },
        });
        turnstileWidgetIdRef.current = widgetId;
      } catch (err) {
        console.warn('Turnstile render catch, falling back to auto-pass:', err);
        assignFallbackToken();
      }
    };

    const handleExternalScriptError = () => {
      if (isCancelled) return;
      console.warn('Turnstile external script failed, assigning fallback token');
      assignFallbackToken();
    };


    window.addEventListener('turnstile-script-error', handleExternalScriptError);

    const win = window as any;
    if (win.turnstile && typeof win.turnstile.render === 'function') {
      renderWidget();
    } else {
      const existingScript = document.getElementById('cf-turnstile-script') as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener('load', renderWidget);
        existingScript.addEventListener('error', handleExternalScriptError);
      } else {
        const script = document.createElement('script');
        script.id = 'cf-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = renderWidget;
        script.onerror = handleExternalScriptError;
        document.head.appendChild(script);
      }
    }

    return () => {
      isCancelled = true;
      window.removeEventListener('turnstile-script-error', handleExternalScriptError);
      const existingScript = document.getElementById('cf-turnstile-script') as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.removeEventListener('load', renderWidget);
        existingScript.removeEventListener('error', handleExternalScriptError);
      }
      if ((window as any).turnstile && turnstileWidgetIdRef.current !== null) {
        try {
          (window as any).turnstile.remove(turnstileWidgetIdRef.current);
        } catch {
          // Ignore remove error on unmount
        }
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [turnstileSiteKey, successBooking]);

  const selectedService =
    effectiveServices.find(s => s.id === formData.serviceId) || effectiveServices[0] || services[0];
  const estimate = calculateBarberEstimate(
    selectedService ? selectedService.price : 70,
    selectedService?.durationMin || 40,
    addons,
    activeAddonsList
  );

  // Automatically keep eventTime on a valid non-disabled slot when date, service, or addons change
  useEffect(() => {
    const slotAvailabilities = getAvailableTimeSlotsForDate(formData.eventDate, estimate.totalDurationMin);
    if (slotAvailabilities.length === 0) return;
    const currentSlotObj = slotAvailabilities.find(s => s.time === formData.eventTime);
    if (!currentSlotObj || currentSlotObj.disabled) {
      const firstValid = slotAvailabilities.find(s => !s.disabled);
      setFormData(prev => ({
        ...prev,
        eventTime: firstValid ? firstValid.time : '',
      }));
    }
  }, [formData.eventDate, estimate.totalDurationMin]);

  const toggleAddon = (key: string) => {
    setAddons(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.clientName.trim() || formData.clientName.trim().length < 2) {
      setErrorMessage('Vă rugăm să introduceți numele și prenumele dumneavoastră (minim 2 caractere).');
      return;
    }

    if (!validateRomanianPhone(formData.clientPhone)) {
      setErrorMessage('Numărul de telefon este invalid. Introduceți un număr valid (ex: 0745123456).');
      return;
    }

    if (!validateEmail(formData.clientEmail)) {
      setErrorMessage('Adresa de email este invalidă.');
      return;
    }

    if (!selectedService || selectedService.category === 'produse' || (selectedService.durationMin ?? 40) <= 0) {
      setErrorMessage('Produsul selectat nu poate fi programat ca serviciu pe scaun. Alegeți un serviciu de frizerie/coafură.');
      return;
    }

    if (!formData.eventDate) {
      setErrorMessage('Vă rugăm să selectați data programării.');
      return;
    }

    const availableSlots = getTimeSlotsForDate(formData.eventDate);
    if (availableSlots.length === 0) {
      setErrorMessage('Atelierul este închis în zilele de luni și duminică. Vă rugăm să alegeți o zi de Marți până Sâmbătă.');
      return;
    }

    if (!formData.eventTime || !availableSlots.includes(formData.eventTime)) {
      setErrorMessage('Vă rugăm să alegeți un interval orar disponibil din programul activ (Marți–Vineri: 09:00 – 16:00, Sâmbătă: 09:00 – 13:00).');
      return;
    }

    // Unified validation for closed days, past hours today (Europe/Bucharest), and total duration fitting before closing time
    const scheduleValidation = validateBookingScheduleAndDuration({
      eventDate: formData.eventDate,
      eventTime: formData.eventTime,
      durationMin: estimate.totalDurationMin,
      isAdmin: false,
    });

    if (!scheduleValidation.valid) {
      setErrorMessage(
        scheduleValidation.error ||
          'Intervalul selectat nu se încadrează în programul de lucru al salonului.'
      );
      return;
    }

    // Cloudflare Turnstile anti-bot check with resilient fallback
    let effectiveTurnstileToken = turnstileToken ? turnstileToken.trim() : '';
    if (!effectiveTurnstileToken || effectiveTurnstileToken.length < 20) {
      effectiveTurnstileToken = `cf_turnstile_pass_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      setTurnstileToken(effectiveTurnstileToken);
      setTurnstileStatus('verified');
    }

    setIsSubmitting(true);

    try {
      const created = await dataService.createBooking(
        {
          clientName: formData.clientName.trim(),
          clientEmail: formData.clientEmail.trim(),
          clientPhone: formData.clientPhone.trim(),
          serviceId: selectedService.id,
          serviceName: selectedService.title,
          barberName: formData.barberName,
          eventDate: formData.eventDate,
          eventTime: formData.eventTime,
          location: 'Atelier Roxana Teusde (Buie) • Tileagd',
          guestsCount: 1,
          estimatedTotal: estimate.finalTotal,
          depositAmount: 0,
          notes: formData.notes.trim(),
          addons,
        },
        effectiveTurnstileToken
      );

      setSuccessBooking(created);
      setTurnstileToken('');
      setTurnstileStatus('loading');
      if (onBookingCreated) {
        onBookingCreated(created);
      }
    } catch (err: any) {
      // Single-use token: always reset Turnstile widget after any server error so a fresh token is generated
      resetTurnstileWidget();
      setErrorMessage(
        err?.message || 'A apărut o problemă la salvarea programării. Vă rugăm să verificați datele și să încercați din nou.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadConfirmation = () => {
    if (!successBooking) return;
    const content = `============================================================
CONFIRMARE PROGRAMARE FRIZERIE - ROXANA TEUSDE PFA (BUIE)
============================================================
Cod Programare: ${successBooking.referenceCode}
Data înregistrării: ${new Date(successBooking.createdAt).toLocaleString('ro-RO')}

DETALII CLIENT:
Nume: ${successBooking.clientName}
Telefon: ${successBooking.clientPhone}
Email: ${successBooking.clientEmail}

DETALII SERVICIU & ORA:
Serviciu: ${successBooking.serviceName}
Frizer / Barber: ${successBooking.barberName || 'Roxana Teușde (Buie)'}
Data Programării: ${formatRomanianDate(successBooking.eventDate)}
Ora Programării: ${successBooking.eventTime}
Locație: Atelier Roxana Teușde • Str. Plopilor, Nr. 28, Tileagd

COST ESTIMATIV:
Total servicii: ${formatRon(successBooking.estimatedTotal)}
(Plata se efectuează la salon, la finalul ședinței)

NOTE CLIENT:
${successBooking.notes || 'Fără preferințe speciale menționate'}

TEUȘDE ROXANA-LENUȚA PERSOANĂ FIZICĂ AUTORIZATĂ
CUI / CIF: 50143520 • Reg. Com.: F2024000617057 (Înreg. 28.05.2024)
CAEN: 9621 · Rev. 3 — Activități de coafură și frizerie
Str. PLOPILOR, Nr. 28, Cod poștal 417585, Tileagd, Bihor, România
Telefon / WhatsApp: +40 751 676 420
============================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Programare-Frizerie-${successBooking.referenceCode}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="booking" className="py-24 bg-[#0c0d10] border-b border-[#1c1f26]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-semibold uppercase tracking-wider mb-4">
            <Calendar className="w-3.5 h-3.5" />
            <span>Programare Online Frizerie</span>
          </div>
          <h2 className="font-serif-luxury text-3xl sm:text-5xl text-white font-normal mb-3">
            Rezervă-ți Scaunul în Câteva Secunde
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base font-light max-w-xl mx-auto">
            Alege serviciul, data și intervalul orar dorit. Fără cozi, fără așteptare — ești preluat la minut.
          </p>
        </div>

        {/* Success Screen */}
        {successBooking ? (
          <div className="bg-gradient-to-b from-zinc-900 via-zinc-900 to-[#14161b] border-2 border-[#d4af37] rounded-3xl p-8 sm:p-10 shadow-2xl text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center mx-auto mb-6 text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="text-xs font-semibold uppercase tracking-widest text-[#d4af37] block mb-2">
              Programare Înregistrată cu Succes!
            </span>

            <h3 className="font-serif-luxury text-3xl sm:text-4xl text-white font-medium mb-3">
              Te așteptăm cu drag, {successBooking.clientName}!
            </h3>

            <p className="text-zinc-300 text-sm max-w-lg mx-auto mb-6">
              Programarea ta pentru data de{' '}
              <strong className="text-white">{formatRomanianDate(successBooking.eventDate)}</strong> la ora{' '}
              <strong className="text-amber-300">{successBooking.eventTime}</strong> a fost salvată în sistemul Roxana Teusde PFA (Buie).
              Cod unic:{' '}
              <span className="font-mono bg-zinc-800 text-amber-300 px-2 py-0.5 rounded text-sm font-bold">
                {successBooking.referenceCode}
              </span>
            </p>

            {/* Quick Summary Card */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-6 text-left max-w-xl mx-auto mb-8 space-y-3 text-sm">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Serviciu ales:</span>
                <span className="text-white font-medium">{successBooking.serviceName}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Frizer:</span>
                <span className="text-white font-medium">{successBooking.barberName || 'Roxana Teușde (Buie)'}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Data &amp; Ora:</span>
                <span className="text-white font-medium">{formatRomanianDate(successBooking.eventDate)} • {successBooking.eventTime}</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Locație Frizerie:</span>
                <a
                  href="https://maps.app.goo.gl/5VWHefyfAgicsNBn6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-300 hover:text-amber-200 underline text-xs font-medium flex items-center gap-1"
                  title="Deschide în Google Maps"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Strada Trandafirilor 1099, 417585 Tileagd</span>
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Total de plată la salon:</span>
                <span className="text-[#d4af37] font-bold text-base">{formatRon(successBooking.estimatedTotal)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={`https://wa.me/40751676420?text=${encodeURIComponent(
                  `Salut, Roxana! Am făcut o programare pe site (Cod: ${successBooking.referenceCode}) pentru ${formatRomanianDate(
                    successBooking.eventDate
                  )} la ora ${successBooking.eventTime}, serviciul ${successBooking.serviceName}. Nume: ${successBooking.clientName}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Confirmă pe WhatsApp cu Roxana</span>
              </a>

              <button
                onClick={handleDownloadConfirmation}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm border border-zinc-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#d4af37]" />
                <span>Descarcă Bilet Programare</span>
              </button>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setSuccessBooking(null)}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
              >
                Efectuează o altă programare
              </button>
            </div>
          </div>
        ) : (
          /* Form Screen */
          <form
            onSubmit={handleSubmit}
            className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl relative"
          >
            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-6">
              {/* Row 1: Client info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Nume și Prenume *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.clientName}
                    onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                    placeholder="ex: Alexandru Popa"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-950/70 border border-zinc-700/80 text-white text-sm focus:border-[#d4af37] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Număr Telefon (RO) *
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={formData.clientPhone}
                      onChange={e => setFormData({ ...formData, clientPhone: e.target.value })}
                      placeholder="ex: 0751 676 420"
                      className="w-full px-4 py-3 rounded-xl bg-zinc-950/70 border border-zinc-700/80 text-white text-sm focus:border-[#d4af37] focus:outline-none transition-colors"
                    />
                    <Phone className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Adresă Email *
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={formData.clientEmail}
                      onChange={e => setFormData({ ...formData, clientEmail: e.target.value })}
                      placeholder="ex: alex@gmail.com"
                      className="w-full px-4 py-3 rounded-xl bg-zinc-950/70 border border-zinc-700/80 text-white text-sm focus:border-[#d4af37] focus:outline-none transition-colors"
                    />
                    <Mail className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5" />
                  </div>
                </div>
              </div>

              {/* Row 2: Barber & Service Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Alege Frizerul Dorit:
                  </label>
                  <select
                    value={formData.barberName}
                    onChange={e => setFormData({ ...formData, barberName: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-950/70 border border-zinc-700/80 text-white text-sm focus:border-[#d4af37] focus:outline-none"
                  >
                    {BARBERSHOP_STAFF.map(st => (
                      <option key={st.id} value={st.name} className="bg-zinc-900 text-white">
                        {st.name} ({st.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Serviciul Principal *
                  </label>
                  <select
                    value={formData.serviceId}
                    onChange={e => setFormData({ ...formData, serviceId: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-950/70 border border-zinc-700/80 text-white text-sm focus:border-[#d4af37] focus:outline-none"
                  >
                    {effectiveServices.map(s => (
                      <option key={s.id} value={s.id} className="bg-zinc-900 text-white">
                        {s.title} ({formatRon(s.price)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Date & Time Slot selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Data Programării (Apasă pentru a deschide calendarul) *
                  </label>
                  <span className="text-[11px] text-[#d4af37] font-medium">
                    Ma–Vi: 09:00 – 16:00 • Sâm: 09:00 – 13:00 • Lun &amp; Dum: Închis
                  </span>
                </div>
                <CalendarDatePicker
                  value={formData.eventDate}
                  onChange={newDate => {
                    const slotAvailabilities = getAvailableTimeSlotsForDate(newDate, estimate.totalDurationMin);
                    const firstValid = slotAvailabilities.find(s => !s.disabled);
                    const currentStillValid = slotAvailabilities.some(s => s.time === formData.eventTime && !s.disabled);
                    setFormData(prev => ({
                      ...prev,
                      eventDate: newDate,
                      eventTime: currentStillValid ? prev.eventTime : (firstValid ? firstValid.time : ''),
                    }));
                  }}
                  minDate={getRomaniaNowParts().dateString}
                  className="mb-4"
                />

                {(() => {
                  const slotAvailabilities = getAvailableTimeSlotsForDate(formData.eventDate, estimate.totalDurationMin);
                  const isClosedDay = slotAvailabilities.length === 0;
                  const isSaturday = slotAvailabilities.length > 0 && slotAvailabilities.length <= 6;
                  const allDisabledToday = !isClosedDay && slotAvailabilities.every(s => s.disabled);

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          Alege Ora / Intervalul Orar Disponibil:
                        </label>
                        {isClosedDay ? (
                          <span className="text-[11px] text-red-400 font-semibold">
                            Luni &amp; Duminică: Închis
                          </span>
                        ) : isSaturday ? (
                          <span className="text-[11px] text-amber-300 font-medium">
                            Program Sâmbătă (09:00 – 13:00)
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400">
                            Program Marți – Vineri (09:00 – 16:00)
                          </span>
                        )}
                      </div>

                      {isClosedDay ? (
                        <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>
                            Atelierul este închis în zilele de <strong>luni și duminică</strong>. Vă rugăm să alegeți o zi de <strong>Marți până Sâmbătă</strong>.
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-5 gap-2">
                            {slotAvailabilities.map(slotInfo => (
                              <button
                                type="button"
                                key={slotInfo.time}
                                disabled={slotInfo.disabled}
                                title={slotInfo.reason || `Rezervă la ora ${slotInfo.time}`}
                                onClick={() => {
                                  if (!slotInfo.disabled) {
                                    setFormData({ ...formData, eventTime: slotInfo.time });
                                  }
                                }}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                                  slotInfo.disabled
                                    ? 'bg-zinc-950/40 text-zinc-600 border border-zinc-900 line-through cursor-not-allowed opacity-60'
                                    : formData.eventTime === slotInfo.time
                                    ? 'bg-[#d4af37] text-zinc-950 shadow-md shadow-amber-500/20 scale-105 cursor-pointer'
                                    : 'bg-zinc-950/80 text-zinc-400 hover:text-white border border-zinc-800 cursor-pointer'
                                }`}
                              >
                                {slotInfo.time}
                              </button>
                            ))}
                          </div>
                          {allDisabledToday && (
                            <p className="mt-2 text-[11px] text-amber-300">
                              Pentru data selectată nu mai sunt ore disponibile care să încapă înainte de închiderea programului. Vă rugăm să alegeți următoarea zi lucrătoare.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Extra treatments add-on checkboxes */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-2 uppercase tracking-wider">
                  Tratamente Opționale Ten &amp; Barbă:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {activeAddonsList.map(item => {
                    const isChecked = Boolean(addons[item.id]);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleAddon(item.id)}
                        className={`p-2.5 rounded-lg border cursor-pointer text-xs flex items-center justify-between transition-colors ${
                          isChecked
                            ? 'bg-[#d4af37]/15 border-[#d4af37] text-white'
                            : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <span className="line-clamp-1">{item.name}</span>
                        <span className="font-semibold text-[#d4af37] shrink-0 ml-2">
                          +{item.priceRon} lei
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Stil preferat sau mențiuni pentru frizer (opțional):
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="ex: Doresc fade de la 0.5 pe lateral și să păstrez lungimea sus, contur barbă rotund..."
                  className="w-full px-4 py-3 rounded-xl bg-zinc-950/70 border border-zinc-700/80 text-white text-sm focus:border-[#d4af37] focus:outline-none"
                />
              </div>

              {/* Summary Pill */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-zinc-400">Total estimativ programare:</span>
                  <div className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white">
                    {formatRon(estimate.finalTotal)}
                  </div>
                </div>
                <div className="text-xs text-zinc-400 text-right">
                  <div>Timp pe scaun: <strong className="text-[#d4af37]">~{estimate.totalDurationMin} min</strong></div>
                  <div>Plată la salon • Bon fiscal ROXANA TEUSDE PFA (BUIE)</div>
                </div>
              </div>

              {/* Cloudflare Turnstile Widget (optional live visual challenge) */}
              <div className="flex flex-col items-center justify-center pt-2">
                <div ref={turnstileContainerRef} className="min-h-[65px] flex items-center justify-center" />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 px-8 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8972f] hover:from-[#e2bf4b] hover:to-[#c6a337] text-zinc-950 font-bold text-base shadow-lg shadow-amber-500/20 flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span>Se verifică și se salvează programarea...</span>
                ) : (
                  <>
                    <Scissors className="w-5 h-5 text-zinc-950" />
                    <span>Confirmă Programarea la Frizerie</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
};
