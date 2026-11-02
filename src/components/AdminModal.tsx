import React, { useState, useEffect } from 'react';
import {
  X, Shield, Lock, LogOut, CheckCircle2, AlertCircle, RefreshCw, Upload, Image,
  Video, Trash2, Check, Star, Database, Key, Copy, Eye, EyeOff, Search, Filter, Phone,
  Mail, Calendar, Clock, DollarSign, Users, ExternalLink, ArrowRight, FileText, Activity,
  Globe, Smartphone, Monitor, Edit2, Save, Tag, Plus, Sliders, Layers, Sparkles
} from 'lucide-react';
import { Booking, BookingStatus, GalleryItem, MediaCategory, Review, ServicePackage, VisitorLog, SiteImages, ServiceAddon, SectionSettings, CategoryTag } from '../types';
import { dataService, INITIAL_ADDONS, DEFAULT_GALLERY_SETTINGS, DEFAULT_SERVICES_SETTINGS } from '../services/dataService';
import { getSupabaseCredentials, saveSupabaseCredentials, testSupabaseConnection, uploadMediaToSupabaseStorage, isSupabaseConfigured } from '../lib/supabase';
import { authenticateAdmin, signOutAdmin } from '../utils/authUtils';
import {
  calculateBarberEstimate,
  extractAdminScheduleExceptionReason,
  formatAdminScheduleExceptionTag,
  formatRomanianDate,
  formatRon,
  validateBookingScheduleAndDuration,
} from '../utils/bookingUtils';
import { generateSupabaseSQLSchema, getSecurityAudit } from '../utils/securityUtils';

export type AdminTab = 'overview' | 'bookings' | 'services' | 'addons' | 'siteMedia' | 'gallery' | 'visitors' | 'reviews' | 'supabase';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataModified?: () => void;
  isAdminLoggedIn: boolean;
  setIsAdminLoggedIn: (val: boolean) => void;
  siteImages?: SiteImages;
  onSiteImagesUpdated?: (images: SiteImages) => void;
  initialTab?: AdminTab;
  targetServiceId?: string | null;
  targetAddonId?: string | null;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  onDataModified,
  isAdminLoggedIn,
  setIsAdminLoggedIn,
  siteImages,
  onSiteImagesUpdated,
  initialTab,
  targetServiceId,
  targetAddonId,
}) => {
  // Auth state
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showQuickSupabaseConfig, setShowQuickSupabaseConfig] = useState(false);
  const [quickSaveMessage, setQuickSaveMessage] = useState('');
  const [copiedBootstrapSql, setCopiedBootstrapSql] = useState(false);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Tratamente Opționale / Servicii Extra state
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [editingAddon, setEditingAddon] = useState<ServiceAddon | null>(null);
  const [isCreatingAddon, setIsCreatingAddon] = useState(false);
  const [addonSuccessMsg, setAddonSuccessMsg] = useState('');
  const [addonForm, setAddonForm] = useState({
    id: '',
    name: '',
    priceRon: 25,
    durationMin: 10,
    description: '',
    imageUrl: '',
    popular: false,
  });

  // Section Settings (Titluri, Subtitluri, Etichete Categorii)
  const [gallerySettings, setGallerySettings] = useState<SectionSettings>(DEFAULT_GALLERY_SETTINGS);
  const [gallerySettingsMsg, setGallerySettingsMsg] = useState('');
  const [newGalleryTagLabel, setNewGalleryTagLabel] = useState('');

  const [servicesSettings, setServicesSettings] = useState<SectionSettings>(DEFAULT_SERVICES_SETTINGS);
  const [servicesSettingsMsg, setServicesSettingsMsg] = useState('');
  const [newServiceTagLabel, setNewServiceTagLabel] = useState('');

  // Services & Products management state
  const [servicesSearch, setServicesSearch] = useState('');
  const [servicesCategoryFilter, setServicesCategoryFilter] = useState('all');
  const [editingService, setEditingService] = useState<ServicePackage | null>(null);
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [serviceSuccessMsg, setServiceSuccessMsg] = useState('');
  const [serviceForm, setServiceForm] = useState({
    title: '',
    category: 'tuns',
    price: 70,
    duration: '40 minute',
    durationMin: 40,
    popular: false,
    description: '',
    imageUrl: '',
    featuresText: 'Consiliere stil și fizionomie\nSpălat dublu energizant\nStyling profesional',
  });

  // Site Presentation Images state
  const [siteHeroBg, setSiteHeroBg] = useState(siteImages?.heroBgUrl || dataService.getSiteImages().heroBgUrl);
  const [siteAboutPhoto, setSiteAboutPhoto] = useState(siteImages?.aboutPhotoUrl || dataService.getSiteImages().aboutPhotoUrl);
  const [siteSalonBanner, setSiteSalonBanner] = useState(siteImages?.salonBannerUrl || dataService.getSiteImages().salonBannerUrl);
  const [siteImagesSuccessMsg, setSiteImagesSuccessMsg] = useState('');

  // Data states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [services, setServices] = useState<ServicePackage[]>([]);
  const [visitors, setVisitors] = useState<VisitorLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Search & Filters in Bookings
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all');
  const [bookingActionError, setBookingActionError] = useState<string>('');
  const [bookingActionSuccess, setBookingActionSuccess] = useState<string>('');
  const [exceptionReasonsByBooking, setExceptionReasonsByBooking] = useState<Record<string, string>>({});
  const [pendingDeleteBookingId, setPendingDeleteBookingId] = useState<string | null>(null);

  // New Media Upload State
  const [newMediaTitle, setNewMediaTitle] = useState('');
  const [newMediaCategory, setNewMediaCategory] = useState<MediaCategory>('fade');
  const [newMediaType, setNewMediaType] = useState<'photo' | 'video'>('photo');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaClient, setNewMediaClient] = useState('');
  const [newMediaDescription, setNewMediaDescription] = useState('');
  const [newMediaFeatured, setNewMediaFeatured] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaSuccessMessage, setMediaSuccessMessage] = useState('');

  // Edit / Replace Media State
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);

  // Supabase Configuration State
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [connStatus, setConnStatus] = useState<{ testing: boolean; result?: any }>({ testing: false });
  const [sqlCopied, setSqlCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Load all data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [b, r, g, s, v, a, remoteSettings] = await Promise.all([
        dataService.getBookings(),
        dataService.getReviews(false),
        dataService.getGalleryItems(),
        dataService.getServices(),
        dataService.getVisitorLogs(),
        dataService.getAddons(),
        dataService.fetchRemoteSettings(),
      ]);
      setBookings(b);
      setReviews(r);
      setGallery(g);
      setServices(s);
      setVisitors(v);
      setAddons(a);
      setGallerySettings(remoteSettings.gallerySettings);
      setServicesSettings(remoteSettings.servicesSettings);
      setSiteHeroBg(remoteSettings.siteImages.heroBgUrl);
      setSiteAboutPhoto(remoteSettings.siteImages.aboutPhotoUrl);
      setSiteSalonBanner(remoteSettings.siteImages.salonBannerUrl);
    } catch (err) {
      console.warn('Error loading admin data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      const creds = getSupabaseCredentials();
      setSupabaseUrl(creds.url);
      setSupabaseKey(creds.anonKey);
      if (isAdminLoggedIn) {
        loadData();
      }
    }
  }, [isOpen, isAdminLoggedIn, initialTab]);

  // When services are loaded and targetServiceId is set, open edit mode for that service
  useEffect(() => {
    if (isOpen && isAdminLoggedIn && targetServiceId && services.length > 0) {
      const match = services.find(s => s.id === targetServiceId);
      if (match) {
        setActiveTab('services');
        handleStartEditService(match);
      }
    }
  }, [isOpen, isAdminLoggedIn, targetServiceId, services]);

  // When addons are loaded and targetAddonId is set, open edit mode for that addon
  useEffect(() => {
    if (isOpen && isAdminLoggedIn && targetAddonId && addons.length > 0) {
      const match = addons.find(a => a.id === targetAddonId);
      if (match) {
        setActiveTab('addons');
        handleStartEditAddon(match);
      }
    }
  }, [isOpen, isAdminLoggedIn, targetAddonId, addons]);

  if (!isOpen) return null;

  // Handle Login via Supabase Auth
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const result = await authenticateAdmin(emailInput, passwordInput);
    if (result.success) {
      setIsAdminLoggedIn(true);
      if (initialTab) {
        setActiveTab(initialTab);
      }
      loadData();
    } else {
      setAuthError(result.error || 'Utilizator sau parolă incorectă. Vă rugăm să reîncercați.');
    }
  };

  const handleLogout = async () => {
    await signOutAdmin();
    setEmailInput('');
    setPasswordInput('');
    setAuthError('');
    setIsAdminLoggedIn(false);
  };

  // Change Booking Status
  const handleUpdateBookingStatus = async (id: string, status: BookingStatus, adminNotesOverride?: string) => {
    setBookingActionError('');
    setBookingActionSuccess('');
    try {
      const target = bookings.find(b => b.id === id);
      const typedReason = (exceptionReasonsByBooking[id] || '').trim();
      let effectiveAdminNotes = adminNotesOverride !== undefined ? adminNotesOverride : target?.adminNotes;

      if (typedReason.length >= 5) {
        const tag = formatAdminScheduleExceptionTag(typedReason);
        const existingClean = (effectiveAdminNotes || '').replace(/\[EXCEPTIE_PROGRAM:\s*[^\]]*\]/g, '').trim();
        effectiveAdminNotes = existingClean ? `${existingClean} ${tag}` : tag;
      }

      await dataService.updateBookingStatus(id, status, effectiveAdminNotes);
      setBookingActionSuccess(`Statusul programării (${target?.referenceCode || id}) a fost actualizat la „${status}”.`);
      setTimeout(() => setBookingActionSuccess(''), 4500);
      loadData();
      if (onDataModified) onDataModified();
    } catch (err: any) {
      setBookingActionError(
        err?.message || 'Nu s-a putut actualiza statusul programării. Verificați permisiunile Supabase și programul de lucru.'
      );
    }
  };

  // Delete Booking
  const handleDeleteBooking = async (id: string) => {
    setBookingActionError('');
    setBookingActionSuccess('');
    try {
      const target = bookings.find(b => b.id === id);
      await dataService.deleteBooking(id);
      setPendingDeleteBookingId(null);
      setBookingActionSuccess(`Programarea (${target?.referenceCode || id}) a fost ștearsă.`);
      setTimeout(() => setBookingActionSuccess(''), 4000);
      loadData();
      if (onDataModified) onDataModified();
    } catch (err: any) {
      setPendingDeleteBookingId(null);
      setBookingActionError(
        err?.message || 'Nu s-a putut șterge programarea din Supabase.'
      );
    }
  };

  // Approve / Delete Review
  const handleApproveReview = async (id: string) => {
    await dataService.approveReview(id, true);
    loadData();
    if (onDataModified) onDataModified();
  };

  const handleDeleteReview = async (id: string) => {
    if (confirm('Sigur doriți să ștergeți această recenzie?')) {
      await dataService.deleteReview(id);
      loadData();
      if (onDataModified) onDataModified();
    }
  };

  // --------------------------------------------------------------------------
  // SERVICES & PRODUCTS HANDLERS (PRICES, DESCRIPTIONS, IMAGES, TITLES)
  // --------------------------------------------------------------------------
  const handleStartEditService = (s: ServicePackage) => {
    setEditingService(s);
    setIsCreatingService(false);
    setServiceForm({
      title: s.title,
      category: s.category,
      price: s.price,
      duration: s.duration,
      durationMin: s.durationMin || 40,
      popular: Boolean(s.popular),
      description: s.description,
      imageUrl: s.imageUrl || '',
      featuresText: Array.isArray(s.features) ? s.features.join('\n') : '',
    });
  };

  const handleStartCreateService = () => {
    setEditingService(null);
    setIsCreatingService(true);
    setServiceForm({
      title: '',
      category: 'tuns',
      price: 70,
      duration: '40 minute',
      durationMin: 40,
      popular: false,
      description: '',
      imageUrl: '',
      featuresText: 'Consiliere stil și fizionomie\nSpălat dublu energizant\nStyling profesional',
    });
  };

  const handleCancelServiceForm = () => {
    setEditingService(null);
    setIsCreatingService(false);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.title.trim()) {
      alert('Vă rugăm să introduceți titlul serviciului / produsului.');
      return;
    }
    const featuresList = serviceForm.featuresText
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);

    try {
      if (editingService) {
        await dataService.updateService({
          ...editingService,
          title: serviceForm.title.trim(),
          category: serviceForm.category as any,
          price: Number(serviceForm.price),
          duration: serviceForm.duration.trim() || '40 minute',
          durationMin: Number(serviceForm.durationMin) || 40,
          popular: Boolean(serviceForm.popular),
          description: serviceForm.description.trim(),
          imageUrl: serviceForm.imageUrl.trim(),
          features: featuresList,
        });
        setServiceSuccessMsg(`Serviciul "${serviceForm.title}" a fost actualizat cu succes!`);
      } else {
        await dataService.addService({
          title: serviceForm.title.trim(),
          category: serviceForm.category as any,
          price: Number(serviceForm.price),
          duration: serviceForm.duration.trim() || '40 minute',
          durationMin: Number(serviceForm.durationMin) || 40,
          popular: Boolean(serviceForm.popular),
          description: serviceForm.description.trim(),
          imageUrl: serviceForm.imageUrl.trim(),
          features: featuresList,
        });
        setServiceSuccessMsg(`Produsul/serviciul "${serviceForm.title}" a fost adăugat cu succes!`);
      }

      setEditingService(null);
      setIsCreatingService(false);
      setTimeout(() => setServiceSuccessMsg(''), 4000);
      loadData();
      if (onDataModified) onDataModified();
    } catch (err) {
      alert('A apărut o problemă la salvarea serviciului.');
    }
  };

  const handleDeleteService = async (id: string, title: string) => {
    if (confirm(`Sigur doriți să ștergeți serviciul "${title}"?`)) {
      await dataService.deleteService(id);
      setServiceSuccessMsg(`Serviciul a fost șters.`);
      setTimeout(() => setServiceSuccessMsg(''), 4000);
      loadData();
      if (onDataModified) onDataModified();
    }
  };

  const handleQuickPriceChange = async (s: ServicePackage, newPrice: number) => {
    if (isNaN(newPrice) || newPrice < 0) return;
    await dataService.updateService({
      ...s,
      price: newPrice,
    });
    loadData();
    if (onDataModified) onDataModified();
  };

  const handleServiceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploadedUrl = await uploadMediaToSupabaseStorage(file, 'services');
    if (uploadedUrl) {
      setServiceForm(prev => ({
        ...prev,
        imageUrl: uploadedUrl,
      }));
    }
  };

  // --------------------------------------------------------------------------
  // TRATAMENTE OPȚIONALE / SERVICII EXTRA HANDLERS
  // --------------------------------------------------------------------------
  const handleStartCreateAddon = () => {
    setIsCreatingAddon(true);
    setEditingAddon(null);
    setAddonForm({
      id: '',
      name: '',
      priceRon: 25,
      durationMin: 10,
      description: '',
      imageUrl: '',
      popular: false,
    });
  };

  const handleStartEditAddon = (addon: ServiceAddon) => {
    setEditingAddon(addon);
    setIsCreatingAddon(false);
    setAddonForm({
      id: addon.id,
      name: addon.name,
      priceRon: addon.priceRon,
      durationMin: addon.durationMin,
      description: addon.description || '',
      imageUrl: addon.imageUrl || '',
      popular: !!addon.popular,
    });
  };

  const handleCancelAddonForm = () => {
    setIsCreatingAddon(false);
    setEditingAddon(null);
  };

  const handleAddonImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploadedUrl = await uploadMediaToSupabaseStorage(file, 'addons');
    if (uploadedUrl) {
      setAddonForm(prev => ({
        ...prev,
        imageUrl: uploadedUrl,
      }));
    }
  };

  const handleSaveAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addonForm.name.trim()) {
      alert('Vă rugăm să introduceți denumirea tratamentului.');
      return;
    }

    try {
      if (editingAddon) {
        await dataService.updateAddon({
          ...editingAddon,
          name: addonForm.name.trim(),
          priceRon: Number(addonForm.priceRon),
          durationMin: Number(addonForm.durationMin),
          description: addonForm.description.trim(),
          imageUrl: addonForm.imageUrl || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80',
          popular: addonForm.popular,
        });
        setAddonSuccessMsg(`Tratamentul "${addonForm.name}" a fost actualizat cu succes!`);
      } else {
        await dataService.addAddon({
          name: addonForm.name.trim(),
          priceRon: Number(addonForm.priceRon),
          durationMin: Number(addonForm.durationMin),
          description: addonForm.description.trim(),
          imageUrl: addonForm.imageUrl || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80',
          popular: addonForm.popular,
        });
        setAddonSuccessMsg(`Tratamentul nou "${addonForm.name}" a fost adăugat cu succes!`);
      }

      handleCancelAddonForm();
      setTimeout(() => setAddonSuccessMsg(''), 4000);
      loadData();
      if (onDataModified) onDataModified();
    } catch (err) {
      alert('A apărut o problemă la salvarea tratamentului.');
    }
  };

  const handleDeleteAddon = async (id: string, name: string) => {
    if (confirm(`Sigur doriți să ștergeți tratamentul "${name}"?`)) {
      await dataService.deleteAddon(id);
      setAddonSuccessMsg(`Tratamentul "${name}" a fost șters.`);
      setTimeout(() => setAddonSuccessMsg(''), 4000);
      loadData();
      if (onDataModified) onDataModified();
    }
  };

  const handleQuickAddonPriceChange = async (addon: ServiceAddon, newPrice: number) => {
    if (isNaN(newPrice) || newPrice < 0) return;
    await dataService.updateAddon({
      ...addon,
      priceRon: newPrice,
    });
    loadData();
    if (onDataModified) onDataModified();
  };

  const handleQuickAddonDurationChange = async (addon: ServiceAddon, newDur: number) => {
    if (isNaN(newDur) || newDur < 0) return;
    await dataService.updateAddon({
      ...addon,
      durationMin: newDur,
    });
    loadData();
    if (onDataModified) onDataModified();
  };

  // --------------------------------------------------------------------------
  // SECTION SETTINGS HANDLERS (GALERIE & SERVICII)
  // --------------------------------------------------------------------------
  const handleSaveGallerySettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated = await dataService.updateGallerySettings(gallerySettings);
    setGallerySettings(updated);
    setGallerySettingsMsg('Setările galeriei (titlu, subtitlu, etichete) au fost salvate în baza de date!');
    setTimeout(() => setGallerySettingsMsg(''), 4000);
    if (onDataModified) onDataModified();
  };

  const handleAddGalleryTag = async () => {
    if (!newGalleryTagLabel.trim()) return;
    const tagId = newGalleryTagLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const existing = gallerySettings.tags || [];
    if (existing.some(t => t.id === tagId)) {
      alert('Această etichetă există deja.');
      return;
    }
    const newTags = [...existing, { id: tagId, label: newGalleryTagLabel.trim() }];
    const updated = await dataService.updateGallerySettings({ tags: newTags });
    setGallerySettings(updated);
    setNewGalleryTagLabel('');
    setGallerySettingsMsg('Etichetă adăugată cu succes!');
    setTimeout(() => setGallerySettingsMsg(''), 3000);
    if (onDataModified) onDataModified();
  };

  const handleDeleteGalleryTag = async (tagId: string) => {
    if (tagId === 'all') {
      alert('Eticheta "Toate Lucrările" este obligatorie.');
      return;
    }
    const newTags = (gallerySettings.tags || []).filter(t => t.id !== tagId);
    const updated = await dataService.updateGallerySettings({ tags: newTags });
    setGallerySettings(updated);
    setGallerySettingsMsg('Etichetă ștearsă.');
    setTimeout(() => setGallerySettingsMsg(''), 3000);
    if (onDataModified) onDataModified();
  };

  const handleSaveServicesSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated = await dataService.updateServicesSettings(servicesSettings);
    setServicesSettings(updated);
    setServicesSettingsMsg('Setările secțiunii de servicii au fost salvate în baza de date!');
    setTimeout(() => setServicesSettingsMsg(''), 4000);
    if (onDataModified) onDataModified();
  };
  // SITE PRESENTATION IMAGES HANDLERS (HERO, ABOUT, SALON BANNER)
  // --------------------------------------------------------------------------
  const handleSiteImageUpload = async (field: 'hero' | 'about' | 'salon', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const val = await uploadMediaToSupabaseStorage(file, 'branding');
    if (val) {
      if (field === 'hero') setSiteHeroBg(val);
      if (field === 'about') setSiteAboutPhoto(val);
      if (field === 'salon') setSiteSalonBanner(val);
    }
  };

  const handleSaveAllSiteImages = async () => {
    const updated = await dataService.updateSiteImages({
      heroBgUrl: siteHeroBg,
      aboutPhotoUrl: siteAboutPhoto,
      salonBannerUrl: siteSalonBanner,
    });
    setSiteImagesSuccessMsg('Imaginile principale ale site-ului au fost salvate în Supabase și actualizate live!');
    setTimeout(() => setSiteImagesSuccessMsg(''), 4000);
    if (onSiteImagesUpdated) onSiteImagesUpdated(updated);
    if (onDataModified) onDataModified();
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditing = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video');
    const resultUrl = await uploadMediaToSupabaseStorage(file, 'gallery');
    if (!resultUrl) return;

    if (isEditing && editingItem) {
      setEditingItem({
        ...editingItem,
        mediaUrl: resultUrl,
        thumbnailUrl: isVideo ? editingItem.thumbnailUrl : resultUrl,
        mediaType: isVideo ? 'video' : 'photo',
      });
    } else {
      setNewMediaUrl(resultUrl);
      setNewMediaType(isVideo ? 'video' : 'photo');
      if (!newMediaTitle) {
        const nameClean = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setNewMediaTitle(nameClean);
      }
    }
  };

  // Add Gallery Item Submit
  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMediaUrl.trim() || !newMediaTitle.trim()) {
      alert('Vă rugăm să selectați un fișier foto/video sau să introduceți un URL valid și un titlu.');
      return;
    }

    setIsUploadingMedia(true);
    try {
      await dataService.addGalleryItem({
        title: newMediaTitle.trim(),
        category: newMediaCategory,
        mediaType: newMediaType,
        mediaUrl: newMediaUrl.trim(),
        thumbnailUrl: newMediaType === 'video'
          ? 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80'
          : newMediaUrl.trim(),
        aspectRatio: 'wide',
        featured: newMediaFeatured,
        orderIndex: gallery.length + 1,
        description: newMediaDescription.trim(),
        clientNames: newMediaClient.trim(),
        eventDate: new Date().toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' }),
      });

      setMediaSuccessMessage('Element adăugat cu succes în portofoliu!');
      setNewMediaTitle('');
      setNewMediaUrl('');
      setNewMediaClient('');
      setNewMediaDescription('');
      setNewMediaFeatured(false);
      setTimeout(() => setMediaSuccessMessage(''), 4000);
      loadData();
      if (onDataModified) onDataModified();
    } catch (err) {
      alert('A apărut o eroare la adăugarea fișierului.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Save changes to existing image / video
  const handleSaveEditedMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    await dataService.updateGalleryItem(editingItem);
    setEditingItem(null);
    setMediaSuccessMessage('Modificările imaginii au fost salvate cu succes!');
    setTimeout(() => setMediaSuccessMessage(''), 4000);
    loadData();
    if (onDataModified) onDataModified();
  };

  const handleDeleteMedia = async (id: string) => {
    if (confirm('Sigur doriți să ștergeți acest element din portofoliu?')) {
      await dataService.deleteGalleryItem(id);
      loadData();
      if (onDataModified) onDataModified();
    }
  };

  // Test Supabase Connection
  const handleTestConnection = async () => {
    setConnStatus({ testing: true });
    const result = await testSupabaseConnection(supabaseUrl, supabaseKey);
    setConnStatus({ testing: false, result });
  };

  // Save Supabase Credentials
  const handleSaveCredentials = () => {
    saveSupabaseCredentials(supabaseUrl, supabaseKey);
    handleTestConnection();
    loadData();
  };

  // Copy SQL Script
  const handleCopySQL = () => {
    const sql = generateSupabaseSQLSchema();
    navigator.clipboard.writeText(sql);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
  };

  // Sync Local Data to Supabase
  const handleSyncToSupabase = async () => {
    setSyncStatus('Sincronizare în curs...');
    const res = await dataService.syncLocalToSupabase();
    if (res.success) {
      setSyncStatus(
        `Sincronizare reușită! ${res.syncedServices || 0} servicii, ${res.syncedAddons || 0} tratamente extra, ${res.syncedBookings} programări, ${res.syncedReviews} recenzii, ${res.syncedGallery} lucrări și setările site-ului au fost sincronizate în Supabase.`
      );
    } else {
      setSyncStatus(`Eroare sincronizare: ${res.error}. Rulați scriptul SQL de mai jos în Supabase.`);
    }
    loadData();
    if (onDataModified) onDataModified();
    setTimeout(() => setSyncStatus(null), 8000);
  };

  // Filtered Bookings
  const filteredBookings = bookings.filter(b => {
    if (bookingStatusFilter !== 'all' && b.status !== bookingStatusFilter) return false;
    if (bookingSearch.trim()) {
      const q = bookingSearch.toLowerCase();
      return (
        b.clientName.toLowerCase().includes(q) ||
        b.clientPhone.toLowerCase().includes(q) ||
        b.referenceCode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalRevenueEstimated = bookings
    .filter(b => b.status === 'confirmat' || b.status === 'finalizat')
    .reduce((acc, curr) => acc + curr.estimatedTotal, 0);

  const pendingBookingsCount = bookings.filter(b => b.status === 'in_asteptare').length;
  const unapprovedReviewsCount = reviews.filter(r => !r.approved).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      <div
        className={`relative w-full ${
          isAdminLoggedIn ? 'max-w-7xl h-[92vh] max-h-[92vh]' : 'max-w-md sm:max-w-lg my-auto max-h-[92vh]'
        } bg-[#121418] border border-zinc-700/80 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-200 transition-all duration-300`}
      >
        {/* Header Bar */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-[#181a20] border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#d4af37] shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif-luxury text-base sm:text-lg text-white font-medium flex items-center gap-2 truncate">
                <span>{isAdminLoggedIn ? 'ROXANA TEUȘDE PFA • Panou Administrator' : 'Autentificare Administrator'}</span>
                {isAdminLoggedIn && (
                  <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    Sesiune Activă
                  </span>
                )}
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate">
                {isAdminLoggedIn
                  ? 'Gestiune prețuri, descrieri, foto-video salon și programări • CIF: 50143520'
                  : 'ROXANA TEUȘDE PFA • Str. Plopilor 28, Tileagd • CIF: 50143520'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {isAdminLoggedIn && (
              <button
                onClick={handleLogout}
                className="p-2 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Deconectare Admin"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Închide panou"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!isAdminLoggedIn ? (
          /* Authentication Screen - Perfectly Framed with internal scroll if needed */
          <div className="p-5 sm:p-7 overflow-y-auto max-h-[calc(92vh-70px)] space-y-4 text-center">
            <div className="space-y-1.5">
              <div className="w-13 h-13 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-[#d4af37] shadow-lg shadow-amber-950/20">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-serif-luxury text-xl sm:text-2xl text-white font-medium">
                Panou de Control Administrator
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Acces rezervat pentru Roxana Teușde. Modificați prețurile, descrierile, fotografiile și videoclipurile site-ului.
              </p>
            </div>

            {initialTab === 'services' && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-[#d4af37]/40 text-left flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300 leading-relaxed">
                  <span className="font-semibold text-white block">Modificare Servicii (Exclusiv din Panoul Administrator)</span>
                  Serviciile și tarifele pot fi modificate doar de către administrator. Introduceți datele de autentificare pentru acces la panoul de gestiune.
                </div>
              </div>
            )}

            {/* Supabase Status Banner & Quick Setup */}
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-left text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-zinc-300 font-medium">Baza de Date Supabase:</span>
                  {isSupabaseConfigured() ? (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Conectat
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-400 flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      Neconfigurat (.env lipsă)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickSupabaseConfig(!showQuickSupabaseConfig)}
                  className="text-[11px] text-[#d4af37] hover:underline cursor-pointer"
                >
                  {showQuickSupabaseConfig ? 'Închide setări' : isSupabaseConfigured() ? 'Modifică chei' : 'Configurează acum'}
                </button>
              </div>

              {(!isSupabaseConfigured() || showQuickSupabaseConfig) && (
                <div className="pt-2 border-t border-zinc-800 space-y-2.5">
                  <p className="text-[11px] text-zinc-400">
                    Introduceți URL-ul proiectului și cheia publică (Anon Key) din Supabase Dashboard → Settings → API:
                  </p>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">VITE_SUPABASE_URL</label>
                    <input
                      type="text"
                      value={supabaseUrl}
                      onChange={e => setSupabaseUrl(e.target.value)}
                      placeholder="https://xyzcompany.supabase.co"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs font-mono focus:border-[#d4af37] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">VITE_SUPABASE_ANON_KEY (sau sb_publishable_...)</label>
                    <input
                      type="password"
                      value={supabaseKey}
                      onChange={e => setSupabaseKey(e.target.value)}
                      placeholder="eyJhbGciOi... sau sb_publishable_..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs font-mono focus:border-[#d4af37] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        saveSupabaseCredentials(supabaseUrl, supabaseKey);
                        setQuickSaveMessage('Conexiunea a fost salvată în browser!');
                        setTimeout(() => setQuickSaveMessage(''), 3000);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-[#d4af37] border border-amber-500/30 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Salvează Conexiunea
                    </button>
                    {quickSaveMessage && (
                      <span className="text-[11px] text-emerald-400">{quickSaveMessage}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs space-y-2 text-left">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span className="font-semibold">{authError}</span>
                </div>
                {authError.includes('admin_users') && (
                  <div className="pt-2 border-t border-red-900/60 text-[11px] text-zinc-300 space-y-1.5">
                    <p className="text-amber-300 font-medium">Soluție rapidă în Supabase SQL Editor:</p>
                    <p className="text-zinc-400">
                      Rulați următoarea comandă în SQL Editor pentru a confirma emailul și a acorda rolul de administrator contului:
                    </p>
                    <pre className="p-2 rounded bg-black/60 font-mono text-[10px] text-amber-200/90 whitespace-pre-wrap select-all">
{`UPDATE auth.users SET email_confirmed_at = now() WHERE email = '${emailInput.trim() || 'emailul_tau@domeniu.ro'}';\nINSERT INTO public.admin_users (user_id, email, role, active)\nSELECT id, email, 'super_admin', TRUE FROM auth.users WHERE email = '${emailInput.trim() || 'emailul_tau@domeniu.ro'}'\nON CONFLICT (user_id) DO UPDATE SET active = TRUE, role = 'super_admin';`}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        const sql = `UPDATE auth.users SET email_confirmed_at = now() WHERE email = '${emailInput.trim() || 'emailul_tau@domeniu.ro'}';\nINSERT INTO public.admin_users (user_id, email, role, active)\nSELECT id, email, 'super_admin', TRUE FROM auth.users WHERE email = '${emailInput.trim() || 'emailul_tau@domeniu.ro'}'\nON CONFLICT (user_id) DO UPDATE SET active = TRUE, role = 'super_admin';`;
                        navigator.clipboard.writeText(sql);
                        setCopiedBootstrapSql(true);
                        setTimeout(() => setCopiedBootstrapSql(false), 3000);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 text-[#d4af37] border border-amber-500/30 text-[10px] font-semibold cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedBootstrapSql ? 'Copiat!' : 'Copiază comanda SQL'}</span>
                    </button>
                  </div>
                )}
                {authError.includes('incorectă') && (
                  <p className="text-[11px] text-zinc-400 pt-1 border-t border-red-900/60">
                    Sfat: Asigurați-vă că ați creat contul în <strong>Supabase Dashboard → Authentication → Users</strong> cu această adresă de email și parolă.
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 text-left pt-2">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Utilizator / Email Administrator
                </label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="Introduceți utilizatorul sau adresa de email"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-sm focus:border-[#d4af37] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Parolă Administrator</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPassword ? 'Ascunde' : 'Arată parola'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    placeholder="Introduceți parola"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-sm focus:border-[#d4af37] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                    title={showPassword ? 'Ascunde parola' : 'Arată parola'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8972f] hover:from-[#e0be4d] hover:to-[#c3a033] text-zinc-950 font-bold text-sm cursor-pointer shadow-lg shadow-amber-950/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                <span>Conectare în Panou</span>
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Dashboard Tabs */
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* Left Tab Navigation */}
            <div className="w-full md:w-64 bg-[#15171d] border-b md:border-b-0 md:border-r border-zinc-800 p-4 space-y-1 shrink-0 overflow-x-auto md:overflow-visible flex md:flex-col gap-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-[#d4af37] text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <span>Statistici Generale</span>
                <Activity className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setActiveTab('bookings')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'bookings'
                    ? 'bg-[#d4af37] text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>Programări Frizerie</span>
                  {pendingBookingsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {pendingBookingsCount}
                    </span>
                  )}
                </div>
                <Calendar className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setActiveTab('services')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'services'
                    ? 'bg-[#d4af37] text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>Prețuri &amp; Servicii</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-[#d4af37] text-[10px] font-bold">
                    {services.length}
                  </span>
                </div>
                <Tag className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setActiveTab('addons')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'addons'
                    ? 'bg-[#d4af37] text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>Tratamente Opționale</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-[#d4af37] text-[10px] font-bold">
                    {addons.length}
                  </span>
                </div>
                <Sparkles className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setActiveTab('siteMedia')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'siteMedia'
                    ? 'bg-[#d4af37] text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <span>Imagini Site &amp; Afiș</span>
                <Layers className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setActiveTab('gallery')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'gallery'
                    ? 'bg-[#d4af37] text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <span>Portofoliu Foto &amp; Video</span>
                <Upload className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setActiveTab('visitors')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'visitors'
                    ? 'bg-[#d4af37] text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>Cine a Vizitat Site-ul</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                    Live
                  </span>
                </div>
                <Globe className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setActiveTab('reviews')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'reviews'
                    ? 'bg-[#d4af37] text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>Recenzii Clienți</span>
                  {unapprovedReviewsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold">
                      {unapprovedReviewsCount} noi
                    </span>
                  )}
                </div>
                <Star className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setActiveTab('supabase')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'supabase'
                    ? 'bg-[#d4af37] text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <span>Supabase &amp; Securitate</span>
                <Database className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Right Tab Content Panel */}
            <div className="flex-1 p-6 overflow-y-auto max-h-[calc(92vh-80px)]">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-serif-luxury text-2xl text-white font-medium">
                      Panou de Control • Roxana Teusde PFA (Buie)
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Situația în timp real a programărilor de frizerie, portofoliului foto-video și vizitelor pe site.
                    </p>
                  </div>

                  {/* Stat Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-400 font-medium">Programări Totale</span>
                        <Calendar className="w-4 h-4 text-[#d4af37]" />
                      </div>
                      <div className="text-3xl font-serif-luxury font-bold text-white">{bookings.length}</div>
                      <div className="text-[11px] text-amber-400 mt-1">
                        {pendingBookingsCount} în așteptare de confirmare
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-400 font-medium">Încasări Servicii</span>
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-2xl font-serif-luxury font-bold text-emerald-400">
                        {formatRon(totalRevenueEstimated)}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        Programări confirmate &amp; finalizate
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-400 font-medium">Portofoliu Lucrări</span>
                        <Image className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="text-3xl font-serif-luxury font-bold text-white">{gallery.length}</div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        {gallery.filter(g => g.mediaType === 'video').length} clipuri video &amp; {gallery.filter(g => g.mediaType === 'photo').length} fotografii
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-400 font-medium">Vizitatori Monitorizați</span>
                        <Globe className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="text-3xl font-serif-luxury font-bold text-white">
                        {visitors.length}
                      </div>
                      <div className="text-[11px] text-emerald-400 mt-1">
                        Urmărite în timp real cu detalii dispozitiv
                      </div>
                    </div>
                  </div>

                  {/* Official Working Schedule Card in Admin Overview */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-[#d4af37]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm">
                          Program Oficial de Funcționare • Roxana Teușde PFA
                        </div>
                        <div className="text-zinc-400 mt-0.5">
                          Luni și Duminică programările sunt blocate atât pentru clienți, cât și pentru administrator (cu excepția cazurilor marcate explicit cu <code className="text-amber-300">[EXCEPTIE_PROGRAM]</code> înregistrate în audit).
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 font-semibold">
                        Luni: ÎNCHIS
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                        Marți – Vineri: 09:00–16:00
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                        Sâmbătă: 09:00–13:00
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 font-semibold">
                        Duminică: ÎNCHIS
                      </span>
                    </div>
                  </div>

                  {/* Recent Bookings preview */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                        Programări Recente la Frizerie
                      </h4>
                      <button
                        onClick={() => setActiveTab('bookings')}
                        className="text-xs text-[#d4af37] hover:underline"
                      >
                        Vezi toate ({bookings.length}) →
                      </button>
                    </div>

                    <div className="space-y-2">
                      {bookings.slice(0, 3).map(b => (
                        <div
                          key={b.id}
                          className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-white text-sm">{b.clientName}</div>
                            <div className="text-zinc-400">
                              {b.serviceName} • {formatRomanianDate(b.eventDate)} la ora <strong className="text-amber-300">{b.eventTime}</strong>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-[#d4af37]">{formatRon(b.estimatedTotal)}</span>
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                b.status === 'confirmat'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : b.status === 'finalizat'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : b.status === 'anulat'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {b.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BOOKINGS */}
              {activeTab === 'bookings' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-serif-luxury text-2xl text-white font-medium">
                        Gestiune Programări Frizerie &amp; Barbershop
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Confirmă orarul, schimbă statusul sau trimite mesaj pe WhatsApp clientului.
                      </p>
                    </div>

                    <button
                      onClick={loadData}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 flex items-center gap-1.5 self-start cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reîmprospătează</span>
                    </button>
                  </div>

                  {/* Schedule Policy Banner in Bookings Tab */}
                  <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#d4af37] shrink-0" />
                      <span>
                        <strong>Orar Validat Server-Side:</strong> Luni: <span className="text-red-400 font-semibold">ÎNCHIS</span> • Marți–Vineri: <span className="text-emerald-400 font-semibold">09:00–16:00</span> • Sâmbătă: <span className="text-amber-300 font-semibold">09:00–13:00</span> • Duminică: <span className="text-red-400 font-semibold">ÎNCHIS</span>
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400">
                      Excepție administrativă auditată: <code className="text-amber-300">[EXCEPTIE_PROGRAM: motiv]</code>
                    </span>
                  </div>

                  {bookingActionError && (
                    <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span>{bookingActionError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBookingActionError('')}
                        className="text-red-300 hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {bookingActionSuccess && (
                    <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{bookingActionSuccess}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBookingActionSuccess('')}
                        className="text-emerald-300 hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Filter and Search Bar */}
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={bookingSearch}
                        onChange={e => setBookingSearch(e.target.value)}
                        placeholder="Caută după nume client, telefon sau cod..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:border-[#d4af37] focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
                      <select
                        value={bookingStatusFilter}
                        onChange={e => setBookingStatusFilter(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:border-[#d4af37] focus:outline-none"
                      >
                        <option value="all">Toate Stările</option>
                        <option value="in_asteptare">În Așteptare</option>
                        <option value="confirmat">Confirmat</option>
                        <option value="finalizat">Finalizat</option>
                        <option value="anulat">Anulat</option>
                      </select>
                    </div>
                  </div>

                  {/* Bookings Table / Cards */}
                  <div className="space-y-4">
                    {filteredBookings.map(b => {
                      const matchedSvc = services.find(s => s.id === b.serviceId);
                      const est = calculateBarberEstimate(
                        matchedSvc ? matchedSvc.price : b.estimatedTotal || 70,
                        matchedSvc?.durationMin || 40,
                        b.addons || {},
                        addons
                      );
                      const publicScheduleCheck = validateBookingScheduleAndDuration({
                        eventDate: b.eventDate,
                        eventTime: b.eventTime,
                        durationMin: est.totalDurationMin,
                        isAdmin: true,
                        adminNotes: '',
                      });
                      const requiresScheduleException = !publicScheduleCheck.valid;
                      const recordedExceptionReason = extractAdminScheduleExceptionReason(b.adminNotes);

                      return (
                        <div
                          key={b.id}
                          className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4 text-xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                            <div>
                              <span className="font-mono text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 mr-2">
                                {b.referenceCode}
                              </span>
                              <span className="text-zinc-500">
                                Înregistrat: {new Date(b.createdAt).toLocaleDateString('ro-RO')}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-zinc-400">Schimbă Status:</span>
                              {(['in_asteptare', 'confirmat', 'finalizat', 'anulat'] as BookingStatus[]).map(st => (
                                <button
                                  key={st}
                                  onClick={() => handleUpdateBookingStatus(b.id, st)}
                                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                                    b.status === st
                                      ? st === 'confirmat'
                                        ? 'bg-emerald-500 text-zinc-950'
                                        : st === 'finalizat'
                                        ? 'bg-blue-500 text-white'
                                        : st === 'anulat'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-amber-500 text-zinc-950'
                                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Booking Details Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <div className="font-semibold text-white text-sm mb-1">{b.clientName}</div>
                              <div className="text-zinc-300 flex items-center gap-1.5 mb-1">
                                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                                <a href={`tel:${b.clientPhone}`} className="hover:underline">{b.clientPhone}</a>
                              </div>
                              <div className="text-zinc-400 flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-zinc-500" />
                                <span>{b.clientEmail}</span>
                              </div>
                            </div>

                            <div>
                              <div className="font-medium text-white mb-0.5">{b.serviceName}</div>
                              <div className="text-zinc-300">
                                Data: <strong className="text-amber-300">{formatRomanianDate(b.eventDate)}</strong> la ora <strong className="text-amber-300">{b.eventTime}</strong>
                              </div>
                              <div className="text-zinc-400">
                                Durată estimată: ~{est.totalDurationMin} min • Frizer: {b.barberName || 'Roxana Teușde (Buie)'}
                              </div>
                            </div>

                            <div className="text-right sm:text-right">
                              <div className="text-zinc-400">Total Programare:</div>
                              <div className="text-base font-bold text-white font-serif-luxury">
                                {formatRon(b.estimatedTotal)}
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                Plată la salon
                              </div>
                            </div>
                          </div>

                          {b.notes && (
                            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-zinc-300">
                              <span className="font-semibold text-zinc-400 block mb-0.5">Mențiuni client:</span>
                              {b.notes}
                            </div>
                          )}

                          {(requiresScheduleException || recordedExceptionReason) && (
                            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                                  <Shield className="w-3.5 h-3.5" />
                                  <span>Excepție Administrativă de Program (Audit Obligatoriu)</span>
                                </span>
                                {recordedExceptionReason && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                    Înregistrat: {recordedExceptionReason}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <input
                                  type="text"
                                  value={exceptionReasonsByBooking[b.id] ?? recordedExceptionReason ?? ''}
                                  onChange={e =>
                                    setExceptionReasonsByBooking(prev => ({
                                      ...prev,
                                      [b.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Motiv obligatoriu excepție (min. 5 caractere, ex: Programare specială aprobată)"
                                  className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-950 border border-amber-500/40 text-xs text-white focus:border-[#d4af37] focus:outline-none"
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                            <a
                              href={`https://wa.me/${b.clientPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                `Salut, ${b.clientName}! Suntem de la Atelierul Roxana Teusde (Buie). Confirmăm programarea ta pentru data de ${formatRomanianDate(
                                  b.eventDate
                                )} la ora ${b.eventTime} (${b.serviceName}). Te așteptăm cu drag!`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Trimite Confirmare pe WhatsApp</span>
                            </a>

                            {pendingDeleteBookingId === b.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-red-300 font-medium">Confirmați ștergerea?</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBooking(b.id)}
                                  className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Da, Șterge
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingDeleteBookingId(null)}
                                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] cursor-pointer"
                                >
                                  Anulează
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPendingDeleteBookingId(b.id)}
                                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Șterge</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB: SERVICES & PRODUCTS (PRICES, DESCRIPTIONS, IMAGES, TITLES) */}
              {activeTab === 'services' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-serif-luxury text-2xl text-white font-medium flex items-center gap-2">
                        <span>Gestiune Prețuri, Servicii &amp; Produse</span>
                        <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-[#d4af37] border border-amber-500/30">
                          {services.length} Servicii &amp; Produse
                        </span>
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Modifică prețurile în RON, titlul, descrierea, fotografiile de prezentare și lista de beneficii pentru fiecare serviciu sau produs.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleStartCreateService}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8972f] hover:from-[#e0be4d] hover:to-[#c3a033] text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Adaugă Serviciu / Produs Nou</span>
                      </button>
                    </div>
                  </div>

                  {serviceSuccessMsg && (
                    <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{serviceSuccessMsg}</span>
                    </div>
                  )}

                  {/* Section Title, Subtitle & Categories Management */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/90 border border-[#d4af37]/40 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                      <div>
                        <h4 className="font-serif-luxury text-lg text-white font-medium flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-[#d4af37]" />
                          <span>Setări Titlu &amp; Categorii Meniu Servicii</span>
                        </h4>
                        <p className="text-xs text-zinc-400">
                          Aici poți schimba titlul secțiunii de servicii, subtitlul și etichetele/categoriile meniului.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveServicesSettings}
                        className="px-4 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e0bd47] text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md self-start sm:self-auto shrink-0"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Salvează Titlu &amp; Categorii</span>
                      </button>
                    </div>

                    {servicesSettingsMsg && (
                      <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{servicesSettingsMsg}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                      {/* Badge Text */}
                      <div className="md:col-span-4">
                        <label className="block text-zinc-300 font-semibold mb-1">
                          Text Ecuson / Badge Secțiune
                        </label>
                        <input
                          type="text"
                          value={servicesSettings.badgeText || ''}
                          onChange={e => setServicesSettings(prev => ({ ...prev, badgeText: e.target.value }))}
                          placeholder="Meniu Servicii & Tarife Frizerie"
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>

                      {/* Main Title */}
                      <div className="md:col-span-8">
                        <label className="block text-zinc-300 font-semibold mb-1">
                          Titlu Principal Secțiune Servicii *
                        </label>
                        <input
                          type="text"
                          value={servicesSettings.title}
                          onChange={e => setServicesSettings(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Îngrijire Masculină Fără Compromis"
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-medium focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>

                      {/* Subtitle */}
                      <div className="md:col-span-12">
                        <label className="block text-zinc-300 font-semibold mb-1">
                          Subtitlu / Descriere Secțiune Servicii
                        </label>
                        <textarea
                          rows={2}
                          value={servicesSettings.subtitle}
                          onChange={e => setServicesSettings(prev => ({ ...prev, subtitle: e.target.value }))}
                          placeholder="Fiecare serviciu este realizat cu atenție, pasiune și profesionalism..."
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* CREATE OR EDIT SERVICE FORM */}
                  {(editingService || isCreatingService) && (
                    <div className="p-6 rounded-2xl bg-gradient-to-b from-zinc-900 via-zinc-900 to-[#161820] border-2 border-[#d4af37] space-y-4 text-xs animate-in zoom-in-95 shadow-2xl">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <div className="font-semibold text-[#d4af37] text-sm flex items-center gap-2">
                          <Edit2 className="w-4 h-4" />
                          <span>
                            {editingService
                              ? `Editează Serviciul / Produsul: "${editingService.title}"`
                              : 'Adaugă un Serviciu sau Produs Nou'}
                          </span>
                        </div>
                        <button
                          onClick={handleCancelServiceForm}
                          className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form onSubmit={handleSaveService} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="sm:col-span-2">
                            <label className="font-semibold text-zinc-300 block mb-1">
                              Titlu Serviciu sau Produs *
                            </label>
                            <input
                              type="text"
                              required
                              value={serviceForm.title}
                              onChange={e => setServiceForm({ ...serviceForm, title: e.target.value })}
                              placeholder="ex: Tuns Modern Fade, Pachet VIP, Ceară Mată Reuzel..."
                              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-zinc-300 block mb-1">
                              Preț Oficial (RON) *
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                required
                                min={0}
                                step={1}
                                value={serviceForm.price}
                                onChange={e => setServiceForm({ ...serviceForm, price: Number(e.target.value) })}
                                className="w-full pl-3 pr-10 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs focus:border-[#d4af37] focus:outline-none"
                              />
                              <span className="absolute right-3 top-2 text-xs font-bold text-[#d4af37]">RON</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="font-semibold text-zinc-300 block mb-1">
                              Categorie Serviciu / Produs
                            </label>
                            <select
                              value={serviceForm.category}
                              onChange={e => setServiceForm({ ...serviceForm, category: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#d4af37] focus:outline-none"
                            >
                              {(servicesSettings.tags || []).filter(t => t.id !== 'all').map(tag => (
                                <option key={tag.id} value={tag.id}>{tag.label}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="font-semibold text-zinc-300 block mb-1">
                              Durată Afișată (ex: 40 minute)
                            </label>
                            <input
                              type="text"
                              value={serviceForm.duration}
                              onChange={e => setServiceForm({ ...serviceForm, duration: e.target.value })}
                              placeholder="ex: 40 minute, 60 minute, Produs Salon"
                              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center pt-5">
                            <label className="flex items-center gap-2 cursor-pointer text-white">
                              <input
                                type="checkbox"
                                checked={serviceForm.popular}
                                onChange={e => setServiceForm({ ...serviceForm, popular: e.target.checked })}
                                className="rounded text-[#d4af37]"
                              />
                              <span className="font-medium text-xs">Marcat ca Cel Mai Recomandat</span>
                            </label>
                          </div>
                        </div>

                        {/* Presentation Image of Service / Product */}
                        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-3">
                          <label className="font-semibold text-[#d4af37] block text-xs">
                            Imagine de Prezentare Serviciu / Produs
                          </label>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <span className="text-[11px] text-zinc-400 block mb-1">
                                Opțiunea 1: Încarcă din Calculator (JPG/PNG)
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleServiceImageUpload}
                                className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#d4af37] file:text-zinc-950 cursor-pointer"
                              />
                            </div>

                            <div>
                              <span className="text-[11px] text-zinc-400 block mb-1">
                                Opțiunea 2: Sau introdu URL Direct imagine
                              </span>
                              <input
                                type="url"
                                value={serviceForm.imageUrl}
                                onChange={e => setServiceForm({ ...serviceForm, imageUrl: e.target.value })}
                                placeholder="https://... sau /assets/aistudio/..."
                                className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-[#d4af37] focus:outline-none"
                              />
                            </div>
                          </div>

                          {serviceForm.imageUrl && (
                            <div className="flex items-center gap-3 pt-2">
                              <img
                                src={serviceForm.imageUrl}
                                alt="Previzualizare"
                                className="w-20 h-14 object-cover rounded-lg border border-zinc-700"
                              />
                              <div className="text-[11px] text-zinc-400 truncate">
                                Previzualizare activă: <span className="text-zinc-300 font-mono">{serviceForm.imageUrl.substring(0, 60)}...</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <label className="font-semibold text-zinc-300 block mb-1">
                            Descriere Serviciu / Produs *
                          </label>
                          <textarea
                            rows={3}
                            required
                            value={serviceForm.description}
                            onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })}
                            placeholder="Descrie tehnica folosită, beneficiile pentru client și stilul final..."
                            className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#d4af37] focus:outline-none leading-relaxed"
                          />
                        </div>

                        {/* Features */}
                        <div>
                          <label className="font-semibold text-zinc-300 block mb-1">
                            Ce include serviciul / Caracteristici (Scrie câte un beneficiu pe fiecare rând)
                          </label>
                          <textarea
                            rows={4}
                            value={serviceForm.featuresText}
                            onChange={e => setServiceForm({ ...serviceForm, featuresText: e.target.value })}
                            placeholder="Consiliere stil și fizionomie&#10;Spălat dublu cu șampon mentolat&#10;Contur la briciul japonez&#10;Styling cu ceară mată"
                            className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#d4af37] focus:outline-none font-mono text-[11px] leading-relaxed"
                          />
                          <p className="text-[11px] text-zinc-500 mt-1">
                            * Fiecare linie va apărea cu bifă aurie pe cardul serviciului.
                          </p>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            type="submit"
                            className="px-6 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e0bd47] text-zinc-950 font-bold text-xs cursor-pointer shadow-md flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            <span>{editingService ? 'Salvează Modificările' : 'Publică Serviciul / Produsul'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelServiceForm}
                            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
                          >
                            Renunță
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Filter and Search Bar */}
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={servicesSearch}
                        onChange={e => setServicesSearch(e.target.value)}
                        placeholder="Caută după titlu, preț sau descriere..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:border-[#d4af37] focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
                      <select
                        value={servicesCategoryFilter}
                        onChange={e => setServicesCategoryFilter(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:border-[#d4af37] focus:outline-none"
                      >
                        <option value="all">Toate Categoriile</option>
                        {(servicesSettings.tags || []).filter(t => t.id !== 'all').map(tag => (
                          <option key={tag.id} value={tag.id}>{tag.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Services Grid with Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services
                      .filter(s => {
                        if (servicesCategoryFilter !== 'all' && s.category !== servicesCategoryFilter) return false;
                        if (servicesSearch.trim()) {
                          const q = servicesSearch.toLowerCase();
                          return s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || String(s.price).includes(q);
                        }
                        return true;
                      })
                      .map(s => (
                        <div
                          key={s.id}
                          className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3 text-xs flex flex-col justify-between hover:border-zinc-700 transition-colors"
                        >
                          <div>
                            {/* Card Top: Image + Info */}
                            <div className="flex items-start gap-3">
                              {s.imageUrl ? (
                                <img
                                  src={s.imageUrl}
                                  alt={s.title}
                                  className="w-20 h-20 object-cover rounded-xl border border-zinc-700 shrink-0"
                                />
                              ) : (
                                <div className="w-20 h-20 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-600 shrink-0">
                                  <Tag className="w-6 h-6 text-[#d4af37]" />
                                </div>
                              )}
                              <div className="flex-1 truncate">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] uppercase font-semibold text-amber-300">
                                    {s.category}
                                  </span>
                                  {s.popular && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-[#d4af37] text-zinc-950 text-[9px] font-bold">
                                      ★ Recomandat
                                    </span>
                                  )}
                                </div>
                                <h4 className="font-semibold text-white text-sm truncate">{s.title}</h4>
                                <div className="text-zinc-400 text-[11px] flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3 text-[#d4af37]" />
                                  <span>{s.duration}</span>
                                </div>
                              </div>
                            </div>

                            {/* Description preview */}
                            <p className="text-zinc-300 text-xs mt-3 line-clamp-2 leading-relaxed">
                              {s.description}
                            </p>

                            {/* Features preview */}
                            {s.features && s.features.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {s.features.slice(0, 2).map((f, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 text-[11px] text-zinc-400 truncate">
                                    <Check className="w-3 h-3 text-[#d4af37] shrink-0" />
                                    <span className="truncate">{f}</span>
                                  </div>
                                ))}
                                {s.features.length > 2 && (
                                  <span className="text-[10px] text-zinc-500 block">+{s.features.length - 2} alte beneficii</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Price & Action Row */}
                          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-3">
                            <div>
                              <span className="text-[10px] text-zinc-500 block uppercase">Preț Curent (RON):</span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  defaultValue={s.price}
                                  onBlur={e => handleQuickPriceChange(s, Number(e.target.value))}
                                  className="w-16 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[#d4af37] font-bold text-sm text-center focus:border-[#d4af37] focus:outline-none"
                                  title="Schimbă prețul direct și apasă afară pentru salvare"
                                />
                                <span className="font-bold text-white text-sm">RON</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleStartEditService(s)}
                                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-[#d4af37]" />
                                <span>Editează</span>
                              </button>
                              <button
                                onClick={() => handleDeleteService(s.id, s.title)}
                                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                                title="Șterge serviciul"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* TAB: TRATAMENTE OPȚIONALE / SERVICII EXTRA */}
              {activeTab === 'addons' && (
                <div className="space-y-6">
                  {/* Header & Add Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-serif-luxury text-2xl text-white font-medium flex items-center gap-2">
                        <span>Tratamente Opționale &amp; Servicii Extra</span>
                        <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-[#d4af37] border border-amber-500/30">
                          {addons.length} Active
                        </span>
                      </h3>
                      <p className="text-xs text-zinc-400 max-w-2xl">
                        Aici poți modifica <strong>denumirea</strong>, <strong>banii (preț RON)</strong>, <strong>timpul (durată minute)</strong>, <strong>imaginea</strong> și descrierea pentru tratamentele opționale (prosop cald, spălat dublu, mască neagră, camuflaj barbă etc.). Se actualizează instant pe site, în calculator și în formularul de programare.
                      </p>
                    </div>

                    {!isCreatingAddon && !editingAddon && (
                      <button
                        onClick={handleStartCreateAddon}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8972f] hover:from-[#e0be4d] hover:to-[#c3a033] text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-950/20 cursor-pointer self-start sm:self-auto shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Adaugă Tratament Nou</span>
                      </button>
                    )}
                  </div>

                  {addonSuccessMsg && (
                    <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{addonSuccessMsg}</span>
                    </div>
                  )}

                  {/* Add / Edit Form */}
                  {(isCreatingAddon || editingAddon) && (
                    <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/90 border border-[#d4af37]/40 shadow-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <h4 className="font-serif-luxury text-lg text-white font-medium flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#d4af37]" />
                          <span>{editingAddon ? `Editează: ${editingAddon.name}` : 'Adaugă Tratament Opțional Nou'}</span>
                        </h4>
                        <button
                          onClick={handleCancelAddonForm}
                          className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                        >
                          Închide
                        </button>
                      </div>

                      <form onSubmit={handleSaveAddon} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* Name / Denumire */}
                          <div className="md:col-span-6">
                            <label className="block text-zinc-300 font-semibold mb-1">
                              Denumire Tratament / Serviciu Extra *
                            </label>
                            <input
                              type="text"
                              required
                              value={addonForm.name}
                              onChange={e => setAddonForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="ex: Tratament cu prosop cald și uleiuri esențiale"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>

                          {/* Price / Bani (RON) */}
                          <div className="md:col-span-3">
                            <label className="block text-zinc-300 font-semibold mb-1">
                              Preț Suplimentar (RON) *
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                required
                                min="0"
                                step="1"
                                value={addonForm.priceRon}
                                onChange={e => setAddonForm(prev => ({ ...prev, priceRon: Number(e.target.value) }))}
                                className="w-full px-3.5 py-2.5 pr-12 rounded-xl bg-zinc-950 border border-zinc-700 text-amber-300 font-bold focus:border-[#d4af37] focus:outline-none"
                              />
                              <span className="absolute right-3.5 top-2.5 text-zinc-400 font-semibold text-xs">RON</span>
                            </div>
                          </div>

                          {/* Duration / Timp (Min) */}
                          <div className="md:col-span-3">
                            <label className="block text-zinc-300 font-semibold mb-1">
                              Timp / Durată Adăugată (Minute) *
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                required
                                min="0"
                                step="5"
                                value={addonForm.durationMin}
                                onChange={e => setAddonForm(prev => ({ ...prev, durationMin: Number(e.target.value) }))}
                                className="w-full px-3.5 py-2.5 pr-12 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold focus:border-[#d4af37] focus:outline-none"
                              />
                              <span className="absolute right-3.5 top-2.5 text-zinc-400 font-semibold text-xs">min</span>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-zinc-300 font-semibold mb-1">
                            Descriere Tratament
                          </label>
                          <textarea
                            rows={2}
                            value={addonForm.description}
                            onChange={e => setAddonForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="ex: Prosop fierbinte infuzat cu ulei de eucalipt pentru relaxarea musculaturii și deschiderea porilor..."
                            className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                          />
                        </div>

                        {/* Image: Upload or URL */}
                        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-3">
                          <label className="block text-zinc-300 font-semibold">
                            Imagine Prezentare Tratament
                          </label>
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                            <div className="md:col-span-3">
                              {addonForm.imageUrl ? (
                                <img
                                  src={addonForm.imageUrl}
                                  alt="Preview"
                                  className="w-full h-24 object-cover rounded-xl border border-zinc-700"
                                />
                              ) : (
                                <div className="w-full h-24 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
                                  <Sparkles className="w-6 h-6 text-zinc-600" />
                                </div>
                              )}
                            </div>
                            <div className="md:col-span-9 space-y-2">
                              <div>
                                <span className="text-[11px] text-zinc-400 block mb-1">Încarcă poză din calculator:</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleAddonImageUpload}
                                  className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#d4af37] file:text-zinc-950 cursor-pointer"
                                />
                              </div>
                              <div>
                                <span className="text-[11px] text-zinc-400 block mb-1">Sau URL imagine direct:</span>
                                <input
                                  type="text"
                                  value={addonForm.imageUrl}
                                  onChange={e => setAddonForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                                  placeholder="https://..."
                                  className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs font-mono focus:border-[#d4af37] focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Popular checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer text-white">
                          <input
                            type="checkbox"
                            checked={addonForm.popular}
                            onChange={e => setAddonForm(prev => ({ ...prev, popular: e.target.checked }))}
                            className="rounded"
                          />
                          <span>Marchează ca Recomandat / Cel mai căutat tratament</span>
                        </label>

                        {/* Action buttons */}
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            type="submit"
                            className="px-6 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e0bd47] text-zinc-950 font-bold text-xs cursor-pointer shadow-md flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            <span>{editingAddon ? 'Salvează Modificările Tratamentului' : 'Adaugă Tratament'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelAddonForm}
                            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
                          >
                            Renunță
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Addons List Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addons.map(addon => (
                      <div
                        key={addon.id}
                        className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2.5">
                          {/* Image & Header */}
                          <div className="flex items-start gap-3">
                            {addon.imageUrl ? (
                              <img
                                src={addon.imageUrl}
                                alt={addon.name}
                                className="w-16 h-16 object-cover rounded-xl border border-zinc-700 shrink-0"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-[#d4af37] shrink-0">
                                <Sparkles className="w-6 h-6" />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] font-semibold text-amber-300">
                                  Tratament Opțional
                                </span>
                                {addon.popular && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-[#d4af37] text-zinc-950 text-[9px] font-bold">
                                    ★ Popular
                                  </span>
                                )}
                              </div>
                              <h4 className="font-semibold text-white text-sm leading-snug">{addon.name}</h4>
                            </div>
                          </div>

                          {/* Description */}
                          {addon.description && (
                            <p className="text-zinc-300 text-xs line-clamp-2 leading-relaxed">
                              {addon.description}
                            </p>
                          )}

                          {/* Quick inline editors for Price (Bani) and Duration (Timp) */}
                          <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
                                Bani / Preț:
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  value={addon.priceRon}
                                  onChange={e => handleQuickAddonPriceChange(addon, Number(e.target.value))}
                                  className="w-20 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-amber-300 font-bold text-xs focus:border-[#d4af37] focus:outline-none"
                                />
                                <span className="text-xs text-zinc-400 font-semibold">RON</span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
                                Timp / Durată:
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="5"
                                  value={addon.durationMin}
                                  onChange={e => handleQuickAddonDurationChange(addon, Number(e.target.value))}
                                  className="w-20 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-white font-bold text-xs focus:border-[#d4af37] focus:outline-none"
                                />
                                <span className="text-xs text-zinc-400 font-semibold">min</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2.5">
                          <span className="text-[11px] text-zinc-500 font-mono">
                            ID: {addon.id}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStartEditAddon(addon)}
                              className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Editează Detaliat</span>
                            </button>
                            <button
                              onClick={() => handleDeleteAddon(addon.id, addon.name)}
                              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                              title="Șterge tratamentul"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: SITE PRESENTATION IMAGES (HERO, ABOUT, SALON BANNER) */}
              {activeTab === 'siteMedia' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-serif-luxury text-2xl text-white font-medium flex items-center gap-2">
                        <span>Imagini Principale ale Site-ului &amp; Branding</span>
                        <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Live Site
                        </span>
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Înlocuiește oricare dintre imaginile principale ale site-ului (fundal Hero, poza Roxanei de la Despre mine sau afișul salonului) prin încărcare directă sau URL.
                      </p>
                    </div>

                    <button
                      onClick={handleSaveAllSiteImages}
                      className="px-5 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e0bd47] text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer self-start"
                    >
                      <Save className="w-4 h-4" />
                      <span>Salvează Toate Imaginile</span>
                    </button>
                  </div>

                  {siteImagesSuccessMsg && (
                    <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{siteImagesSuccessMsg}</span>
                    </div>
                  )}

                  {/* 3 Main Images Cards */}
                  <div className="space-y-4">
                    {/* 1. Hero Background */}
                    <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#d4af37]" />
                          <span>1. Imagine Fundal Hero (Pagina Principală)</span>
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">Ecranul de sus</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="md:col-span-4 relative rounded-xl overflow-hidden border border-zinc-700 h-28 bg-zinc-950">
                          <img
                            src={siteHeroBg}
                            alt="Hero Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="md:col-span-8 space-y-2.5">
                          <div>
                            <span className="text-[11px] text-zinc-400 block mb-1">Încarcă din Calculator:</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => handleSiteImageUpload('hero', e)}
                              className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#d4af37] file:text-zinc-950 cursor-pointer"
                            />
                          </div>

                          <div>
                            <span className="text-[11px] text-zinc-400 block mb-1">Sau URL imagine direct:</span>
                            <input
                              type="text"
                              value={siteHeroBg}
                              onChange={e => setSiteHeroBg(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono text-xs focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. About Roxana Photo */}
                    <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm flex items-center gap-2">
                          <Image className="w-4 h-4 text-[#d4af37]" />
                          <span>2. Fotografie Roxana Teușde (Secțiunea Despre Mine)</span>
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">Portret Master Barber</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="md:col-span-4 relative rounded-xl overflow-hidden border border-zinc-700 h-28 bg-zinc-950">
                          <img
                            src={siteAboutPhoto}
                            alt="About Roxana Preview"
                            className="w-full h-full object-cover object-top"
                          />
                        </div>

                        <div className="md:col-span-8 space-y-2.5">
                          <div>
                            <span className="text-[11px] text-zinc-400 block mb-1">Încarcă din Calculator:</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => handleSiteImageUpload('about', e)}
                              className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#d4af37] file:text-zinc-950 cursor-pointer"
                            />
                          </div>

                          <div>
                            <span className="text-[11px] text-zinc-400 block mb-1">Sau URL imagine direct:</span>
                            <input
                              type="text"
                              value={siteAboutPhoto}
                              onChange={e => setSiteAboutPhoto(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono text-xs focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Salon Banner */}
                    <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-[#d4af37]" />
                          <span>3. Afiș &amp; Banner Prezentare Salon Tileagd</span>
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">Afiș Promoțional</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="md:col-span-4 relative rounded-xl overflow-hidden border border-zinc-700 h-28 bg-zinc-950">
                          <img
                            src={siteSalonBanner}
                            alt="Salon Banner Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="md:col-span-8 space-y-2.5">
                          <div>
                            <span className="text-[11px] text-zinc-400 block mb-1">Încarcă din Calculator:</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => handleSiteImageUpload('salon', e)}
                              className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#d4af37] file:text-zinc-950 cursor-pointer"
                            />
                          </div>

                          <div>
                            <span className="text-[11px] text-zinc-400 block mb-1">Sau URL imagine direct:</span>
                            <input
                              type="text"
                              value={siteSalonBanner}
                              onChange={e => setSiteSalonBanner(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono text-xs focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: GALLERY - UPLOAD, CHANGE/EDIT & DELETE PHOTOS/VIDEOS */}
              {activeTab === 'gallery' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-serif-luxury text-2xl text-white font-medium">
                      Gestiune Portofoliu Foto &amp; Video Frizerie
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Încarcă fotografii și videoclipuri noi, schimbă imaginile existente, modifică titlul secțiunii și etichetele de filtrare.
                    </p>
                  </div>

                  {/* Section Title, Subtitle & Custom Category Tags Management */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/90 border border-[#d4af37]/40 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                      <div>
                        <h4 className="font-serif-luxury text-lg text-white font-medium flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-[#d4af37]" />
                          <span>Setări Titlu &amp; Etichete (Categorii) Portofoliu</span>
                        </h4>
                        <p className="text-xs text-zinc-400">
                          Aici poți schimba titlul secțiunii, textul explicativ și etichetele/categoriile în care plasezi lucrările.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveGallerySettings}
                        className="px-4 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e0bd47] text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md self-start sm:self-auto shrink-0"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Salvează Titlu &amp; Etichete</span>
                      </button>
                    </div>

                    {gallerySettingsMsg && (
                      <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{gallerySettingsMsg}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                      {/* Badge Text */}
                      <div className="md:col-span-4">
                        <label className="block text-zinc-300 font-semibold mb-1">
                          Text Ecuson / Badge Secțiune
                        </label>
                        <input
                          type="text"
                          value={gallerySettings.badgeText || ''}
                          onChange={e => setGallerySettings(prev => ({ ...prev, badgeText: e.target.value }))}
                          placeholder="ex: Hair & Beauty Atelier"
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>

                      {/* Main Title */}
                      <div className="md:col-span-8">
                        <label className="block text-zinc-300 font-semibold mb-1">
                          Titlu Principal Secțiune Portofoliu *
                        </label>
                        <input
                          type="text"
                          value={gallerySettings.title}
                          onChange={e => setGallerySettings(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Descoperă Stilul și Frumusețea alături de Roxana Teușde (Buie)"
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-medium focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>

                      {/* Subtitle */}
                      <div className="md:col-span-12">
                        <label className="block text-zinc-300 font-semibold mb-1">
                          Subtitlu / Descriere Secțiune Portofoliu
                        </label>
                        <textarea
                          rows={2}
                          value={gallerySettings.subtitle}
                          onChange={e => setGallerySettings(prev => ({ ...prev, subtitle: e.target.value }))}
                          placeholder="Fiecare stil este unic, iar fiecare transformare pune în valoare personalitatea ta..."
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>

                      {/* Tags / Categories Manager */}
                      <div className="md:col-span-12 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-[#d4af37]" />
                            <span>Etichete / Butoane de Filtrare Portofoliu ({gallerySettings.tags?.length || 0}):</span>
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            Fiecare lucrare poate fi plasată la una dintre aceste etichete.
                          </span>
                        </div>

                        {/* Existing tags chips */}
                        <div className="flex flex-wrap gap-2">
                          {(gallerySettings.tags || []).map(tag => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-xs text-zinc-200"
                            >
                              <span>{tag.label}</span>
                              {tag.id !== 'all' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGalleryTag(tag.id)}
                                  className="text-zinc-500 hover:text-red-400 cursor-pointer ml-1"
                                  title="Șterge eticheta"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>

                        {/* Add new tag inline */}
                        <div className="flex items-center gap-2 pt-1 max-w-md">
                          <input
                            type="text"
                            value={newGalleryTagLabel}
                            onChange={e => setNewGalleryTagLabel(e.target.value)}
                            placeholder="Adaugă etichetă nouă (ex: Nuanțare & Reflexe)..."
                            className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-[#d4af37] focus:outline-none"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddGalleryTag();
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleAddGalleryTag}
                            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-semibold text-xs flex items-center gap-1 border border-zinc-700 cursor-pointer shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Adaugă Etichetă</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {mediaSuccessMessage && (
                    <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{mediaSuccessMessage}</span>
                    </div>
                  )}

                  {/* Edit Modal / Box when editing an existing image */}
                  {editingItem && (
                    <div className="p-6 rounded-2xl bg-amber-950/20 border-2 border-amber-500/60 space-y-4 text-xs animate-in zoom-in-95">
                      <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                        <div className="font-semibold text-amber-300 text-sm flex items-center gap-2">
                          <Edit2 className="w-4 h-4" />
                          <span>Schimbă / Editează Imaginea: {editingItem.title}</span>
                        </div>
                        <button
                          onClick={() => setEditingItem(null)}
                          className="text-zinc-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form onSubmit={handleSaveEditedMedia} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="font-semibold text-zinc-300 block mb-1">
                              Înlocuiește fișierul (Upload fotografie sau video nou)
                            </label>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              onChange={(e) => handleFileUpload(e, true)}
                              className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#d4af37] file:text-zinc-950 cursor-pointer"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-zinc-300 block mb-1">
                              SAU Schimbă URL-ul direct
                            </label>
                            <input
                              type="url"
                              value={editingItem.mediaUrl}
                              onChange={e => setEditingItem({ ...editingItem, mediaUrl: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="font-semibold text-zinc-300 block mb-1">Titlu Lucrare</label>
                            <input
                              type="text"
                              required
                              value={editingItem.title}
                              onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-zinc-300 block mb-1">Categorie</label>
                            <select
                              value={editingItem.category}
                              onChange={e => setEditingItem({ ...editingItem, category: e.target.value as any })}
                              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                            >
                              {(gallerySettings.tags || []).filter(t => t.id !== 'all').map(tag => (
                                <option key={tag.id} value={tag.id}>{tag.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center pt-5">
                            <label className="flex items-center gap-2 cursor-pointer text-white">
                              <input
                                type="checkbox"
                                checked={editingItem.featured}
                                onChange={e => setEditingItem({ ...editingItem, featured: e.target.checked })}
                                className="rounded"
                              />
                              <span>Recomandat în portofoliu</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="font-semibold text-zinc-300 block mb-1">Descriere Lucrare</label>
                          <textarea
                            rows={2}
                            value={editingItem.description || ''}
                            onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                          />
                        </div>

                        {/* Preview */}
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                          {editingItem.mediaType === 'photo' ? (
                            <img
                              src={editingItem.mediaUrl}
                              alt="Previzualizare"
                              className="w-16 h-16 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-zinc-800 rounded-lg flex items-center justify-center text-[#d4af37]">
                              <Video className="w-6 h-6" />
                            </div>
                          )}
                          <div className="text-xs">
                            <div className="text-white font-semibold">Previzualizare activă</div>
                            <div className="text-zinc-500 text-[11px] truncate max-w-sm">{editingItem.mediaUrl.substring(0, 80)}...</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="submit"
                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                          >
                            Salvează Modificările
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItem(null)}
                            className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white"
                          >
                            Renunță
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Add New Media Form */}
                  <form
                    onSubmit={handleAddMedia}
                    className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4 text-xs"
                  >
                    <div className="font-semibold text-white text-sm flex items-center gap-2">
                      <Upload className="w-4 h-4 text-[#d4af37]" />
                      <span>Încarcă Fotografie sau Videoclip Nou</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* File upload from local computer */}
                      <div>
                        <label className="font-semibold text-zinc-300 block mb-1">
                          1. Selectează Fișier din Calculator (Foto sau Video)
                        </label>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={(e) => handleFileUpload(e, false)}
                          className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#d4af37] file:text-zinc-950 hover:file:bg-[#e0bd47] cursor-pointer"
                        />
                      </div>

                      {/* Or direct URL */}
                      <div>
                        <label className="font-semibold text-zinc-300 block mb-1">
                          SAU Introdu URL Direct (Unsplash / CDN / Video)
                        </label>
                        <input
                          type="url"
                          value={newMediaUrl}
                          onChange={e => setNewMediaUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="font-semibold text-zinc-300 block mb-1">Titlu Lucrare *</label>
                        <input
                          type="text"
                          required
                          value={newMediaTitle}
                          onChange={e => setNewMediaTitle(e.target.value)}
                          placeholder="ex: High Fade & Pompadour"
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-zinc-300 block mb-1">Categorie</label>
                        <select
                          value={newMediaCategory}
                          onChange={e => setNewMediaCategory(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                        >
                          {(gallerySettings.tags || []).filter(t => t.id !== 'all').map(tag => (
                            <option key={tag.id} value={tag.id}>{tag.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-zinc-300 block mb-1">Tip Media</label>
                        <div className="flex items-center gap-3 mt-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="mediaType"
                              checked={newMediaType === 'photo'}
                              onChange={() => setNewMediaType('photo')}
                            />
                            <span>Fotografie</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="mediaType"
                              checked={newMediaType === 'video'}
                              onChange={() => setNewMediaType('video')}
                            />
                            <span>Videoclip</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="font-semibold text-zinc-300 block mb-1">Frizer / Model</label>
                        <input
                          type="text"
                          value={newMediaClient}
                          onChange={e => setNewMediaClient(e.target.value)}
                          placeholder="ex: Realizat de Roxana Teușde (Buie)"
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center pt-5">
                        <label className="flex items-center gap-2 cursor-pointer text-white">
                          <input
                            type="checkbox"
                            checked={newMediaFeatured}
                            onChange={e => setNewMediaFeatured(e.target.checked)}
                            className="rounded"
                          />
                          <span>Marchează ca Recomandat (apare cu steluță)</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-zinc-300 block mb-1">Descriere Lucrare</label>
                      <input
                        type="text"
                        value={newMediaDescription}
                        onChange={e => setNewMediaDescription(e.target.value)}
                        placeholder="ex: Fade curat la zero cu foarfecă pe calotă și pudră mată."
                        className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#d4af37] focus:outline-none"
                      />
                    </div>

                    {newMediaUrl && (
                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-3">
                        {newMediaType === 'photo' ? (
                          <img
                            src={newMediaUrl}
                            alt="Previzualizare"
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-zinc-800 rounded-lg flex items-center justify-center text-[#d4af37]">
                            <Video className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <div className="text-white font-medium">Previzualizare activă</div>
                          <div className="text-zinc-500 text-[11px] truncate max-w-md">{newMediaUrl.substring(0, 70)}...</div>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isUploadingMedia}
                      className="px-6 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e0bd47] text-zinc-950 font-bold text-xs cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {isUploadingMedia ? 'Se salvează...' : 'Publică în Galerie'}
                    </button>
                  </form>

                  {/* Existing media items with Change Image & Delete options */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                      Lucrări în Galerie ({gallery.length}) • Click pe "Schimbă" pentru editare
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {gallery.map(item => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3 truncate">
                            <img
                              src={item.thumbnailUrl || item.mediaUrl}
                              alt={item.title}
                              className="w-12 h-12 object-cover rounded-lg shrink-0"
                            />
                            <div className="truncate">
                              <div className="font-semibold text-white truncate">{item.title}</div>
                              <div className="text-zinc-400 text-[11px]">
                                {item.category} • {item.mediaType === 'video' ? 'Video' : 'Foto'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setEditingItem(item)}
                              className="p-2 text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                              title="Schimbă / Editează imaginea"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMedia(item.id)}
                              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                              title="Șterge din portofoliu"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: VISITORS & SITE ANALYTICS (Cine a vizionat site-ul) */}
              {activeTab === 'visitors' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-serif-luxury text-2xl text-white font-medium flex items-center gap-2">
                      <span>Cine a Vizionat Site-ul • Monitorizare Trafic &amp; Analytics</span>
                      <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        În Timp Real
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Jurnalul detaliat al vizitelor pe site: oraș estimat, dispozitiv, pagină accesată, sursă și durată.
                    </p>
                  </div>

                  {/* Analytics Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                      <div className="text-xs text-zinc-400">Vizite Înregistrate</div>
                      <div className="text-2xl font-serif-luxury font-bold text-white mt-1">
                        {visitors.length}
                      </div>
                      <div className="text-[11px] text-emerald-400 mt-1">Sesiuni active</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                      <div className="text-xs text-zinc-400">Ponderea Mobil</div>
                      <div className="text-2xl font-serif-luxury font-bold text-[#d4af37] mt-1">
                        {Math.round((visitors.filter(v => v.device === 'Mobil').length / (visitors.length || 1)) * 100)}%
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">Telefoane smartphone</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                      <div className="text-xs text-zinc-400">Oraș Principal</div>
                      <div className="text-2xl font-serif-luxury font-bold text-white mt-1">
                        Tileagd
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">Bihor &amp; zone limitrofe</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                      <div className="text-xs text-zinc-400">Durată Medie / Sesiune</div>
                      <div className="text-2xl font-serif-luxury font-bold text-emerald-400 mt-1">
                        3m 20s
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">Interes ridicat pentru programări</div>
                    </div>
                  </div>

                  {/* Visitor Activity Table */}
                  <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <span>Jurnal Ultimele Vizite pe Site</span>
                      </h4>
                      <button
                        onClick={loadData}
                        className="text-xs text-[#d4af37] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Actualizează lista</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
                            <th className="py-2.5 px-3">Data &amp; Ora</th>
                            <th className="py-2.5 px-3">Dispozitiv / Browser</th>
                            <th className="py-2.5 px-3">Locație (IP)</th>
                            <th className="py-2.5 px-3">Sursă Trafic</th>
                            <th className="py-2.5 px-3">Secțiune Vizitată</th>
                            <th className="py-2.5 px-3">Timp pe Site</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                          {visitors.map((v) => (
                            <tr key={v.id} className="hover:bg-zinc-800/30 transition-colors">
                              <td className="py-3 px-3 font-mono text-zinc-300">
                                {new Date(v.timestamp).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                                <span className="text-zinc-500 block text-[10px]">
                                  {new Date(v.timestamp).toLocaleDateString('ro-RO')}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5 font-medium text-white">
                                  {v.device === 'Mobil' ? (
                                    <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                                  ) : (
                                    <Monitor className="w-3.5 h-3.5 text-blue-400" />
                                  )}
                                  <span>{v.device}</span>
                                </div>
                                <span className="text-zinc-500 text-[10px] block">{v.browser}</span>
                              </td>
                              <td className="py-3 px-3 text-zinc-300">
                                {v.city}
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-amber-300 font-medium text-[11px]">
                                  {v.referrer}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-[11px] text-zinc-300">
                                {v.pageViewed}
                              </td>
                              <td className="py-3 px-3 text-emerald-400 font-medium">
                                {Math.floor(v.durationSeconds / 60)}m {v.durationSeconds % 60}s
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: REVIEWS MODERATION */}
              {activeTab === 'reviews' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-serif-luxury text-2xl text-white font-medium">
                      Moderare Recenzii Clienți
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Verifică și aprobă mărturiile lăsate de clienți înainte de a fi afișate public pe site.
                    </p>
                  </div>

                  {/* Pending Reviews */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      <span>Recenzii Noi În Așteptare ({reviews.filter(r => !r.approved).length})</span>
                    </h4>

                    {reviews.filter(r => !r.approved).length === 0 ? (
                      <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center text-xs text-zinc-500">
                        Toate recenziile sunt moderate și aprobate!
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reviews.filter(r => !r.approved).map(r => (
                          <div
                            key={r.id}
                            className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{r.authorName}</span>
                                <span className="text-zinc-400">({r.roleOrEvent})</span>
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map(s => (
                                    <Star
                                      key={s}
                                      className={`w-3.5 h-3.5 ${s <= r.rating ? 'fill-[#d4af37] text-[#d4af37]' : 'text-zinc-600'}`}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleApproveReview(r.id)}
                                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Aprobă &amp; Publică</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteReview(r.id)}
                                  className="p-1 text-red-400 hover:text-red-300 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <p className="text-zinc-200 italic">"{r.text}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Approved Reviews List */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                      Recenzii Vizibile pe Site ({reviews.filter(r => r.approved).length})
                    </h4>
                    <div className="space-y-3">
                      {reviews.filter(r => r.approved).map(r => (
                        <div
                          key={r.id}
                          className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs flex items-start justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-white">{r.authorName}</span>
                              <span className="text-zinc-400">({r.roleOrEvent})</span>
                              <span className="text-amber-400 font-bold">{r.rating}★</span>
                            </div>
                            <p className="text-zinc-300 italic">"{r.text}"</p>
                          </div>
                          <button
                            onClick={() => handleDeleteReview(r.id)}
                            className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                            title="Șterge recenzie"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: SUPABASE CONFIG & SECURITY */}
              {activeTab === 'supabase' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-serif-luxury text-2xl text-white font-medium">
                      Configurare Supabase &amp; Securitate Bază de Date
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Gestionați cheile API de conectare Supabase, inspectați politicile Row Level Security (RLS)
                      și rulați scriptul de migrare SQL.
                    </p>
                  </div>

                  {syncStatus && (
                    <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-amber-400" />
                      <span>{syncStatus}</span>
                    </div>
                  )}

                  {/* Credentials Box */}
                  <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4 text-xs">
                    <div className="font-semibold text-white text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-[#d4af37]" />
                        <span>Parametri Conexiune Supabase</span>
                      </div>
                      <button
                        onClick={handleTestConnection}
                        disabled={connStatus.testing}
                        className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${connStatus.testing ? 'animate-spin' : ''}`} />
                        <span>{connStatus.testing ? 'Testare...' : 'Testează Conexiunea'}</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-zinc-300 font-semibold block mb-1">
                          Supabase Project URL (ex: https://xyz.supabase.co)
                        </label>
                        <input
                          type="url"
                          value={supabaseUrl}
                          onChange={e => setSupabaseUrl(e.target.value)}
                          placeholder="https://your-project.supabase.co"
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono text-xs focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-zinc-300 font-semibold block mb-1">
                          Supabase Publishable / Anon Key (sb_publishable_... sau JWT)
                        </label>
                        <input
                          type="password"
                          value={supabaseKey}
                          onChange={e => setSupabaseKey(e.target.value)}
                          placeholder="sb_publishable_... sau eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono text-xs focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={handleSaveCredentials}
                          className="px-5 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e0bd47] text-zinc-950 font-bold text-xs cursor-pointer shadow-md"
                        >
                          Salvează Cheile Supabase
                        </button>

                        <button
                          type="button"
                          onClick={handleSyncToSupabase}
                          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Database className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Sincronizează Datele Locale în Supabase Cloud</span>
                        </button>
                      </div>
                    </div>

                    {connStatus.result && (
                      <div
                        className={`p-4 rounded-xl border text-xs flex items-start gap-2.5 ${
                          connStatus.result.success
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                            : 'bg-red-950/40 border-red-500/40 text-red-300'
                        }`}
                      >
                        {connStatus.result.success ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                        )}
                        <div>
                          <div className="font-semibold">{connStatus.result.message}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Security Audit & SQL */}
                  <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-white text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#d4af37]" />
                        <span>Script SQL Supabase cu RLS</span>
                      </div>

                      <button
                        onClick={handleCopySQL}
                        className="px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e0bd47] text-zinc-950 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        {sqlCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{sqlCopied ? 'Copiat!' : 'Copiază Scriptul SQL'}</span>
                      </button>
                    </div>

                    <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-[11px] overflow-x-auto max-h-48 leading-relaxed">
                      {generateSupabaseSQLSchema()}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
