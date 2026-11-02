import React, { useState } from 'react';
import { Check, Sparkles, Star, Calendar, ArrowRight, Clock, Lock, Edit2 } from 'lucide-react';
import { ServicePackage, SectionSettings } from '../types';
import { formatRon } from '../utils/bookingUtils';
import { DEFAULT_SERVICES_SETTINGS } from '../services/dataService';

interface ServicesSectionProps {
  services: ServicePackage[];
  onSelectPackage: (pkg: ServicePackage) => void;
  onOpenManageServices?: (serviceId?: string) => void;
  isAdminLoggedIn?: boolean;
  settings?: SectionSettings;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({
  services,
  onSelectPackage,
  onOpenManageServices,
  isAdminLoggedIn = false,
  settings = DEFAULT_SERVICES_SETTINGS,
}) => {
  const [filter, setFilter] = useState<string>('all');

  const categoryTags = settings.tags && settings.tags.length > 0 ? settings.tags : DEFAULT_SERVICES_SETTINGS.tags;

  const filteredServices = services.filter(s => {
    if (filter === 'all') return true;
    return s.category === filter;
  });

  return (
    <section id="servicii" className="py-24 bg-[#0c0d10] border-b border-[#1c1f26]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{settings.badgeText || 'Meniu Servicii & Tarife Frizerie'}</span>
          </div>

          <h2 className="font-serif-luxury text-3xl sm:text-5xl text-white font-normal mb-4">
            {settings.title || 'Îngrijire Masculină Fără Compromis'}
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg font-light leading-relaxed">
            {settings.subtitle || 'Fiecare serviciu este realizat cu atenție, pasiune și profesionalism, folosind produse de calitate și tehnici adaptate stilului și dorințelor tale.'}
          </p>

          {onOpenManageServices && (
            <div className="flex items-center justify-center mt-5">
              <button
                type="button"
                onClick={() => onOpenManageServices()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-[#d4af37] border border-zinc-700/80 hover:border-[#d4af37]/60 text-xs font-medium transition-all cursor-pointer shadow-sm"
                title="Modificarea serviciilor și a prețurilor se face exclusiv din Panoul de Control Administrator"
              >
                <Lock className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Modifică Servicii &amp; Prețuri (Panou Administrator)</span>
              </button>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            {categoryTags.map(cat => (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  filter === cat.id
                    ? 'bg-[#d4af37] text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredServices.map((pkg) => (
            <div
              key={pkg.id}
              className={`group relative rounded-2xl flex flex-col transition-all duration-300 overflow-hidden ${
                pkg.popular
                  ? 'bg-gradient-to-b from-zinc-900 via-zinc-900/95 to-[#161820] border-2 border-[#d4af37] shadow-xl shadow-amber-950/20 scale-[1.02] lg:-translate-y-2'
                  : 'bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {/* Presentation Image of Service / Product */}
              {pkg.imageUrl && (
                <div className="relative w-full h-48 overflow-hidden bg-zinc-950 shrink-0">
                  <img
                    src={pkg.imageUrl}
                    alt={pkg.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-[10px] font-semibold uppercase tracking-wider text-amber-300 border border-amber-500/30">
                      {pkg.category === 'tuns'
                        ? 'Tunsoare'
                        : pkg.category === 'barba'
                        ? 'Îngrijire Barbă'
                        : pkg.category === 'pachet'
                        ? 'Pachet Special'
                        : pkg.category === 'coafura'
                        ? 'Coafură Damă'
                        : pkg.category === 'produse'
                        ? 'Produs Styling'
                        : 'Tratament'}
                    </span>
                  </div>
                </div>
              )}

              {/* Card Body */}
              <div className="p-6 sm:p-7 flex flex-col flex-1">
                {/* Popular ribbon */}
                {pkg.popular && (
                  <div className="self-start -mt-2 mb-3 bg-gradient-to-r from-[#d4af37] to-[#b8972f] text-zinc-950 text-[10px] font-bold uppercase tracking-wider py-0.5 px-3 rounded-full shadow-md flex items-center gap-1.5">
                    <Star className="w-3 h-3 fill-zinc-950" />
                    <span>Cel Mai Recomandat</span>
                  </div>
                )}

                {/* Title & Duration */}
                <div className="mb-4">
                  {!pkg.imageUrl && (
                    <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold block mb-1">
                      {pkg.category === 'tuns'
                        ? 'Tunsoare'
                        : pkg.category === 'barba'
                        ? 'Îngrijire Barbă'
                        : pkg.category === 'pachet'
                        ? 'Pachet Special'
                        : pkg.category === 'coafura'
                        ? 'Coafură Damă'
                        : pkg.category === 'produse'
                        ? 'Produs Styling'
                        : 'Tratament'}
                    </span>
                  )}
                  <h3 className="font-serif-luxury text-2xl text-white font-medium group-hover:text-amber-200 transition-colors">
                    {pkg.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-amber-400/90 mt-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{pkg.duration}</span>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-5 pb-5 border-b border-zinc-800">
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif-luxury text-4xl sm:text-5xl font-semibold text-white">
                      {formatRon(pkg.price)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Preț oficial afișat • Bon fiscal / Factură PFA
                  </p>
                </div>

              {/* Description */}
              <p className="text-zinc-300 text-sm leading-relaxed mb-6 font-light">
                {pkg.description}
              </p>

              {/* Features list */}
              <div className="space-y-3 mb-8 grow">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Ce include serviciul:
                </div>
                {pkg.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-300">
                    <div className="w-4 h-4 rounded-full bg-[#d4af37]/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5 text-[#d4af37]" />
                    </div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              {/* Button */}
              <button
                onClick={() => onSelectPackage(pkg)}
                className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  pkg.popular
                    ? 'bg-gradient-to-r from-[#d4af37] to-[#b8972f] hover:from-[#e2be4a] hover:to-[#c6a237] text-zinc-950 shadow-md shadow-amber-500/20'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700/80 hover:border-[#d4af37]/50'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Alege &amp; Programează-te</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {onOpenManageServices && (
                <button
                  type="button"
                  onClick={() => onOpenManageServices(pkg.id)}
                  className="w-full mt-2 py-1.5 px-3 rounded-lg text-xs font-semibold text-zinc-400 hover:text-[#d4af37] hover:bg-zinc-800/80 border border-transparent hover:border-zinc-700 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Modifică denumirea sau tariful acestui serviciu în Panoul de Administrator"
                >
                  <Lock className="w-3 h-3 text-[#d4af37]" />
                  <span>Modifică Serviciul (Panou Admin)</span>
                </button>
              )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
