import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, X, Clock, AlertCircle } from 'lucide-react';
import { formatRomanianDateWithDay } from '../utils/bookingUtils';

interface CalendarDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  minDate?: string;
  className?: string;
}

const ROMANIAN_MONTHS = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
];

const WEEKDAY_NAMES = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];

export const CalendarDatePicker: React.FC<CalendarDatePickerProps> = ({
  value,
  onChange,
  minDate = new Date().toISOString().split('T')[0],
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  // Parse current value or fallback to today
  const selectedDateParts = value ? value.split('-').map(Number) : [];
  const initialYear = selectedDateParts[0] || new Date().getFullYear();
  const initialMonth = (selectedDateParts[1] ? selectedDateParts[1] - 1 : new Date().getMonth());

  const [currentYear, setCurrentYear] = useState<number>(initialYear);
  const [currentMonth, setCurrentMonth] = useState<number>(initialMonth);

  // Sync viewed month if external value changes
  useEffect(() => {
    if (value) {
      const parts = value.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setCurrentYear(parts[0]);
        setCurrentMonth(parts[1] - 1);
      }
    }
  }, [value]);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  // Calculate first day of the month (0 = Sunday, 1 = Monday ... 6 = Saturday)
  // We want Monday = 0, Sunday = 6
  const firstDayRaw = new Date(currentYear, currentMonth, 1).getDay();
  const firstDayMondayOffset = (firstDayRaw + 6) % 7;

  const todayStr = new Date().toISOString().split('T')[0];

  const formatDateStr = (year: number, monthIndex: number, day: number) => {
    const m = String(monthIndex + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const handleSelectDate = (dateStr: string, isPast: boolean) => {
    if (isPast) return;
    onChange(dateStr);
    setIsOpen(false);
  };

  // Quick shortcuts
  const handleQuickSelect = (offsetDays: number) => {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    const dateStr = target.toISOString().split('T')[0];
    onChange(dateStr);
    setCurrentYear(target.getFullYear());
    setCurrentMonth(target.getMonth());
    setIsOpen(false);
  };

  const handleSelectNextTuesday = () => {
    const target = new Date();
    const currentDay = target.getDay(); // 0 is Sunday, 1 is Monday, 2 is Tuesday
    const daysUntilNextTuesday = ((2 + 7 - currentDay) % 7) || 7;
    target.setDate(target.getDate() + daysUntilNextTuesday);
    const dateStr = target.toISOString().split('T')[0];
    onChange(dateStr);
    setCurrentYear(target.getFullYear());
    setCurrentMonth(target.getMonth());
    setIsOpen(false);
  };

  // Day of week of selected value
  let selectedDayOfWeek = -1;
  if (value) {
    const parts = value.split('-').map(Number);
    if (parts.length === 3) {
      selectedDayOfWeek = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    }
  }

  const isSundaySelected = selectedDayOfWeek === 0;
  const isMondaySelected = selectedDayOfWeek === 1;
  const isClosedSelected = isSundaySelected || isMondaySelected;
  const isSaturdaySelected = selectedDayOfWeek === 6;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden native input for form compatibility & mobile trigger */}
      <input
        ref={nativeInputRef}
        type="date"
        aria-hidden="true"
        className="sr-only"
        min={minDate}
        value={value}
        onChange={e => {
          if (e.target.value) onChange(e.target.value);
        }}
      />

      {/* Interactive Date Trigger Box */}
      <div
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        className={`w-full px-4 py-3.5 rounded-2xl bg-zinc-950/80 border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group select-none ${
          isOpen
            ? 'border-[#d4af37] ring-2 ring-[#d4af37]/20 shadow-lg shadow-amber-950/30'
            : isClosedSelected
            ? 'border-red-500/60 bg-red-950/20 hover:border-red-400'
            : 'border-zinc-700/80 hover:border-[#d4af37]/70'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
              isOpen
                ? 'bg-[#d4af37] text-zinc-950 shadow-md'
                : isClosedSelected
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-zinc-900 border border-zinc-700 text-[#d4af37]'
            }`}
          >
            <CalendarIcon className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-white capitalize truncate flex items-center gap-2">
              <span>{value ? formatRomanianDateWithDay(value) : 'Alege data dorită'}</span>
            </div>
            <div className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3 h-3 text-[#d4af37]" />
              {isMondaySelected ? (
                <span className="text-red-400 font-semibold">Atelier Închis Lunea (alege Marți–Sâmbătă)</span>
              ) : isSundaySelected ? (
                <span className="text-red-400 font-semibold">Atelier Închis Duminica (alege Marți–Sâmbătă)</span>
              ) : isSaturdaySelected ? (
                <span className="text-amber-300 font-medium">Sâmbătă • Program scurt (09:00 – 13:00)</span>
              ) : (
                <span className="text-zinc-400">Marți – Vineri • Program normal (09:00 – 16:00)</span>
              )}
            </div>
          </div>
        </div>

        {/* Right action button */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isOpen
                ? 'bg-[#d4af37] text-zinc-950 shadow-md'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>{isOpen ? 'Închide' : 'Bifează în Calendar'}</span>
          </button>
        </div>
      </div>

      {/* Custom Romanian Interactive Calendar Dropdown / Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto sm:w-[380px] mt-2.5 z-50 bg-[#14161b] border-2 border-[#d4af37] rounded-3xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          {/* Header: Month & Year Navigator */}
          <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-zinc-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
              aria-label="Luna anterioară"
              title="Luna anterioară"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center">
              <div className="font-serif-luxury text-base sm:text-lg font-semibold text-white">
                {ROMANIAN_MONTHS[currentMonth]} {currentYear}
              </div>
              <span className="text-[10px] text-zinc-400">Apasă pe zi pentru selectare</span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
              aria-label="Luna următoare"
              title="Luna următoare"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Select Buttons */}
          <div className="grid grid-cols-3 gap-1.5 mb-3.5 pb-3 border-b border-zinc-800/80">
            <button
              type="button"
              onClick={() => handleQuickSelect(0)}
              className="px-2 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-[#d4af37]/40 text-[11px] font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer text-center"
            >
              Azi
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(1)}
              className="px-2 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-[#d4af37]/40 text-[11px] font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer text-center"
            >
              Mâine
            </button>
            <button
              type="button"
              onClick={handleSelectNextTuesday}
              className="px-2 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-[#d4af37]/40 text-[11px] font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer text-center"
            >
              Marți Viitoare
            </button>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {WEEKDAY_NAMES.map((name, i) => (
              <div
                key={name}
                className={`text-[11px] font-bold py-1 ${
                  i === 0 || i === 6 ? 'text-red-400' : i === 5 ? 'text-amber-400' : 'text-zinc-400'
                }`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty slots before first day of month */}
            {Array.from({ length: firstDayMondayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="h-9 w-full" />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = formatDateStr(currentYear, currentMonth, day);
              const dayOfWeek = (firstDayMondayOffset + i) % 7; // 0 = Mon ... 5 = Sat, 6 = Sun
              const isMonday = dayOfWeek === 0;
              const isSunday = dayOfWeek === 6;
              const isClosed = isMonday || isSunday;
              const isSaturday = dayOfWeek === 5;
              const isPast = minDate ? dateStr < minDate : false;
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={isPast}
                  onClick={() => handleSelectDate(dateStr, isPast)}
                  className={`h-9 w-full rounded-xl text-xs font-semibold flex flex-col items-center justify-center transition-all relative cursor-pointer ${
                    isSelected
                      ? 'bg-[#d4af37] text-zinc-950 font-bold shadow-md shadow-amber-950/40 scale-105 z-10'
                      : isPast
                      ? 'text-zinc-600 opacity-30 cursor-not-allowed bg-transparent'
                      : isClosed
                      ? 'text-red-400 hover:bg-red-950/30 hover:border hover:border-red-500/40'
                      : isSaturday
                      ? 'text-amber-300 hover:bg-zinc-800 hover:text-white border border-amber-500/20'
                      : 'text-zinc-200 hover:bg-zinc-800 hover:text-white'
                  } ${isToday && !isSelected ? 'border border-[#d4af37]/60' : ''}`}
                  title={
                    isPast
                      ? 'Dată trecută (indisponibilă)'
                      : isMonday
                      ? 'Luni: Atelier Închis'
                      : isSunday
                      ? 'Duminică: Atelier Închis'
                      : isSaturday
                      ? 'Sâmbătă: 09:00 - 13:00'
                      : 'Marți - Vineri: 09:00 - 16:00'
                  }
                >
                  <span>{day}</span>
                  {isClosed && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-red-400 -mt-0.5" />
                  )}
                  {isSaturday && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-amber-400 -mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend & Hours Info */}
          <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Ma–Vi 09–16</span>
              </span>
              <span className="flex items-center gap-1 text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Sâm 09–13</span>
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span>Lun &amp; Dum Închis</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[#d4af37] hover:underline font-semibold cursor-pointer"
            >
              Gata ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
