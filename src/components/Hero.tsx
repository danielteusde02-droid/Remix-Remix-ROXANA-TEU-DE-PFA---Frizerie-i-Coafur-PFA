import React from 'react';
import { Calendar, Scissors, Sparkles, Star, Award, ShieldCheck, ArrowDown } from 'lucide-react';

interface HeroProps {
  onOpenBooking: () => void;
  onExploreGallery: () => void;
  heroBgUrl?: string;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBooking, onExploreGallery, heroBgUrl }) => {
  const bgImage = heroBgUrl || '/assets/aistudio/pt_site_ef4b9a1a.jpg';

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-[#0c0d10]">
      {/* Background with barbershop ambiance image */}
      <div className="absolute inset-0 z-0">
        <img
          src={bgImage}
          alt="Barbershop & Salon Roxana Teușde PFA Buie - Tileagd"
          className="w-full h-full object-cover object-center opacity-15 scale-105 blur-[3px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d10] via-[#0c0d10]/85 to-[#0c0d10]/60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/15 via-transparent to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/90 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-medium mb-6 shadow-inner backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
          <span>ROXANA TEUȘDE PFA • Frizerie și Coafură PFA</span>
        </div>

        {/* Main Headline */}
        <h1 className="font-serif-luxury text-4xl sm:text-6xl md:text-7xl font-normal tracking-tight text-white leading-[1.15] mb-6">
          Stilul care te reprezintă,{' '}
          <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] via-[#f3e5ab] to-[#c5a034]">
            frumusețea care te definește
          </span>
          .
        </h1>

        {/* Subtitle / Homepage description */}
        <p className="max-w-3xl mx-auto text-base sm:text-lg md:text-xl text-zinc-300 font-light leading-relaxed mb-10">
          Frumusețea începe cu stilul care te reprezintă! Fie că îți dorești o tunsoare modernă, o coafură elegantă sau o schimbare de look, fiecare detaliu contează. Ofer servicii de frizerie și coafură pentru femei și bărbați, cu atenție, pasiune și profesionalism. Îmi doresc ca fiecare persoană să se simtă binevenită, să primească atenția cuvenită și să plece cu un look care îi pune în valoare personalitatea. Pentru că fiecare stil spune o poveste, iar povestea ta merită să fie specială.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={onOpenBooking}
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-[#d4af37] to-[#b8972f] hover:from-[#e5c158] hover:to-[#cbb04a] text-zinc-950 font-bold text-base shadow-xl shadow-amber-900/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer"
          >
            <Calendar className="w-5 h-5 text-zinc-950" />
            <span>Alege Ora &amp; Programează-te</span>
          </button>

          <button
            onClick={onExploreGallery}
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 text-white font-medium text-base hover:border-[#d4af37]/60 transition-all flex items-center justify-center gap-3 cursor-pointer backdrop-blur-sm"
          >
            <Scissors className="w-4 h-4 text-[#d4af37]" />
            <span>Vezi Portofoliul de Servicii</span>
          </button>
        </div>

        {/* Value props & trust bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-zinc-800/80 text-left">
          <div className="bg-zinc-900/40 border border-zinc-800/60 p-4 rounded-xl backdrop-blur-xs">
            <div className="text-2xl sm:text-3xl font-serif-luxury font-semibold text-[#d4af37] mb-1">
              Femei &amp; Bărbați
            </div>
            <div className="text-xs text-zinc-400 font-medium">Frizerie &amp; Coafură</div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/60 p-4 rounded-xl backdrop-blur-xs">
            <div className="text-2xl sm:text-3xl font-serif-luxury font-semibold text-white mb-1">
              Tileagd
            </div>
            <div className="text-xs text-zinc-400 font-medium">Str. Trandafirilor 1099</div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/60 p-4 rounded-xl backdrop-blur-xs">
            <div className="text-2xl sm:text-3xl font-serif-luxury font-semibold text-[#d4af37] mb-1">
              5.0 ★
            </div>
            <div className="text-xs text-zinc-400 font-medium">100% Recenzii Excelente</div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/60 p-4 rounded-xl backdrop-blur-xs">
            <div className="text-2xl sm:text-3xl font-serif-luxury font-semibold text-white mb-1">
              Pasiune &amp; Stil
            </div>
            <div className="text-xs text-zinc-400 font-medium">Atenție la Fiecare Detaliu</div>
          </div>
        </div>
      </div>

      {/* Down arrow */}
      <button
        onClick={onExploreGallery}
        aria-label="Derulează la conținut"
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 p-2 text-zinc-500 hover:text-[#d4af37] transition-colors animate-bounce"
      >
        <ArrowDown className="w-5 h-5" />
      </button>
    </section>
  );
};
