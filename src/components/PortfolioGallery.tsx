import React, { useState } from 'react';
import { Play, Sparkles, X, ChevronLeft, ChevronRight, Scissors, Calendar, User, Lock, Edit2 } from 'lucide-react';
import { GalleryItem, MediaCategory, SectionSettings } from '../types';
import { DEFAULT_GALLERY_SETTINGS } from '../services/dataService';

interface PortfolioGalleryProps {
  items: GalleryItem[];
  settings?: SectionSettings;
  onOpenManageGallery?: () => void;
  isAdminLoggedIn?: boolean;
}

export const PortfolioGallery: React.FC<PortfolioGalleryProps> = ({
  items,
  settings = DEFAULT_GALLERY_SETTINGS,
  onOpenManageGallery,
  isAdminLoggedIn = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activePhoto, setActivePhoto] = useState<GalleryItem | null>(null);
  const [activeVideo, setActiveVideo] = useState<GalleryItem | null>(null);

  const categoryTags = settings.tags && settings.tags.length > 0 ? settings.tags : DEFAULT_GALLERY_SETTINGS.tags;

  const filteredItems = items.filter(item => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'video') return item.mediaType === 'video' || item.category === 'video';
    if (selectedCategory === 'barbati') {
      return item.category === 'barbati' || item.category === 'fade' || item.category === 'barba' || item.category === 'clasic';
    }
    return item.category === selectedCategory;
  });

  const openLightbox = (item: GalleryItem) => {
    if (item.mediaType === 'video') {
      setActiveVideo(item);
    } else {
      setActivePhoto(item);
    }
  };

  const handleNextPhoto = () => {
    if (!activePhoto) return;
    const photoList = filteredItems.filter(i => i.mediaType === 'photo');
    const currentIndex = photoList.findIndex(i => i.id === activePhoto.id);
    if (currentIndex < photoList.length - 1) {
      setActivePhoto(photoList[currentIndex + 1]);
    } else {
      setActivePhoto(photoList[0]);
    }
  };

  const handlePrevPhoto = () => {
    if (!activePhoto) return;
    const photoList = filteredItems.filter(i => i.mediaType === 'photo');
    const currentIndex = photoList.findIndex(i => i.id === activePhoto.id);
    if (currentIndex > 0) {
      setActivePhoto(photoList[currentIndex - 1]);
    } else {
      setActivePhoto(photoList[photoList.length - 1]);
    }
  };

  return (
    <section id="galerie" className="py-24 bg-[#0c0d10] border-b border-[#1c1f26]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{settings.badgeText || 'Portofoliu Tunsori & Bărbi'}</span>
          </div>

          <h2 className="font-serif-luxury text-3xl sm:text-5xl text-white font-normal mb-4">
            {settings.title || 'Lucrări Realizate în Atelierul Roxana Teușde (Buie)'}
          </h2>
          <p className="text-zinc-400 text-base font-light">
            {settings.subtitle || 'Tranziții curate, aliniere simetrică la brici și styling impecabil. Toate fotografiile și videoclipurile sunt realizate pe clienții noștri reali.'}
          </p>

          {onOpenManageGallery && (
            <div className="flex items-center justify-center mt-5">
              <button
                type="button"
                onClick={onOpenManageGallery}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-[#d4af37] border border-zinc-700/80 hover:border-[#d4af37]/60 text-xs font-medium transition-all cursor-pointer shadow-sm"
                title="Modifică titlul, etichetele sau lucrările din Panoul de Control Administrator"
              >
                <Lock className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Modifică Titlu, Etichete &amp; Lucrări (Panou Admin)</span>
              </button>
            </div>
          )}

          {/* Categories Tab Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            {categoryTags.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#d4af37] text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Media Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => (
            <div
              key={item.id}
              onClick={() => openLightbox(item)}
              className="group relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 hover:border-[#d4af37]/60 transition-all duration-300 cursor-pointer shadow-lg"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-950 relative">
                <img
                  src={item.thumbnailUrl || item.mediaUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />

                {/* Video Play badge overlay */}
                {item.mediaType === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                    <div className="w-14 h-14 rounded-full bg-[#d4af37] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 text-zinc-950 fill-zinc-950 ml-0.5" />
                    </div>
                  </div>
                )}

                {/* Top Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-semibold uppercase tracking-wider text-amber-300 border border-amber-500/30">
                    {item.mediaType === 'video' ? 'Video Teaser' : item.category}
                  </span>
                  {item.featured && (
                    <span className="px-2 py-0.5 rounded-full bg-[#d4af37] text-zinc-950 text-[10px] font-bold">
                      Recomandat
                    </span>
                  )}
                </div>

                {/* Bottom Overlay Info */}
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex flex-col justify-end translate-y-2 group-hover:translate-y-0 transition-transform">
                  <h4 className="font-serif-luxury text-lg text-white font-medium line-clamp-1 group-hover:text-[#d4af37] transition-colors">
                    {item.title}
                  </h4>
                  {item.clientNames && (
                    <div className="text-xs text-zinc-300 flex items-center gap-1.5 mt-0.5">
                      <Scissors className="w-3 h-3 text-[#d4af37]" />
                      <span>{item.clientNames}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="py-16 text-center text-zinc-400">
            Nu există elemente în această categorie momentan.
          </div>
        )}
      </div>

      {/* Lightbox Modal for Photos */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActivePhoto(null)}
        >
          <button
            onClick={() => setActivePhoto(null)}
            className="absolute top-5 right-5 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white z-10 transition-colors"
            aria-label="Închide"
          >
            <X className="w-6 h-6" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrevPhoto();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white z-10 transition-colors"
            aria-label="Fotografia precedentă"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNextPhoto();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white z-10 transition-colors"
            aria-label="Fotografia următoare"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div
            className="max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activePhoto.mediaUrl}
              alt={activePhoto.title}
              className="max-h-[75vh] w-auto object-contain rounded-lg shadow-2xl"
            />
            <div className="mt-4 text-center">
              <h3 className="font-serif-luxury text-2xl text-white font-medium">
                {activePhoto.title}
              </h3>
              {activePhoto.description && (
                <p className="text-zinc-300 text-sm mt-1 max-w-xl">{activePhoto.description}</p>
              )}
              {activePhoto.clientNames && (
                <p className="text-xs text-[#d4af37] mt-1 font-medium">
                  {activePhoto.clientNames}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Modal Player */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActiveVideo(null)}
        >
          <button
            onClick={() => setActiveVideo(null)}
            className="absolute top-5 right-5 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white z-10 transition-colors"
            aria-label="Închide video"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            className="max-w-4xl w-full bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-serif-luxury text-xl text-white font-medium">{activeVideo.title}</h3>
                <span className="text-xs text-[#d4af37]">Clip Frizerie &amp; Tehnici • Roxana Teușde (Buie)</span>
              </div>
            </div>

            <div className="aspect-video w-full bg-black">
              {activeVideo.mediaUrl.endsWith('.mp4') || activeVideo.mediaUrl.includes('mixkit.co') ? (
                <video
                  src={activeVideo.mediaUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-cover"
                />
              ) : (
                <iframe
                  src={activeVideo.mediaUrl}
                  title={activeVideo.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>

            {activeVideo.description && (
              <div className="p-4 text-xs text-zinc-300 bg-zinc-950/70">
                {activeVideo.description}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
