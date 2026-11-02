import React, { useState } from 'react';
import { Star, MessageSquarePlus, Sparkles, CheckCircle2, AlertCircle, X, Quote } from 'lucide-react';
import { Review } from '../types';
import { dataService } from '../services/dataService';

interface ReviewsSectionProps {
  reviews: Review[];
  onReviewSubmitted?: (review: Review) => void;
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({ reviews, onReviewSubmitted }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    authorName: '',
    roleOrEvent: '',
    rating: 5,
    text: '',
    eventDate: '',
  });

  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleOpenModal = () => {
    setSuccessMessage('');
    setErrorMessage('');
    setFormData({
      authorName: '',
      roleOrEvent: '',
      rating: 5,
      text: '',
      eventDate: '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.authorName.trim()) {
      setErrorMessage('Vă rugăm să introduceți numele dumneavoastră.');
      return;
    }

    if (!formData.text.trim() || formData.text.trim().length < 10) {
      setErrorMessage('Vă rugăm să scrieți o scurtă recenzie de cel puțin 10 caractere.');
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await dataService.submitReview({
        authorName: formData.authorName.trim(),
        roleOrEvent: formData.roleOrEvent.trim() || 'Client Frizerie',
        rating: formData.rating,
        text: formData.text.trim(),
        eventDate: formData.eventDate.trim(),
      });

      setSuccessMessage('Îți mulțumim! Recenzia ta a fost înregistrată și va apărea pe site după aprobare.');
      if (onReviewSubmitted) {
        onReviewSubmitted(created);
      }
    } catch (err: any) {
      setErrorMessage('A apărut o problemă la salvarea recenziei. Vă rugăm să încercați din nou.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="recenzii" className="py-24 bg-[#0e1014] border-b border-[#1c1f26]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recenzii &amp; Păreri Clienți</span>
          </div>

          <h2 className="font-serif-luxury text-3xl sm:text-5xl text-white font-normal mb-4">
            Ce Spun Domnii Care Trec Pragul Atelierului Nostru
          </h2>

          <p className="text-zinc-400 text-base sm:text-lg font-light">
            Respectul pentru client și calitatea fiecărei linii trase cu mașina sau briciul ne-au adus o comunitate de clienți fideli.
          </p>

          <div className="mt-6 flex items-center justify-center gap-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <Star key={star} className="w-5 h-5 fill-[#d4af37] text-[#d4af37]" />
              ))}
            </div>
            <span className="text-white font-bold text-sm">5.0 / 5.0</span>
            <span className="text-zinc-500">•</span>
            <button
              onClick={handleOpenModal}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#d4af37] hover:text-[#e4c257] underline underline-offset-4 cursor-pointer"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>Te-ai tuns la noi? Lasă o părere</span>
            </button>
          </div>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {reviews.map(review => (
            <div
              key={review.id}
              className="bg-zinc-900/60 border border-zinc-800 p-6 sm:p-8 rounded-2xl flex flex-col justify-between hover:border-zinc-700 transition-all shadow-md"
            >
              <div>
                {/* Rating & Quote */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= review.rating
                            ? 'fill-[#d4af37] text-[#d4af37]'
                            : 'text-zinc-700'
                        }`}
                      />
                    ))}
                  </div>
                  <Quote className="w-6 h-6 text-zinc-700/60" />
                </div>

                {/* Review text */}
                <p className="text-zinc-300 text-sm sm:text-base leading-relaxed font-light mb-6 italic">
                  "{review.text}"
                </p>
              </div>

              {/* Author info */}
              <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <div>
                  <h4 className="font-serif-luxury text-lg text-white font-medium">
                    {review.authorName}
                  </h4>
                  <p className="text-xs text-zinc-400">{review.roleOrEvent}</p>
                </div>
                {review.eventDate && (
                  <span className="text-xs text-zinc-500 font-mono">{review.eventDate}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Leave review banner */}
        <div className="mt-12 text-center">
          <button
            onClick={handleOpenModal}
            className="px-6 py-3 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white text-sm font-semibold transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <MessageSquarePlus className="w-4 h-4 text-[#d4af37]" />
            <span>Adaugă o Recenzie Despre Atelier</span>
          </button>
        </div>
      </div>

      {/* Leave Review Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="max-w-lg w-full bg-zinc-900 border border-zinc-700 rounded-3xl p-6 sm:p-8 shadow-2xl relative animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              aria-label="Închide"
            >
              <X className="w-5 h-5" />
            </button>

            {successMessage ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="font-serif-luxury text-2xl text-white font-medium mb-2">
                  Recenzie Înregistrată!
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                  {successMessage}
                </p>
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl bg-[#d4af37] text-zinc-950 font-bold text-sm cursor-pointer"
                >
                  Închide Fereastra
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h3 className="font-serif-luxury text-2xl text-white font-medium mb-1">
                    Părerea Ta Despre Atelierul Roxana Teușde (Buie)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Spune-ne cum a fost experiența ta pe scaunul de frizerie.
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Rating stars */}
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Notă:
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => {
                      const current = hoverRating ?? formData.rating;
                      return (
                        <button
                          type="button"
                          key={star}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(null)}
                          onClick={() => setFormData({ ...formData, rating: star })}
                          className="p-1 cursor-pointer focus:outline-none"
                        >
                          <Star
                            className={`w-7 h-7 transition-colors ${
                              star <= current
                                ? 'fill-[#d4af37] text-[#d4af37]'
                                : 'text-zinc-600'
                            }`}
                          />
                        </button>
                      );
                    })}
                    <span className="text-xs text-zinc-400 ml-2 font-medium">
                      {formData.rating} din 5 stele
                    </span>
                  </div>
                </div>

                {/* Author Name */}
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Numele Tău *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.authorName}
                    onChange={e => setFormData({ ...formData, authorName: e.target.value })}
                    placeholder="ex: Mihai Popa"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-sm focus:border-[#d4af37] focus:outline-none"
                  />
                </div>

                {/* Role or Service */}
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Serviciul primit (ex: Tuns Skin Fade, Bărbierit Tradițional)
                  </label>
                  <input
                    type="text"
                    value={formData.roleOrEvent}
                    onChange={e => setFormData({ ...formData, roleOrEvent: e.target.value })}
                    placeholder="ex: Pachet The Gentleman"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-sm focus:border-[#d4af37] focus:outline-none"
                  />
                </div>

                {/* Text */}
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Recenzia Ta *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formData.text}
                    onChange={e => setFormData({ ...formData, text: e.target.value })}
                    placeholder="Cum a fost tunsul? Cum ți s-a părut atmosfera și produsele folosite?"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-sm focus:border-[#d4af37] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8972f] hover:from-[#e0be4d] hover:to-[#c3a033] text-zinc-950 font-bold text-sm cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Se trimite...' : 'Trimite Recenzia'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
