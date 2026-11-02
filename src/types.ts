/**
 * Core type definitions for Roxana Teusde PFA (Buie) - Frizerie & Barbershop
 */

export type BookingStatus = 'in_asteptare' | 'confirmat' | 'finalizat' | 'anulat';

export interface Booking {
  id: string;
  referenceCode: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  barberName?: string;
  eventDate: string; // Data programării YYYY-MM-DD
  eventTime: string; // Ora programării (ex: 14:00)
  location: string;
  guestsCount?: number;
  estimatedTotal: number;
  depositAmount: number;
  notes?: string;
  addons?: Record<string, boolean | undefined>;
  status: BookingStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  authorName: string;
  roleOrEvent: string; // ex: "Tuns Skin Fade & Barbă", "Client Fidel"
  rating: number; // 1 - 5
  text: string;
  eventDate?: string;
  avatarUrl?: string;
  approved: boolean;
  createdAt: string;
}

export type MediaCategory = 'fade' | 'barba' | 'clasic' | 'styling' | 'video' | 'salon' | string;

export interface CategoryTag {
  id: string;
  label: string;
}

export interface SectionSettings {
  badgeText: string;
  title: string;
  subtitle: string;
  tags: CategoryTag[];
}

export interface GalleryItem {
  id: string;
  title: string;
  category: MediaCategory;
  mediaType: 'photo' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string;
  aspectRatio?: 'square' | 'wide' | 'tall';
  featured?: boolean;
  orderIndex: number;
  description?: string;
  eventDate?: string;
  clientNames?: string;
  createdAt: string;
}

export interface ServicePackage {
  id: string;
  title: string;
  category: 'tuns' | 'barba' | 'pachet' | 'tratamente' | 'coafura' | 'produse' | string;
  price: number;
  duration: string;
  durationMin?: number;
  popular?: boolean;
  description: string;
  features: string[];
  imageUrl?: string;
}

export interface ServiceAddon {
  id: string;
  name: string;
  priceRon: number;
  durationMin: number;
  description?: string;
  imageUrl?: string;
  popular?: boolean;
}

export interface SiteImages {
  heroBgUrl: string;
  aboutPhotoUrl: string;
  salonBannerUrl: string;
}

export interface BarberStaff {
  id: string;
  name: string;
  role: string;
  photoUrl: string;
  bio: string;
  experienceYears: number;
}

export interface VisitorLog {
  id: string;
  timestamp: string;
  device: 'Mobil' | 'Desktop' | 'Tabletă';
  browser: string;
  city: string;
  referrer: string; // ex: 'Google Search', 'Instagram', 'Direct', 'WhatsApp', 'Facebook'
  pageViewed: string;
  durationSeconds: number;
  screenSize: string;
}

export interface PfaSettings {
  brandName: string;
  ownerName: string;
  cui: string;
  regCom: string;
  address: string;
  phone: string;
  email: string;
  hoursWeekday: string;
  hoursSaturday: string;
  hoursSunday: string;
  aboutBio?: string;
}
