import React, { useState } from 'react';
import { Calculator, Sparkles, Check, ArrowRight, Clock, ShieldCheck, Lock, Edit2 } from 'lucide-react';
import { ServicePackage, ServiceAddon } from '../types';
import { BarbershopAddons, calculateBarberEstimate, formatRon } from '../utils/bookingUtils';
import { INITIAL_ADDONS } from '../services/dataService';

interface InteractiveCalculatorProps {
  services: ServicePackage[];
  addonsList?: ServiceAddon[];
  onApplyConfiguration: (serviceId: string, addons: BarbershopAddons, estimatedTotal: number) => void;
  onOpenManageServices?: (serviceId?: string) => void;
  onOpenManageAddons?: (addonId?: string) => void;
  isAdminLoggedIn?: boolean;
}

export const InteractiveCalculator: React.FC<InteractiveCalculatorProps> = ({
  services,
  addonsList = INITIAL_ADDONS,
  onApplyConfiguration,
  onOpenManageServices,
  onOpenManageAddons,
  isAdminLoggedIn = false,
}) => {
  const activeAddonsList = addonsList && addonsList.length > 0 ? addonsList : INITIAL_ADDONS;

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    services.find(s => s.popular)?.id || services[0]?.id || 'tuns-skin-fade'
  );

  const [addons, setAddons] = useState<BarbershopAddons>({
    hotTowelTreatment: true,
  });

  const selectedService = services.find(s => s.id === selectedServiceId) || services[0];
  const basePrice = selectedService ? selectedService.price : 70;
  const baseDuration = selectedService?.durationMin || 40;

  const toggleAddon = (key: string) => {
    setAddons(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const estimate = calculateBarberEstimate(basePrice, baseDuration, addons, activeAddonsList);

  const handleApply = () => {
    onApplyConfiguration(selectedServiceId, addons, estimate.finalTotal);
    const bookingEl = document.getElementById('booking');
    if (bookingEl) {
      bookingEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="calculator" className="py-20 bg-[#0e1014] border-b border-[#1c1f26]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-semibold uppercase tracking-wider mb-3">
            <Calculator className="w-3.5 h-3.5" />
            <span>Configurator Sesiune Grooming</span>
          </div>
          <h2 className="font-serif-luxury text-3xl sm:text-4xl text-white font-normal mb-3">
            Personalizează-ți Pachetul la Frizerie
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base font-light">
            Alege serviciul de bază și combină-l cu tratamente de relaxare pentru ten și scalp.
          </p>
        </div>

        {/* Interactive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Base service */}
            <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  1. Alege Serviciul Principal:
                </label>
                {onOpenManageServices && (
                  <button
                    type="button"
                    onClick={() => onOpenManageServices(selectedServiceId)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700/80 text-zinc-300 hover:text-[#d4af37] border border-zinc-700/80 hover:border-[#d4af37]/50 text-[11px] font-medium transition-colors cursor-pointer group shadow-sm w-fit"
                    title="Modificarea serviciilor și a tarifelor se realizează exclusiv din Panoul de Control Administrator"
                  >
                    <Lock className="w-3 h-3 text-[#d4af37] group-hover:scale-110 transition-transform" />
                    <span>Modifică Servicii &amp; Prețuri (Panou Admin)</span>
                  </button>
                )}
              </div>
              <div className="space-y-2.5">
                {services.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedServiceId(s.id)}
                    className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      selectedServiceId === s.id
                        ? 'bg-[#d4af37]/10 border-[#d4af37] text-white shadow-sm'
                        : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          selectedServiceId === s.id
                            ? 'border-[#d4af37] bg-[#d4af37]'
                            : 'border-zinc-600'
                        }`}
                      >
                        {selectedServiceId === s.id && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{s.title}</div>
                        <div className="text-xs text-zinc-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#d4af37]" />
                          <span>{s.duration}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-sm font-semibold text-[#d4af37]">
                        {formatRon(s.price)}
                      </div>
                      {isAdminLoggedIn && onOpenManageServices && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenManageServices(s.id);
                          }}
                          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[#d4af37] text-[10px] font-semibold border border-zinc-700 hover:border-[#d4af37]/60 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Editează acest serviciu în Panoul de Administrator"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Editează</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Informative notice confirming admin exclusivity */}
              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                  <span>Tarife oficiale afișate • Modificabile exclusiv din Panoul Administrator</span>
                </span>
                {onOpenManageServices && (
                  <button
                    type="button"
                    onClick={() => onOpenManageServices()}
                    className="text-zinc-400 hover:text-[#d4af37] underline text-[11px] cursor-pointer inline-flex items-center gap-1"
                  >
                    <Lock className="w-3 h-3 text-[#d4af37]" />
                    <span>Deschide Panoul Admin</span>
                  </button>
                )}
              </div>
            </div>

            {/* Step 2: Addons */}
            <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  2. Adaugă Tratamente Opționale:
                </label>
                {onOpenManageAddons && (
                  <button
                    type="button"
                    onClick={() => onOpenManageAddons()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-[#d4af37] border border-zinc-700/80 hover:border-[#d4af37]/50 text-[11px] font-medium transition-colors cursor-pointer group shadow-sm w-fit"
                    title="Modifică prețul, titlul, durata și imaginea tratamentelor opționale din Panoul de Control Administrator"
                  >
                    <Lock className="w-3 h-3 text-[#d4af37] group-hover:scale-110 transition-transform" />
                    <span>Modifică Tratamente &amp; Prețuri (Panou Admin)</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeAddonsList.map(item => {
                  const isChecked = Boolean(addons[item.id]);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleAddon(item.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        isChecked
                          ? 'bg-[#d4af37]/10 border-[#d4af37] text-white shadow-sm'
                          : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 mb-2">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-10 h-10 object-cover rounded-lg border border-zinc-700 shrink-0"
                          />
                        )}
                        <div
                          className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                            isChecked ? 'bg-[#d4af37] border-[#d4af37] text-zinc-950' : 'border-zinc-600'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-medium leading-snug block">{item.name}</span>
                          {item.description && (
                            <span className="text-[10px] text-zinc-400 block line-clamp-1 mt-0.5">{item.description}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-zinc-800/60">
                        <span className="text-[11px] text-zinc-500">+{item.durationMin} min</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#d4af37]">+{formatRon(item.priceRon)}</span>
                          {isAdminLoggedIn && onOpenManageAddons && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenManageAddons(item.id);
                              }}
                              className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[#d4af37] text-[9px] font-semibold border border-zinc-700 hover:border-[#d4af37]/60 flex items-center gap-0.5 cursor-pointer"
                              title="Editează acest tratament în Panoul de Administrator"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Estimate Summary Column */}
          <div className="lg:col-span-5 sticky top-28">
            <div className="bg-gradient-to-b from-zinc-900 to-[#14161b] border-2 border-zinc-700/80 p-6 sm:p-8 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <span className="font-serif-luxury text-xl text-white font-medium">Sumar Pachet Frizerie</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                  Timp Estimat
                </span>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-3 py-6 border-b border-zinc-800 text-sm">
                <div className="flex justify-between text-zinc-300">
                  <span>Serviciu de bază:</span>
                  <span className="text-white font-medium">{formatRon(estimate.basePrice)}</span>
                </div>

                <div className="flex justify-between text-zinc-300">
                  <span>Tratamente suplimentare:</span>
                  <span className="text-[#d4af37] font-medium">+{formatRon(estimate.addonsTotal)}</span>
                </div>

                <div className="flex justify-between text-zinc-300">
                  <span>Timp total pe scaun:</span>
                  <span className="text-white font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>~{estimate.totalDurationMin} minute</span>
                  </span>
                </div>

                <div className="pt-2 flex justify-between items-baseline">
                  <span className="text-base text-white font-medium">Preț Total:</span>
                  <span className="font-serif-luxury text-3xl font-bold text-white">
                    {formatRon(estimate.finalTotal)}
                  </span>
                </div>
              </div>

              {/* Trust notes */}
              <div className="py-4 space-y-2 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Plata se efectuează la salon (cash sau card POS)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#d4af37] shrink-0" />
                  <span>Spălat dublu și styling incluse gratuit</span>
                </div>
              </div>

              {/* Apply button */}
              <button
                onClick={handleApply}
                className="w-full mt-4 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8972f] hover:from-[#e0be4d] hover:to-[#c3a033] text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <span>Alege Ora &amp; Salvează Pachetul</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
