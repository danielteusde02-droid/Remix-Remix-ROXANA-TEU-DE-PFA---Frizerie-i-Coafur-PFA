import React, { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { AboutSection } from './components/AboutSection';
import { ServicesSection } from './components/ServicesSection';
import { InteractiveCalculator } from './components/InteractiveCalculator';
import { PortfolioGallery } from './components/PortfolioGallery';
import { BookingForm } from './components/BookingForm';
import { ReviewsSection } from './components/ReviewsSection';
import { GoogleMapsAgent } from './components/GoogleMapsAgent';
import { Footer } from './components/Footer';
import { AdminModal } from './components/AdminModal';
import { dataService } from './services/dataService';
import { getSupabase } from './lib/supabase';
import { checkActiveAdminSession, verifyUserIsAdmin } from './utils/authUtils';
import { Booking, GalleryItem, Review, ServicePackage, SiteImages, ServiceAddon, SectionSettings } from './types';
import { BarbershopAddons } from './utils/bookingUtils';
import { AdminTab } from './components/AdminModal';

export default function App() {
  const [services, setServices] = useState<ServicePackage[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [addonsList, setAddonsList] = useState<ServiceAddon[]>([]);
  const [gallerySettings, setGallerySettings] = useState<SectionSettings>(dataService.getGallerySettings());
  const [servicesSettings, setServicesSettings] = useState<SectionSettings>(dataService.getServicesSettings());
  const [siteImages, setSiteImages] = useState<SiteImages>(dataService.getSiteImages());
  const [loading, setLoading] = useState(true);

  // Booking form preselection
  const [preselectedServiceId, setPreselectedServiceId] = useState<string>('tuns-skin-fade');
  const [preselectedAddons, setPreselectedAddons] = useState<BarbershopAddons>({});

  // Admin Modal
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<AdminTab>('overview');
  const [adminTargetServiceId, setAdminTargetServiceId] = useState<string | null>(null);
  const [adminTargetAddonId, setAdminTargetAddonId] = useState<string | null>(null);

  const handleOpenAdminServices = (serviceId?: string) => {
    setAdminInitialTab('services');
    setAdminTargetServiceId(serviceId || null);
    setAdminTargetAddonId(null);
    setIsAdminOpen(true);
  };

  const handleOpenAdminAddons = (addonId?: string) => {
    setAdminInitialTab('addons');
    setAdminTargetAddonId(addonId || null);
    setAdminTargetServiceId(null);
    setIsAdminOpen(true);
  };

  const handleOpenAdminGallery = () => {
    setAdminInitialTab('gallery');
    setAdminTargetServiceId(null);
    setAdminTargetAddonId(null);
    setIsAdminOpen(true);
  };

  // Google Maps Platform quota state
  const [hasMapsQuotaExceeded, setHasMapsQuotaExceeded] = useState(false);

  // Initial load & real visitor tracking
  const refreshAllData = async () => {
    try {
      const [s, g, r, a, remoteSettings] = await Promise.all([
        dataService.getServices(),
        dataService.getGalleryItems(),
        dataService.getReviews(true), // only approved reviews for public
        dataService.getAddons(),
        dataService.fetchRemoteSettings(),
      ]);
      setServices(s);
      setGallery(g);
      setReviews(r);
      setAddonsList(a);
      setGallerySettings(remoteSettings.gallerySettings);
      setServicesSettings(remoteSettings.servicesSettings);
      setSiteImages(remoteSettings.siteImages);
    } catch (err) {
      console.warn('Error loading initial data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();
    // Verify active Supabase Auth session & database admin role
    checkActiveAdminSession().then(({ isLoggedIn }) => {
      setIsAdminLoggedIn(isLoggedIn);
    });

    const supabase = getSupabase();
    const authSub = supabase?.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setIsAdminLoggedIn(false);
        return;
      }
      const isVerifiedAdmin = await verifyUserIsAdmin(session.user);
      setIsAdminLoggedIn(isVerifiedAdmin);
    });

    // Track site visit for admin analytics
    dataService.trackVisit(window.location.pathname || '/');

    const handleQuotaExceeded = () => setHasMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
      authSub?.data?.subscription?.unsubscribe();
    };
  }, []);

  const handleOpenBooking = () => {
    const el = document.getElementById('booking');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleExploreGallery = () => {
    const el = document.getElementById('galerie');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectPackage = (pkg: ServicePackage) => {
    setPreselectedServiceId(pkg.id);
    handleOpenBooking();
  };

  const handleApplyConfiguration = (serviceId: string, addons: BarbershopAddons) => {
    setPreselectedServiceId(serviceId);
    setPreselectedAddons(addons);
    handleOpenBooking();
  };

  return (
    <div className="min-h-screen bg-[#0c0d10] text-[#e5e5e5] flex flex-col font-sans selection:bg-[#d4af37] selection:text-zinc-950">
      {/* Google Maps Quota Notification */}
      {hasMapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Navigation Header */}
      <Header
        onOpenBooking={handleOpenBooking}
        onOpenAdmin={() => {
          setAdminInitialTab('overview');
          setAdminTargetServiceId(null);
          setIsAdminOpen(true);
        }}
        isAdminLoggedIn={isAdminLoggedIn}
      />

      {/* Main Content */}
      <main className="flex-grow">
        {/* Hero Section */}
        <Hero
          onOpenBooking={handleOpenBooking}
          onExploreGallery={handleExploreGallery}
          heroBgUrl={siteImages.heroBgUrl}
        />

        {/* Despre Roxana Teușde (Buie) */}
        <AboutSection
          aboutPhotoUrl={siteImages.aboutPhotoUrl}
          salonBannerUrl={siteImages.salonBannerUrl}
        />

        {/* Meniu Servicii & Tarife Frizerie */}
        <ServicesSection
          services={services}
          settings={servicesSettings}
          onSelectPackage={handleSelectPackage}
          onOpenManageServices={handleOpenAdminServices}
          isAdminLoggedIn={isAdminLoggedIn}
        />

        {/* Configurator Personalizat */}
        <InteractiveCalculator
          services={services}
          addonsList={addonsList}
          onApplyConfiguration={handleApplyConfiguration}
          onOpenManageServices={handleOpenAdminServices}
          onOpenManageAddons={handleOpenAdminAddons}
          isAdminLoggedIn={isAdminLoggedIn}
        />

        {/* Portofoliu Foto & Video */}
        <PortfolioGallery
          items={gallery}
          settings={gallerySettings}
          onOpenManageGallery={handleOpenAdminGallery}
          isAdminLoggedIn={isAdminLoggedIn}
        />

        {/* Formular Programare Online */}
        <BookingForm
          services={services}
          addonsList={addonsList}
          preselectedServiceId={preselectedServiceId}
          preselectedAddons={preselectedAddons}
          onBookingCreated={() => refreshAllData()}
        />

        {/* Recenzii Clienți */}
        <ReviewsSection
          reviews={reviews}
          onReviewSubmitted={() => refreshAllData()}
        />

        {/* Asistent Traseu & Hartă Google Maps */}
        <GoogleMapsAgent />
      </main>

      {/* Footer with legal info & modals */}
      <Footer />

      {/* Admin Control Panel Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => {
          setIsAdminOpen(false);
          setAdminTargetServiceId(null);
          setAdminTargetAddonId(null);
        }}
        onDataModified={() => refreshAllData()}
        isAdminLoggedIn={isAdminLoggedIn}
        setIsAdminLoggedIn={setIsAdminLoggedIn}
        siteImages={siteImages}
        onSiteImagesUpdated={setSiteImages}
        initialTab={adminInitialTab}
        targetServiceId={adminTargetServiceId}
        targetAddonId={adminTargetAddonId}
      />

      {/* Floating WhatsApp Quick Action */}
      <a
        href="https://wa.me/40751676420?text=Salut,%20Roxana!%20Aș%20dori%20o%20programare%20la%20frizerie."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactează pe WhatsApp: +40 751 676 420"
        className="fixed bottom-6 right-6 z-40 bg-emerald-600 hover:bg-emerald-500 text-white p-3.5 sm:px-4 sm:py-3 rounded-full shadow-2xl flex items-center gap-2.5 hover:scale-105 active:scale-95 transition-all border border-emerald-400/40 group cursor-pointer"
        title="Discută pe WhatsApp: +40 751 676 420"
      >
        <MessageSquare className="w-5 h-5 fill-white/20" />
        <span className="hidden sm:inline text-xs font-bold tracking-wide">
          WhatsApp • +40 751 676 420
        </span>
      </a>
    </div>
  );
}
