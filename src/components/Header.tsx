import React, { useState } from 'react';
import { Scissors, Calendar, Phone, MessageSquare, Shield, Menu, X, Sparkles, Clock, MapPin } from 'lucide-react';

interface HeaderProps {
  onOpenBooking: () => void;
  onOpenAdmin: () => void;
  isAdminLoggedIn?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenBooking, onOpenAdmin, isAdminLoggedIn }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0e1014e6] backdrop-blur-md border-b border-[#242730]">
      {/* Top bar with hours, location and direct WhatsApp */}
      <div className="bg-[#14161c] border-b border-[#1f2229] px-4 py-1.5 text-xs text-zinc-400">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[#d4af37]">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Program: Marți – Vineri: 09:00 – 16:00 • Sâmbătă: 09:00 – 13:00 • Luni &amp; Duminică: Închis
            </span>
            <span className="hidden md:inline text-zinc-600">•</span>
            <a
              href="https://maps.app.goo.gl/5VWHefyfAgicsNBn6"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1 text-zinc-300 hover:text-[#d4af37] transition-colors cursor-pointer"
              title="Vezi pe Google Maps: Strada Trandafirilor 1099, 417585 Tileagd"
            >
              <MapPin className="w-3 h-3 text-[#d4af37]" />
              <span>Strada Trandafirilor 1099, 417585 Tileagd</span>
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://wa.me/40751676420?text=Salut,%20Roxana!%20Aș%20dori%20o%20programare%20la%20frizerie."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span>WhatsApp <span className="hidden sm:inline">Programări</span>: +40 751 676 420</span>
            </a>
            <span className="text-zinc-600">|</span>
            <button
              onClick={onOpenAdmin}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                isAdminLoggedIn
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Panou Administrator PFA"
              aria-label="Panou Administrator"
            >
              <Shield className="w-3 h-3 text-[#d4af37]" />
              <span>{isAdminLoggedIn ? 'Admin Activ' : 'Panou Admin'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <a href="#" className="flex items-center gap-3 group text-left">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#d4af37] via-[#b8972f] to-[#7d6418] p-0.5 shadow-lg shadow-amber-900/20">
            <div className="w-full h-full bg-[#0e1014] rounded-full flex items-center justify-center">
              <Scissors className="w-5 h-5 text-[#d4af37] group-hover:rotate-12 transition-transform duration-300" />
            </div>
          </div>
          <div>
            <span className="block font-serif-luxury text-xl sm:text-2xl tracking-wider text-white font-medium">
              ROXANA TEUȘDE PFA
            </span>
            <span className="block text-[10px] sm:text-[11px] tracking-[0.2em] text-[#d4af37] font-semibold uppercase">
              Hair &amp; Beauty Atelier
            </span>
          </div>
        </a>

        {/* Desktop Menu */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-zinc-300">
          <button onClick={() => scrollTo('despre')} className="hover:text-[#d4af37] transition-colors cursor-pointer">
            Despre Atelier
          </button>
          <button onClick={() => scrollTo('servicii')} className="hover:text-[#d4af37] transition-colors cursor-pointer">
            Servicii &amp; Tarife
          </button>
          <button onClick={() => scrollTo('galerie')} className="hover:text-[#d4af37] transition-colors cursor-pointer">
            Portofoliu Tunsori
          </button>
          <button onClick={() => scrollTo('calculator')} className="hover:text-[#d4af37] transition-colors cursor-pointer">
            Configurator &amp; Preț
          </button>
          <button onClick={() => scrollTo('recenzii')} className="hover:text-[#d4af37] transition-colors cursor-pointer">
            Recenzii Clienți
          </button>
          <button onClick={() => scrollTo('contact')} className="hover:text-[#d4af37] transition-colors cursor-pointer">
            Contact &amp; Orar
          </button>
        </nav>

        {/* Action button */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={onOpenBooking}
            className="flex items-center gap-2 bg-gradient-to-r from-[#d4af37] to-[#b8972f] hover:from-[#e5c158] hover:to-[#cbb04a] text-zinc-950 font-bold px-5 py-2.5 rounded-full text-sm shadow-md shadow-amber-500/20 hover:shadow-amber-500/30 transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>Programează-te Online</span>
          </button>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex lg:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Meniu Navigare"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#14161c] border-b border-zinc-800 px-6 py-6 space-y-4 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col space-y-3 text-base font-medium text-zinc-200">
            <button
              onClick={() => scrollTo('despre')}
              className="text-left py-2 hover:text-[#d4af37] border-b border-zinc-800/60"
            >
              Despre Roxana Teușde (Buie)
            </button>
            <button
              onClick={() => scrollTo('servicii')}
              className="text-left py-2 hover:text-[#d4af37] border-b border-zinc-800/60"
            >
              Servicii Frizerie &amp; Prețuri
            </button>
            <button
              onClick={() => scrollTo('galerie')}
              className="text-left py-2 hover:text-[#d4af37] border-b border-zinc-800/60"
            >
              Portofoliu Tunsori &amp; Bărbi
            </button>
            <button
              onClick={() => scrollTo('calculator')}
              className="text-left py-2 hover:text-[#d4af37] border-b border-zinc-800/60"
            >
              Configurator Pachet
            </button>
            <button
              onClick={() => scrollTo('recenzii')}
              className="text-left py-2 hover:text-[#d4af37] border-b border-zinc-800/60"
            >
              Recenzii Clienți
            </button>
            <button
              onClick={() => scrollTo('contact')}
              className="text-left py-2 hover:text-[#d4af37] border-b border-zinc-800/60"
            >
              Contact, Hartă &amp; Orar
            </button>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenBooking();
              }}
              className="w-full py-3 bg-[#d4af37] hover:bg-[#e2bd46] text-zinc-950 font-bold rounded-xl text-center flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Programează-te Acum</span>
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAdmin();
              }}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl text-center flex items-center justify-center gap-2 text-sm"
            >
              <Shield className="w-4 h-4 text-[#d4af37]" />
              <span>Panou Administrator PFA</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
