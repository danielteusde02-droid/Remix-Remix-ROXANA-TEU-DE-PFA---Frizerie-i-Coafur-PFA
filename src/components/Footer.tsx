import React, { useState } from 'react';
import { Scissors, Phone, MessageSquare, MapPin, Clock, ShieldCheck, ExternalLink, X } from 'lucide-react';

export const Footer: React.FC = () => {
  const [modalContent, setModalContent] = useState<{ title: string; body: string } | null>(null);

  const openModal = (type: 'termeni' | 'gdpr' | 'cookies') => {
    if (type === 'termeni') {
      setModalContent({
        title: 'Termeni și Condiții de Utilizare',
        body: `1. IDENTIFICARE PRESTATOR
Serviciile de frizerie și coafură sunt furnizate de ROXANA TEUȘDE PFA (BUIE), cu sediul în Tileagd, județul Bihor, Str. Plopilor, Nr. 28, Cod poștal 417585.
CUI/CIF: 50143520
Număr Registrul Comerțului: F2024000617057 (Înregistrat din data 28.05.2024)
Activitate principală CAEN: 9621 · Rev. 3 — Activități de coafură și frizerie.

2. PROGRAMĂRI ȘI POLITICĂ DE ANULARE
Programările realizate online prin intermediul site-ului constituie o rezervare de timp pe scaunul de salon/frizerie. În cazul în care nu mai puteți ajunge la ora stabilită, vă rugăm să anunțați cu cel puțin 2 ore înainte prin telefon sau WhatsApp la +40 751 676 420.

3. TARIFE ȘI MODALITATE DE PLATĂ
Toate tarifele afișate pe site sunt exprimate în RON și includ reglementările fiscale legale pentru PFA. Plata serviciilor se efectuează direct la salon (numerar sau card POS). Se emite bon fiscal sau factură conform legii.

4. IGIENĂ ȘI SIGURANȚĂ
Atelierul respectă cu strictețe normele sanitare și de igienă în vigoare: ustensilele sunt sterilizate conform standardelor profesionale, iar lamele de unică folosință se desfac exclusiv în fața fiecărui client.`,
      });
    } else if (type === 'gdpr') {
      setModalContent({
        title: 'Politica de Confidențialitate și Protecția Datelor (GDPR)',
        body: `1. OPERATORUL DE DATE
ROXANA TEUȘDE PFA (BUIE), CIF 50143520, Reg. Com. F2024000617057, Str. Plopilor, Nr. 28, 417585 Tileagd, Bihor, prelucrează datele dumneavoastră cu caracter personal în deplină conformitate cu Regulamentul (UE) 2016/679 (GDPR).

2. DATE COLECTATE ȘI SCOPUL PRELUCRĂRII
Colectăm: Numele și prenumele, numărul de telefon, adresa de email și data/ora programării.
Scopul exclusiv: Gestionarea și confirmarea programărilor la salon/frizerie, comunicarea orarului și emiterea documentelor fiscale.
Nu transmitem și nu comercializăm datele dumneavoastră către terți.

3. STOCAREA DATELOR ȘI DREPTURILE CLIENTULUI
Datele sunt stocate în condiții de securitate deplină. Aveți dreptul de acces, rectificare sau ștergere a datelor ('dreptul de a fi uitat'). Pentru orice solicitare, ne puteți contacta la contact@roxanateusde.ro.`,
      });
    } else if (type === 'cookies') {
      setModalContent({
        title: 'Politica privind Modulele Cookie',
        body: `Site-ul nostru utilizează exclusiv module cookie tehnice și de performanță esențiale pentru funcționarea platformei și a sistemului de programări online.

- Cookie-uri de sesiune: permit menținerea stării formularelor și a preferințelor de navigare.
- Securitate: nu folosim cookie-uri intruzive de urmărire publicitară terță. Puteți gestiona sau șterge oricând cookie-urile din setările browserului dumneavoastră.`,
      });
    }
  };

  return (
    <footer id="contact" className="bg-[#0a0b0e] border-t border-zinc-800 text-zinc-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Col 1: Brand & Bio */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37]">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <span className="block font-serif-luxury text-lg text-white font-medium">
                  ROXANA TEUȘDE PFA
                </span>
                <span className="block text-[10px] tracking-wider text-[#d4af37] font-semibold uppercase">
                  Frizerie și Coafură PFA
                </span>
              </div>
            </div>

            <p className="text-zinc-400 leading-relaxed text-xs">
              Atelier de frizerie și coafură în Tileagd, județul Bihor. Tunsori moderne, stilizare și îngrijire pentru femei și bărbați într-o atmosferă primitoare și relaxantă.
            </p>

            {/* Official Fiscal & Registration Details */}
            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-300 font-mono space-y-1">
              <div>
                <span className="text-[#d4af37] font-semibold">CUI/CIF:</span> 50143520 • <span className="text-[#d4af37] font-semibold">Reg:</span> F2024000617057
              </div>
              <div className="text-zinc-400 text-[10px]">
                Înreg.: 28.05.2024 • CAEN: 9621 · Rev. 3
              </div>
              <div className="text-zinc-300">
                Str. PLOPILOR, Nr. 28, 417585 Tileagd, Bihor
              </div>
            </div>
          </div>

          {/* Col 2: Program & Orar */}
          <div className="space-y-4">
            <h4 className="font-serif-luxury text-base text-white font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#d4af37]" />
              <span>Program de Lucru</span>
            </h4>

            <ul className="space-y-2 text-zinc-300">
              <li className="flex justify-between border-b border-zinc-800/60 pb-1.5 text-zinc-500">
                <span>Luni:</span>
                <span>Închis</span>
              </li>
              <li className="flex justify-between border-b border-zinc-800/60 pb-1.5">
                <span>Marți – Vineri:</span>
                <span className="font-semibold text-white">09:00 – 16:00</span>
              </li>
              <li className="flex justify-between border-b border-zinc-800/60 pb-1.5">
                <span>Sâmbătă:</span>
                <span className="font-semibold text-white">09:00 – 13:00</span>
              </li>
              <li className="flex justify-between border-b border-zinc-800/60 pb-1.5 text-zinc-500">
                <span>Duminică:</span>
                <span>Închis</span>
              </li>
            </ul>

            <p className="text-[11px] text-zinc-500 leading-tight">
              * Vă rugăm să respectați ora programării pentru a asigura confortul tuturor clienților.
            </p>
          </div>

          {/* Col 3: Contact Direct */}
          <div className="space-y-4">
            <h4 className="font-serif-luxury text-base text-white font-medium flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#d4af37]" />
              <span>Contact &amp; Locație</span>
            </h4>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
                <a
                  href="https://maps.app.goo.gl/5VWHefyfAgicsNBn6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-300 hover:text-[#d4af37] transition-colors"
                  title="Deschide în Google Maps"
                >
                  Strada Trandafirilor 1099, 417585 Tileagd, România
                </a>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <a href="tel:+40751676420" className="text-zinc-200 hover:text-[#d4af37] font-semibold">
                  +40 751 676 420
                </a>
              </div>

              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                <a
                  href="https://wa.me/40751676420?text=Salut,%20Roxana!%20Aș%20dori%20o%20programare."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  WhatsApp Rapid: +40 751 676 420
                </a>
              </div>
            </div>
          </div>

          {/* Col 4: Legislație & Protecția Consumatorului */}
          <div className="space-y-3">
            <h4 className="font-serif-luxury text-base text-white font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Informații Legale</span>
            </h4>

            <div className="flex flex-col space-y-2">
              <button
                onClick={() => openModal('termeni')}
                className="text-left text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Termeni și Condiții
              </button>
              <button
                onClick={() => openModal('gdpr')}
                className="text-left text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Politică de Confidențialitate (GDPR)
              </button>
              <button
                onClick={() => openModal('cookies')}
                className="text-left text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Politică de Cookie-uri
              </button>
            </div>

            {/* Official ANPC & SOL links */}
            <div className="pt-2 space-y-1.5">
              <a
                href="https://anpc.ro/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 hover:text-white flex items-center justify-between"
              >
                <span>ANPC - Protecția Consumatorilor</span>
                <ExternalLink className="w-3 h-3 text-zinc-500" />
              </a>

              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 hover:text-white flex items-center justify-between"
              >
                <span>SOL - Soluționare Litigii Online</span>
                <ExternalLink className="w-3 h-3 text-zinc-500" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-8 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-500 text-[11px]">
          <div>
            &copy; {new Date().getFullYear()} ROXANA TEUȘDE PFA (BUIE) • CIF: 50143520 • Reg. Com: F2024000617057. Toate drepturile rezervate.
          </div>
          <div className="flex items-center gap-4">
            <span>Str. Plopilor 28, Tileagd, Bihor</span>
            <span>•</span>
            <span>9621 · Rev. 3 Activități de coafură și frizerie</span>
          </div>
        </div>
      </div>

      {/* Legal Modal */}
      {modalContent && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalContent(null)}
        >
          <div
            className="max-w-2xl w-full bg-zinc-900 border border-zinc-700 rounded-3xl p-6 sm:p-8 shadow-2xl relative animate-in zoom-in-95 max-h-[80vh] flex flex-col text-xs text-zinc-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <h3 className="font-serif-luxury text-xl text-white font-medium">
                {modalContent.title}
              </h3>
              <button
                onClick={() => setModalContent(null)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 whitespace-pre-line leading-relaxed text-zinc-300 pr-2">
              {modalContent.body}
            </div>

            <div className="pt-4 border-t border-zinc-800 mt-4 text-right">
              <button
                onClick={() => setModalContent(null)}
                className="px-5 py-2 rounded-xl bg-[#d4af37] text-zinc-950 font-bold cursor-pointer"
              >
                Am înțeles
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
