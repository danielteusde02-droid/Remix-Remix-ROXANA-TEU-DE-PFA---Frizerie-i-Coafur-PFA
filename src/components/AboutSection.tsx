import React from 'react';
import { Scissors, Sparkles, CheckCircle2, ShieldCheck, Heart, Award } from 'lucide-react';
import { BARBERSHOP_STAFF } from '../services/dataService';

interface AboutSectionProps {
  aboutPhotoUrl?: string;
  salonBannerUrl?: string;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ aboutPhotoUrl, salonBannerUrl }) => {
  const photo = aboutPhotoUrl || '/assets/aistudio/fata_bruneta_2_60013457.jpg';
  const salonImg = salonBannerUrl || '/assets/aistudio/pt_site_ef4b9a1a.jpg';

  return (
    <section id="despre" className="py-24 bg-[#0e1014] border-b border-[#1c1f26] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Photo & Badge column */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <div className="absolute -inset-3 rounded-2xl bg-gradient-to-tr from-[#d4af37]/30 to-transparent blur-sm" />

              <div className="relative rounded-2xl overflow-hidden border border-zinc-700/80 shadow-2xl bg-zinc-900">
                <img
                  src={photo}
                  alt="Roxana Teușde (Buie) - Master Barber & Hair Stylist"
                  className="w-full h-[480px] object-cover object-top"
                />

                {/* Floating card */}
                <div className="absolute bottom-4 left-4 right-4 bg-[#14161ce6] backdrop-blur-md border border-zinc-700/60 p-4 rounded-xl shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center shrink-0">
                      <Scissors className="w-5 h-5 text-[#d4af37]" />
                    </div>
                    <div>
                      <div className="font-serif-luxury text-lg text-white font-medium">Hair &amp; Beauty Atelier</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legal PFA certification badge */}
              <div className="mt-4 p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-white">Entitate Legală Înregistrată ANAF / ONRC</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Activ din 28.05.2024
                  </span>
                </div>
                <div className="font-mono text-[11px] text-amber-300/90 pt-1">
                  TEUȘDE ROXANA-LENUȚA PERSOANĂ FIZICĂ AUTORIZATĂ
                </div>
                <div className="font-mono text-[10px] text-zinc-300">
                  CIF: 50143520 • Reg. Com.: F2024000617057 • CAEN: 9621 · Rev. 3
                </div>
              </div>

              {/* Salon preview badge */}
              <div className="mt-3 p-3 rounded-xl bg-[#14161c] border border-amber-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <img
                    src={salonImg}
                    alt="Afiș Salon Tileagd"
                    className="w-10 h-10 rounded-lg object-cover border border-amber-500/30"
                  />
                  <div>
                    <span className="text-white font-medium block">Atelier Salon Tileagd</span>
                    <span className="text-[11px] text-[#d4af37]">Strada Trandafirilor 1099</span>
                  </div>
                </div>
                <a
                  href="#galerie"
                  className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[#d4af37] text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Vezi Foto Salon
                </a>
              </div>
            </div>
          </div>

          {/* Text & Story column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Despre mine</span>
            </div>

            <h2 className="font-serif-luxury text-3xl sm:text-5xl text-white font-normal leading-tight">
              Frizeria nu este doar o tunsoare. Este o stare de spirit și respect pentru tine însuți.
            </h2>

            <div className="space-y-4 text-zinc-300 text-base sm:text-lg leading-relaxed font-light">
              <p>
                Bun venit, mă bucur că ai ales să descoperi povestea mea! Pentru mine, frizeria e mai mult decât o tunsoare, e pasiune, încredere și bucuria de a vedea un om zâmbind.
              </p>
              <p className="text-zinc-400 text-sm sm:text-base">
                Am pornit la drum după absolvirea liceului profesional, din dorința de a transforma pasiunea în meserie. Am tuns acasă pentru familie și cunoscuți, iar cu timpul am crescut, am învățat, și am ajuns să ofer servicii de frizerie și coafură într-un spațiu dedicat de aproximativ doi ani.
              </p>
              <p className="text-zinc-400 text-sm sm:text-base">
                Îmi doresc ca atunci când îmi treci pragul să găsești o atmosferă caldă și primitoare, unde să îți ascult dorințele și să lucrăm împreună la stilul care ți se potrivește. Pentru fiecare tunsoare pun pasiune și, cel mai important, îmi place să văd cum pleci de aici mulțumit și cu zâmbetul pe buze.
              </p>
              <p className="text-[#d4af37] font-medium pt-1 text-base sm:text-lg">
                Te aștept cu drag. &nbsp;ROXANA TEUȘDE PFA
              </p>
            </div>

            {/* Core pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
                <div className="flex items-center gap-2.5 text-white font-medium mb-1.5">
                  <Scissors className="w-4 h-4 text-[#d4af37]" />
                  <span>Frizerie &amp; Tunsori Moderne</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Fade milimetric, contur precis și tehnici adaptate fiecărui tip de păr și fizionomie.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
                <div className="flex items-center gap-2.5 text-white font-medium mb-1.5">
                  <Sparkles className="w-4 h-4 text-[#d4af37]" />
                  <span>Coafură &amp; Schimbare de Look</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Servicii dedicate pentru femei și bărbați, realizate cu pasiune, grijă și atenție la detalii.
                </p>
              </div>
            </div>

            {/* Checklist of guarantees / beneficii */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2.5 text-sm text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-[#d4af37] shrink-0" />
                <span>Punctualitate strictă — ești preluat la ora stabilită, fără așteptări inutile</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-[#d4af37] shrink-0" />
                <span>Sterilizare și dezinfectare profesională cu sterilizator UV și soluții medicale</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-[#d4af37] shrink-0" />
                <span>Spălare și îngrijire a părului, disponibilă la cerere, contra cost.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
