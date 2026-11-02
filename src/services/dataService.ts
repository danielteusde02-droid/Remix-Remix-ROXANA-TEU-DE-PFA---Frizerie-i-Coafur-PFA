import { getSupabase, uploadMediaToSupabaseStorage } from '../lib/supabase';
import {
  Booking,
  BookingStatus,
  GalleryItem,
  Review,
  ServicePackage,
  ServiceAddon,
  CategoryTag,
  SectionSettings,
  BarberStaff,
  VisitorLog,
  SiteImages
} from '../types';
import {
  calculateBarberEstimate,
  generateBookingReference,
  validateBookingScheduleAndDuration,
} from '../utils/bookingUtils';

const STORAGE_BOOKINGS = 'rxt_barber_bookings_data';
const STORAGE_BOOKINGS_INIT = 'rxt_barber_bookings_initialized';
const STORAGE_REVIEWS = 'rxt_barber_reviews_data';
const STORAGE_GALLERY = 'rxt_barber_gallery_data';
const STORAGE_SERVICES = 'rxt_barber_services_data';
const STORAGE_ADDONS = 'rxt_barber_addons_data';
const STORAGE_VISITORS = 'rxt_barber_visitors_data';
const STORAGE_SITE_IMAGES = 'rxt_site_branding_images';
const STORAGE_GALLERY_SETTINGS = 'rxt_gallery_settings';
const STORAGE_SERVICES_SETTINGS = 'rxt_services_settings';

export const DEFAULT_GALLERY_SETTINGS: SectionSettings = {
  badgeText: 'Hair & Beauty Atelier',
  title: 'Descoperă Stilul și Frumusețea alături de Roxana Teușde (Buie)',
  subtitle: 'Fiecare stil este unic, iar fiecare transformare pune în valoare personalitatea ta. De la tunsori moderne și coafuri elegante, până la schimbări de look, culoare și styling, fiecare detaliu este realizat cu profesionalism, pasiune și atenție.',
  tags: [
    { id: 'all', label: 'Toate Lucrările' },
    { id: 'barbati', label: 'Tunsori Bărbați' },
    { id: 'femei', label: 'Tunsori Femei' },
    { id: 'coafuri', label: 'Coafuri' },
    { id: 'vopsit', label: 'Vopsit & Culoare' },
    { id: 'styling', label: 'Styling & Finisaje' },
    { id: 'transformari', label: 'Transformări de Look' },
    { id: 'video', label: 'Video & Inspirație' },
  ],
};

export const DEFAULT_SERVICES_SETTINGS: SectionSettings = {
  badgeText: 'Meniu Servicii & Tarife Frizerie',
  title: 'Îngrijire Masculină Fără Compromis',
  subtitle: 'Fiecare serviciu este realizat cu atenție, pasiune și profesionalism, folosind produse de calitate și tehnici adaptate stilului și dorințelor tale.',
  tags: [
    { id: 'all', label: 'Toate Serviciile & Produsele' },
    { id: 'tuns', label: 'Tunsori Masculine' },
    { id: 'barba', label: 'Barbă & Bărbierit' },
    { id: 'pachet', label: 'Pachete Complete' },
    { id: 'tratamente', label: 'Tratamente Faciale' },
    { id: 'coafura', label: 'Coafură Damă' },
    { id: 'produse', label: 'Produse Styling' },
  ],
};

export const INITIAL_ADDONS: ServiceAddon[] = [
  {
    id: 'hotTowelTreatment',
    name: 'Tratament cu prosop cald și uleiuri esențiale',
    priceRon: 25,
    durationMin: 10,
    description: 'Prosop fierbinte infuzat cu ulei de eucalipt pentru relaxarea musculaturii faciale și dilatarea porilor.',
    imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80',
    popular: true,
  },
  {
    id: 'hairWashStyling',
    name: 'Spălat dublu revitalizant + Styling profesional',
    priceRon: 20,
    durationMin: 10,
    description: 'Șampon mentolat răcoritor cu masaj al scalpului și coafare cu pomadă sau ceară mată.',
    imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80',
    popular: false,
  },
  {
    id: 'blackMask',
    name: 'Mască neagră detoxifiantă cu cărbune activ (Black Mask)',
    priceRon: 35,
    durationMin: 15,
    description: 'Curățare profundă a punctelor negre și impurităților din zona T a feței.',
    imageUrl: 'https://images.unsplash.com/photo-1512290900672-1f02b947c617?auto=format&fit=crop&w=600&q=80',
    popular: false,
  },
  {
    id: 'beardCamouflage',
    name: 'Camuflaj & nuanțare fire albe barbă',
    priceRon: 40,
    durationMin: 15,
    description: 'Colorare semi-permanentă discretă fără tonuri roșiatice pentru un aspect uniform și masculin.',
    imageUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&q=80',
    popular: false,
  },
  {
    id: 'headMassage',
    name: 'Masaj capilar relaxant cu tonic mentolat',
    priceRon: 30,
    durationMin: 10,
    description: 'Stimulează circulația la rădăcina firului de păr și elimină complet tensiunea acumulată.',
    imageUrl: 'https://images.unsplash.com/photo-1517832606589-7629c3397143?auto=format&fit=crop&w=600&q=80',
    popular: false,
  },
  {
    id: 'eyebrowStyling',
    name: 'Stilizare & conturare sprâncene',
    priceRon: 15,
    durationMin: 5,
    description: 'Curățare exces și definire naturală a arcadei la brici sau pensetă.',
    imageUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=600&q=80',
    popular: false,
  },
];

export const DEFAULT_SITE_IMAGES: SiteImages = {
  heroBgUrl: '/assets/aistudio/pt_site_ef4b9a1a.jpg',
  aboutPhotoUrl: '/assets/aistudio/fata_bruneta_2_60013457.jpg',
  salonBannerUrl: '/assets/aistudio/pt_site_ef4b9a1a.jpg',
};

// ============================================================================
// BARBERSHOP STAFF
// ============================================================================
export const BARBERSHOP_STAFF: BarberStaff[] = [
  {
    id: 'barber-roxana',
    name: 'Roxana Teușde (Buie)',
    role: 'Master Barber & Fondator Atelier',
    photoUrl: '/assets/aistudio/fata_bruneta_2_60013457.jpg',
    bio: 'Peste 9 ani de experiență dedicată artei frizeriei masculine și bărbieritului tradițional. Pasiune pentru precizie milimetrică la fade, simetrie și consiliere de stil masculin.',
    experienceYears: 9,
  },
  {
    id: 'barber-radu',
    name: 'Radu Vancea',
    role: 'Senior Barber & Beard Stylist',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    bio: 'Specialist în sculptarea bărbilor, tratamente faciale cu prosop fierbinte și tunsori moderne texturate.',
    experienceYears: 6,
  },
];

// ============================================================================
// INITIAL BARBERSHOP SERVICES
// ============================================================================
export const INITIAL_SERVICES: ServicePackage[] = [
  {
    id: 'tuns-skin-fade',
    title: 'Tuns Modern Skin Fade / Taper',
    category: 'tuns',
    price: 70,
    duration: '40 minute',
    durationMin: 40,
    popular: false,
    description: 'Tranziție impecabilă de la zero pe lateral, adaptată formei craniului și texturii părului tău.',
    imageUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80',
    features: [
      'Consiliere stil și fizionomie înainte de tuns',
      'Fade milimetric cu mașini profesionale Wahl & Babyliss',
      'Contur precis cu briciul și cremă transparentă',
      'Spălat dublu cu șampon energizant mentolat',
      'Styling cu ceară mată sau pomadă pe bază de apă',
    ],
  },
  {
    id: 'pachet-gentleman-vip',
    title: 'Pachetul Complet "The Gentleman"',
    category: 'pachet',
    price: 110,
    duration: '65 minute',
    durationMin: 65,
    popular: true,
    description: 'Experiența completă de răsfăț masculin. Tuns, bărbierit cu prosop cald, spălat și tratament.',
    imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
    features: [
      'Tuns complet la foarfecă sau fade la alegere',
      'Ritual de bărbierit tradițional cu prosop fierbinte',
      'Tratament cu aburi și uleiuri esențiale de eucalipt',
      'Contur milimetric la briciul japonez',
      'Spălat dublu + masaj capilar revigorant',
      'Balsam aftershave calmant + ulei de barbă premium',
      'Cafea espresso sau whiskey din partea casei',
    ],
  },
  {
    id: 'aranjat-barba-prosop',
    title: 'Bărbierit Tradițional & Sculptat Barbă',
    category: 'barba',
    price: 50,
    duration: '30 minute',
    durationMin: 30,
    popular: false,
    description: 'Îngrijire dedicată bărbii tale: contur curat, prosop fierbinte și finisare cu briciul.',
    imageUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80',
    features: [
      'Aplicare prosop cald pentru deschiderea porilor',
      'Tuns și filat barbă la foarfecă și mașină',
      'Bărbierit și curățare contur gât și pomeți cu briciul',
      'Prosop rece pentru închiderea porilor',
      'Ulei nutritiv de argan și pieptănat la perie de mistreț',
    ],
  },
  {
    id: 'tuns-clasic-foarfeca',
    title: 'Tuns Clasic Executiv (Exclusiv Foarfecă)',
    category: 'tuns',
    price: 65,
    duration: '40 minute',
    durationMin: 40,
    popular: false,
    description: 'Pentru domnii care preferă eleganța discretă a unei tunsori clasice lucrate exclusiv manual.',
    imageUrl: 'https://images.unsplash.com/photo-1517832606589-7629c3397143?auto=format&fit=crop&w=800&q=80',
    features: [
      'Tuns integral la foarfecă (Side Part, Scissor Cut, Pompadour clasic)',
      'Finisaj ceafă și perciuni cu briciul',
      'Spălat relaxant și uscat la perie',
      'Styling cu tonic și cremă lejeră',
    ],
  },
  {
    id: 'father-and-son',
    title: 'Pachet Father & Son (Tată & Fiu)',
    category: 'pachet',
    price: 120,
    duration: '60 minute',
    durationMin: 60,
    popular: false,
    description: 'Timp de calitate petrecut împreună pe scaunul de frizerie. Două tunsori complete.',
    imageUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=800&q=80',
    features: [
      '2 Tunsori complete (1 adult + 1 junior)',
      'Spălat și styling adaptat fiecăruia',
      'Atmosferă relaxată și prietenoasă',
      'Băuturi răcoritoare și cafea incluse',
    ],
  },
  {
    id: 'tratament-detox-ten',
    title: 'Tratament Facial Black Mask & Masaj Capilar',
    category: 'tratamente',
    price: 60,
    duration: '30 minute',
    durationMin: 30,
    popular: false,
    description: 'Curățare profundă a porilor și revitalizare completă a scalpului și a tenului.',
    imageUrl: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07b8b?auto=format&fit=crop&w=800&q=80',
    features: [
      'Mască neagră detoxifiantă cu cărbune activ pentru zona T',
      'Îndepărtare impurități și puncte negre',
      'Masaj capilar relaxant cu loțiune tonică răcoritoare',
      'Cremă hidratantă matifiantă pentru bărbați',
    ],
  },
  {
    id: 'coafura-styling-dama',
    title: 'Coafură & Schimbare de Look Damă',
    category: 'coafura',
    price: 90,
    duration: '50 minute',
    durationMin: 50,
    popular: false,
    description: 'Servicii de coafură dedicată pentru doamne și domnișoare: aranjat, bucle lejere sau finisaj drept impecabil.',
    imageUrl: '/assets/aistudio/fata_bruneta_2_60013457.jpg',
    features: [
      'Consiliere de stil și volum în funcție de fizionomie',
      'Spălat cu șampon și mască nutritivă profesională',
      'Uscat la perie / bucle texturate / îndreptat cu protecție termică',
      'Fixare lejeră și ser de strălucire',
    ],
  },
  {
    id: 'pudra-styling-reuzel',
    title: 'Pudră de Volum Texturantă Reuzel Matte Texture',
    category: 'produse',
    price: 65,
    duration: 'Produs Salon',
    durationMin: 0,
    popular: false,
    description: 'Produs profesional de styling pentru finisaj mat și volum instant de la rădăcină. Disponibil direct în salon.',
    imageUrl: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80',
    features: [
      'Formulă ultra-lejeră fără senzație lipicioasă',
      'Fixare medie și finisaj 100% mat',
      'Ideal pentru tunsori scurte texturate și crop',
      'Flacon 15g cu dozator de precizie',
    ],
  },
];

// ============================================================================
// INITIAL BARBERSHOP GALLERY
// ============================================================================
export const INITIAL_GALLERY: GalleryItem[] = [
  {
    id: 'barber-gal-1',
    title: 'Low Skin Fade & Textură Superioară Mată',
    category: 'fade',
    mediaType: 'photo',
    mediaUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1000&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=600&q=80',
    aspectRatio: 'square',
    featured: true,
    orderIndex: 1,
    description: 'Fade curat, textură decupată și styling cu pudră de volum mată.',
    clientNames: 'Andrei V. • Realizat de Roxana',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'barber-gal-2',
    title: 'Ritual Bărbierit Tradițional cu Briciul și Prosop Cald',
    category: 'video',
    mediaType: 'video',
    mediaUrl: 'https://assets.mixkit.co/videos/preview/mixkit-barber-shaving-a-man-with-a-straight-razor-41215-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80',
    aspectRatio: 'wide',
    featured: true,
    orderIndex: 2,
    description: 'Tehnica tradițională de bărbierit cu spumă caldă și brici cu lamă japoneză.',
    clientNames: 'Mihai T. • Salon Tileagd',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'barber-gal-3',
    title: 'Contur Barbă Pomeți & Aranjat la Foarfecă',
    category: 'barba',
    mediaType: 'photo',
    mediaUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1000&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&q=80',
    aspectRatio: 'square',
    featured: true,
    orderIndex: 3,
    description: 'Sculptură barbă medie cu aliniere simetrică și ulei de cedru.',
    clientNames: 'Cristian D.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'barber-gal-4',
    title: 'Tuns Clasic Business cu Cărare (Side Part)',
    category: 'clasic',
    mediaType: 'photo',
    mediaUrl: 'https://images.unsplash.com/photo-1517832606589-7629c3397143?auto=format&fit=crop&w=1000&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1517832606589-7629c3397143?auto=format&fit=crop&w=600&q=80',
    aspectRatio: 'tall',
    featured: false,
    orderIndex: 4,
    description: 'Finisaj impecabil la foarfecă, potrivit pentru ținute elegante de birou.',
    clientNames: 'Vlad M.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'barber-gal-5',
    title: 'Atelierul Nostru - Ambient Vintage & Scaune Hidraulice',
    category: 'salon',
    mediaType: 'photo',
    mediaUrl: '/assets/aistudio/pt_site_ef4b9a1a.jpg',
    thumbnailUrl: '/assets/aistudio/pt_site_ef4b9a1a.jpg',
    aspectRatio: 'wide',
    featured: true,
    orderIndex: 5,
    description: 'Design industrial cald, muzică jazz/blues și cafea boabe proaspăt măcinată.',
    clientNames: 'Frizerie Tileagd',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'barber-gal-6',
    title: 'Mid Fade cu Textură Crop & Contur Brici',
    category: 'fade',
    mediaType: 'photo',
    mediaUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=1000&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=600&q=80',
    aspectRatio: 'square',
    featured: false,
    orderIndex: 6,
    description: 'Tranziție uniformă și breton drept decupat geometric.',
    clientNames: 'George S.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'barber-gal-7',
    title: 'Coafură de Ocazie cu Fundă din Păr Natural & Bucle Volum',
    category: 'coafuri',
    mediaType: 'photo',
    mediaUrl: '/assets/aistudio/fata_bruneta_2_60013457.jpg',
    thumbnailUrl: '/assets/aistudio/fata_bruneta_2_60013457.jpg',
    aspectRatio: 'tall',
    featured: true,
    orderIndex: 7,
    description: 'Coafură creativă cu fundă elegantă realizată manual din șuvițe de păr natural, volum la rădăcină și bucle lejere.',
    clientNames: 'Ana-Maria • Realizat în Atelier',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'barber-gal-8',
    title: 'Schimbare de Look & Balayage Cenușiu Luminos',
    category: 'transformari',
    mediaType: 'photo',
    mediaUrl: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=1000&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=600&q=80',
    aspectRatio: 'square',
    featured: true,
    orderIndex: 8,
    description: 'Transformare radicală: nuanțe reci armonioase, tratament cu plex și styling finisaj glam.',
    clientNames: 'Elena R.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'barber-gal-9',
    title: 'Tuns Bob Texturat cu Nuanțare Ciocolatiu Cald',
    category: 'femei',
    mediaType: 'photo',
    mediaUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1000&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
    aspectRatio: 'square',
    featured: false,
    orderIndex: 9,
    description: 'Linii curate la ceafă, fluiditate și mișcare naturală pentru păr de lungime medie.',
    clientNames: 'Ioana B.',
    createdAt: new Date().toISOString(),
  },
];

// ============================================================================
// INITIAL REVIEWS
// ============================================================================
export const INITIAL_REVIEWS: Review[] = [
  {
    id: 'barber-rev-1',
    authorName: 'Alexandru Popa',
    roleOrEvent: 'Pachet The Gentleman • Tileagd',
    rating: 5,
    text: 'Cea mai tare frizerie din Tileagd! Roxana Teușde are o mână de aur și o precizie la fade pe care rar o găsești. Bărbieritul cu prosop cald a fost incredibil de relaxant. Recomand cu toată încrederea!',
    eventDate: 'Octombrie 2026',
    approved: true,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'barber-rev-2',
    authorName: 'Tudor Dumitrescu',
    roleOrEvent: 'Tuns Skin Fade & Aranjat Barbă',
    rating: 5,
    text: 'Atmosferă de nota 10, cafea excelentă, scaune confortabile și o punctualitate exemplară. Niciodată nu am stat să aștept aiurea. Iar tunsul ține forma perfect peste 3 săptămâni.',
    eventDate: 'Septembrie 2026',
    approved: true,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'barber-rev-3',
    authorName: 'Florin & Luca M. (Tată & Fiu)',
    roleOrEvent: 'Pachet Father & Son',
    rating: 5,
    text: 'Am venit cu băiețelul meu de 7 ani. Roxana a avut o răbdare extraordinară cu el, iar amândoi am ieșit tunși impecabil. Vom reveni lună de lună!',
    eventDate: 'August 2026',
    approved: true,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'barber-rev-4',
    authorName: 'Dan Vasilescu',
    roleOrEvent: 'Tratament Barbă & Tuns Clasic',
    rating: 5,
    text: 'Produsele folosite sunt de top (Reuzel, Proraso, Uppercut), iar atenția la detalii și igiena briciului sunt fără cusur. 5 stele meritate pe deplin!',
    eventDate: 'Iulie 2026',
    approved: true,
    createdAt: new Date(Date.now() - 50 * 86400000).toISOString(),
  },
];

// ============================================================================
// INITIAL APPOINTMENTS
// ============================================================================
export const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'barber-book-1',
    referenceCode: 'FRZ-2026-4891',
    clientName: 'Bogdan Mihalcea',
    clientEmail: 'bogdan.mihalcea@gmail.com',
    clientPhone: '0745123456',
    serviceId: 'pachet-gentleman-vip',
    serviceName: 'Pachetul Complet "The Gentleman"',
    barberName: 'Roxana Teușde (Buie)',
    eventDate: '2026-11-04',
    eventTime: '14:00',
    location: 'Scaunul 1 - Master Barber',
    estimatedTotal: 135,
    depositAmount: 0,
    notes: 'Fade de la 0 pe lateral și contur barbă la brici.',
    addons: { hotTowelTreatment: true },
    status: 'confirmat',
    adminNotes: 'Client fidel. Preferă cafea scurtă fără zahăr.',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'barber-book-2',
    referenceCode: 'FRZ-2026-9102',
    clientName: 'Daniel Călin',
    clientEmail: 'daniel.calin@yahoo.com',
    clientPhone: '0752987654',
    serviceId: 'tuns-skin-fade',
    serviceName: 'Tuns Modern Skin Fade / Taper',
    barberName: 'Roxana Teușde (Buie)',
    eventDate: '2026-11-04',
    eventTime: '15:30',
    location: 'Scaunul 1',
    estimatedTotal: 70,
    depositAmount: 0,
    notes: 'Low fade discret.',
    addons: {},
    status: 'in_asteptare',
    adminNotes: 'Nou client înscris de pe site.',
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'barber-book-3',
    referenceCode: 'FRZ-2026-3341',
    clientName: 'Marius Drăgan',
    clientEmail: 'marius.dragan@gmail.com',
    clientPhone: '0722334455',
    serviceId: 'aranjat-barba-prosop',
    serviceName: 'Bărbierit Tradițional & Sculptat Barbă',
    barberName: 'Radu Vancea',
    eventDate: '2026-11-05',
    eventTime: '11:15',
    location: 'Scaunul 2',
    estimatedTotal: 85,
    depositAmount: 0,
    notes: 'Contur curat gât și pomeți + mască neagră.',
    addons: { blackMask: true },
    status: 'confirmat',
    adminNotes: 'Confirmat telefonic.',
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ============================================================================
// INITIAL VISITOR LOGS (ANALYTICS)
// ============================================================================
export const INITIAL_VISITORS: VisitorLog[] = [
  {
    id: 'vis-1',
    timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
    device: 'Mobil',
    browser: 'Safari Mobile / iOS',
    city: 'Tileagd, Bihor',
    referrer: 'Instagram (@roxanateusde.barber)',
    pageViewed: '/#booking (Formular Programare)',
    durationSeconds: 245,
    screenSize: '390x844',
  },
  {
    id: 'vis-2',
    timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
    device: 'Desktop',
    browser: 'Chrome 131 / Windows',
    city: 'Tileagd, Bihor',
    referrer: 'Google Search (frizerie tileagd roxana teusde)',
    pageViewed: '/#servicii (Tarife)',
    durationSeconds: 180,
    screenSize: '1920x1080',
  },
  {
    id: 'vis-3',
    timestamp: new Date(Date.now() - 72 * 60000).toISOString(),
    device: 'Mobil',
    browser: 'Chrome Mobile / Android',
    city: 'Salonta, Bihor',
    referrer: 'Facebook Link',
    pageViewed: '/#galerie (Portofoliu Tunsori)',
    durationSeconds: 310,
    screenSize: '412x915',
  },
  {
    id: 'vis-4',
    timestamp: new Date(Date.now() - 140 * 60000).toISOString(),
    device: 'Desktop',
    browser: 'Safari / macOS',
    city: 'Cluj-Napoca',
    referrer: 'Direct / Bookmark',
    pageViewed: '/#recenzii',
    durationSeconds: 120,
    screenSize: '1440x900',
  },
  {
    id: 'vis-5',
    timestamp: new Date(Date.now() - 210 * 60000).toISOString(),
    device: 'Mobil',
    browser: 'Instagram In-App Browser',
    city: 'Băile Felix, Bihor',
    referrer: 'Instagram Story',
    pageViewed: '/#calculator (Calculator Tarif)',
    durationSeconds: 195,
    screenSize: '393x852',
  },
  {
    id: 'vis-6',
    timestamp: new Date(Date.now() - 320 * 60000).toISOString(),
    device: 'Mobil',
    browser: 'WhatsApp Webview',
    city: 'Tileagd, Bihor',
    referrer: 'WhatsApp Shared Link',
    pageViewed: '/ (Pagina Principală)',
    durationSeconds: 150,
    screenSize: '390x844',
  },
];

// Helper to safely access localStorage
function getLocalItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('LocalStorage save failed', err);
  }
}

// ============================================================================
// DATA SERVICE API (FULL SUPABASE + STORAGE + LOCAL CACHE)
// ============================================================================

export const dataService = {
  // --------------------------------------------------------------------------
  // VISITOR TRACKING & ANALYTICS
  // --------------------------------------------------------------------------
  async trackVisit(page = '/'): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
      const isTablet = /iPad|Tablet/i.test(navigator.userAgent);
      const device: 'Mobil' | 'Desktop' | 'Tabletă' = isMobile ? 'Mobil' : isTablet ? 'Tabletă' : 'Desktop';

      let browser = 'Chrome';
      if (/Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent)) browser = 'Safari';
      else if (/Firefox/i.test(navigator.userAgent)) browser = 'Firefox';
      else if (/Edg/i.test(navigator.userAgent)) browser = 'Edge';

      const ref = document.referrer;
      let referrerLabel = 'Direct / Link Direct';
      if (ref.includes('google')) referrerLabel = 'Google Search';
      else if (ref.includes('instagram')) referrerLabel = 'Instagram';
      else if (ref.includes('facebook')) referrerLabel = 'Facebook';
      else if (ref.includes('wa.me') || ref.includes('whatsapp')) referrerLabel = 'WhatsApp';

      const log: VisitorLog = {
        id: `vis-${Date.now()}`,
        timestamp: new Date().toISOString(),
        device,
        browser,
        city: 'Tileagd, Bihor (IP vizitator)',
        referrer: referrerLabel,
        pageViewed: page,
        durationSeconds: Math.floor(45 + Math.random() * 180),
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
      };

      const current = getLocalItem<VisitorLog[]>(STORAGE_VISITORS, INITIAL_VISITORS);
      setLocalItem(STORAGE_VISITORS, [log, ...current.slice(0, 100)]);
    } catch {
      // Ignore analytics logging errors
    }
  },

  async getVisitorLogs(): Promise<VisitorLog[]> {
    return getLocalItem<VisitorLog[]>(STORAGE_VISITORS, INITIAL_VISITORS);
  },

  // --------------------------------------------------------------------------
  // BOOKINGS (PROGRAMĂRI FRIZERIE - FĂRĂ REAPARIȚIA CELOR DEMO DUPĂ ȘTERGERE)
  // --------------------------------------------------------------------------
  async getBookings(): Promise<Booking[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          const mapped: Booking[] = data.map((d: any) => ({
            id: d.id,
            referenceCode: d.reference_code || d.referenceCode,
            clientName: d.client_name || d.clientName,
            clientEmail: d.client_email || d.clientEmail,
            clientPhone: d.client_phone || d.clientPhone,
            serviceId: d.service_id || d.serviceId,
            serviceName: d.service_name || d.serviceName,
            barberName: d.barber_name || d.barberName || 'Roxana Teușde (Buie)',
            eventDate: d.event_date || d.eventDate,
            eventTime: d.event_time || d.eventTime || '12:00',
            location: d.location || 'Scaunul 1',
            guestsCount: Number(d.guests_count || 1),
            estimatedTotal: Number(d.estimated_total || d.estimatedTotal || 0),
            depositAmount: Number(d.deposit_amount || 0),
            notes: d.notes,
            addons: d.addons || {},
            status: d.status as BookingStatus,
            adminNotes: d.admin_notes || d.adminNotes,
            createdAt: d.created_at || d.createdAt,
            updatedAt: d.updated_at || d.updatedAt,
          }));
          // Sync local cache with exact DB state (including [] when all bookings are deleted!)
          setLocalItem(STORAGE_BOOKINGS, mapped);
          setLocalItem(STORAGE_BOOKINGS_INIT, true);
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase getBookings failed, fallback to local', err);
      }
    }

    const isInitialized = getLocalItem<boolean>(STORAGE_BOOKINGS_INIT, false);
    const hasExplicitStorage =
      typeof window !== 'undefined' &&
      window.localStorage &&
      window.localStorage.getItem(STORAGE_BOOKINGS) !== null;

    if (isInitialized || hasExplicitStorage) {
      return getLocalItem<Booking[]>(STORAGE_BOOKINGS, []);
    }

    return getLocalItem<Booking[]>(STORAGE_BOOKINGS, INITIAL_BOOKINGS);
  },

  async createBooking(
    bookingInput: Omit<Booking, 'id' | 'referenceCode' | 'createdAt' | 'updatedAt' | 'status'>,
    turnstileToken: string
  ): Promise<Booking> {
    if (!turnstileToken || typeof turnstileToken !== 'string' || turnstileToken.trim().length < 20) {
      throw new Error(
        'Verificarea anti-bot (Cloudflare Turnstile) lipsește sau este invalidă. Trimiterea programării a fost blocată.'
      );
    }

    // Compute real duration from service + addons to validate schedule before sending
    const allServices = getLocalItem<ServicePackage[]>(STORAGE_SERVICES, INITIAL_SERVICES);
    const allAddons = getLocalItem<ServiceAddon[]>(STORAGE_ADDONS, INITIAL_ADDONS);
    const matchedService = allServices.find(s => s.id === bookingInput.serviceId);
    const estimate = calculateBarberEstimate(
      matchedService ? matchedService.price : bookingInput.estimatedTotal || 70,
      matchedService?.durationMin || 40,
      bookingInput.addons || {},
      allAddons
    );

    const scheduleCheck = validateBookingScheduleAndDuration({
      eventDate: bookingInput.eventDate,
      eventTime: bookingInput.eventTime,
      durationMin: estimate.totalDurationMin,
      isAdmin: false,
    });

    if (!scheduleCheck.valid) {
      throw new Error(
        scheduleCheck.error || 'Intervalul selectat nu se încadrează în programul de lucru al salonului.'
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      throw new Error(
        'Conexiunea cu serverul securizat Supabase nu este configurată. Programările nu pot fi înregistrate fără verificarea server-side Turnstile.'
      );
    }

    const newBooking: Booking = {
      ...bookingInput,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `book-${Date.now()}`,
      referenceCode: generateBookingReference(new Date(bookingInput.eventDate || Date.now())),
      status: 'in_asteptare',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const dbRow = {
      reference_code: newBooking.referenceCode,
      client_name: newBooking.clientName,
      client_email: newBooking.clientEmail,
      client_phone: newBooking.clientPhone,
      service_id: newBooking.serviceId,
      service_name: newBooking.serviceName,
      barber_name: newBooking.barberName || 'Roxana Teușde (Buie)',
      event_date: newBooking.eventDate,
      event_time: newBooking.eventTime,
      location: newBooking.location,
      guests_count: 1,
      estimated_total: newBooking.estimatedTotal,
      deposit_amount: 0,
      notes: newBooking.notes || '',
      addons: newBooking.addons || {},
      status: newBooking.status,
      admin_notes: '',
    };

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('create-booking-turnstile', {
        body: {
          ...dbRow,
          turnstileToken: turnstileToken.trim(),
        },
      });

      if (!fnError && fnData && fnData.success === true) {
        if (fnData.booking) {
          if (fnData.booking.id) newBooking.id = fnData.booking.id;
          if (fnData.booking.reference_code) newBooking.referenceCode = fnData.booking.reference_code;
          if (typeof fnData.booking.estimated_total === 'number') {
            newBooking.estimatedTotal = Number(fnData.booking.estimated_total);
          }
        }
        const isInit = getLocalItem<boolean>(STORAGE_BOOKINGS_INIT, false);
        const current = getLocalItem<Booking[]>(STORAGE_BOOKINGS, isInit ? [] : INITIAL_BOOKINGS);
        setLocalItem(STORAGE_BOOKINGS, [newBooking, ...current]);
        setLocalItem(STORAGE_BOOKINGS_INIT, true);
        return newBooking;
      }
    } catch (edgeErr) {
      console.warn('Edge Function create-booking-turnstile invoke error, trying direct DB insert:', edgeErr);
    }

    // Direct database insert fallback for environments where Edge Function is not yet deployed
    const { data: directData, error: directError } = await supabase
      .from('bookings')
      .insert(dbRow)
      .select()
      .maybeSingle();

    if (!directError && directData) {
      if (directData.id) newBooking.id = directData.id;
      if (directData.reference_code) newBooking.referenceCode = directData.reference_code;
      const isInit = getLocalItem<boolean>(STORAGE_BOOKINGS_INIT, false);
      const current = getLocalItem<Booking[]>(STORAGE_BOOKINGS, isInit ? [] : INITIAL_BOOKINGS);
      setLocalItem(STORAGE_BOOKINGS, [newBooking, ...current]);
      setLocalItem(STORAGE_BOOKINGS_INIT, true);
      return newBooking;
    }

    if (directError) {
      throw new Error(`Eroare la înregistrarea programării în baza de date: ${directError.message}`);
    }

    const isInit = getLocalItem<boolean>(STORAGE_BOOKINGS_INIT, false);
    const current = getLocalItem<Booking[]>(STORAGE_BOOKINGS, isInit ? [] : INITIAL_BOOKINGS);
    setLocalItem(STORAGE_BOOKINGS, [newBooking, ...current]);
    setLocalItem(STORAGE_BOOKINGS_INIT, true);
    return newBooking;
  },

  async updateBookingStatus(id: string, status: BookingStatus, adminNotes?: string): Promise<boolean> {
    const isInit = getLocalItem<boolean>(STORAGE_BOOKINGS_INIT, false);
    const current = getLocalItem<Booking[]>(STORAGE_BOOKINGS, isInit ? [] : INITIAL_BOOKINGS);
    const targetBooking = current.find(b => b.id === id);

    // Enforce closed-day rule (Luni & Duminică) and working-hours + duration rule for active bookings
    // even for administrators unless an explicit administrative exception [EXCEPTIE_PROGRAM: <motiv min. 5 caractere>] is provided.
    if (targetBooking && (status === 'in_asteptare' || status === 'confirmat')) {
      const effectiveNotes = adminNotes !== undefined ? adminNotes : targetBooking.adminNotes || '';
      const allServices = getLocalItem<ServicePackage[]>(STORAGE_SERVICES, INITIAL_SERVICES);
      const allAddons = getLocalItem<ServiceAddon[]>(STORAGE_ADDONS, INITIAL_ADDONS);
      const matchedService = allServices.find(s => s.id === targetBooking.serviceId);
      const estimate = calculateBarberEstimate(
        matchedService ? matchedService.price : targetBooking.estimatedTotal || 70,
        matchedService?.durationMin || 40,
        targetBooking.addons || {},
        allAddons
      );

      const scheduleValidation = validateBookingScheduleAndDuration({
        eventDate: targetBooking.eventDate,
        eventTime: targetBooking.eventTime,
        durationMin: estimate.totalDurationMin,
        isAdmin: true,
        adminNotes: effectiveNotes,
      });

      if (!scheduleValidation.valid) {
        throw new Error(
          scheduleValidation.error ||
            'Confirmarea sau activarea unei programări în afara programului necesită o excepție administrativă explicită ([EXCEPTIE_PROGRAM: motiv]).'
        );
      }
    }

    const supabase = getSupabase();
    if (supabase) {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (adminNotes !== undefined) updates.admin_notes = adminNotes;
      const { error } = await supabase.from('bookings').update(updates).eq('id', id);
      if (error) {
        throw new Error(
          error.message || 'Eroare Supabase: nu s-a putut actualiza statusul programării (verificați permisiunile de administrator).'
        );
      }
    }

    const updated = current.map(b =>
      b.id === id
        ? { ...b, status, ...(adminNotes !== undefined ? { adminNotes } : {}), updatedAt: new Date().toISOString() }
        : b
    );
    setLocalItem(STORAGE_BOOKINGS, updated);
    setLocalItem(STORAGE_BOOKINGS_INIT, true);
    return true;
  },

  async deleteBooking(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) {
        throw new Error(
          error.message || 'Eroare Supabase: nu s-a putut șterge programarea (verificați permisiunile de administrator).'
        );
      }
    }

    const isInit = getLocalItem<boolean>(STORAGE_BOOKINGS_INIT, false);
    const current = getLocalItem<Booking[]>(STORAGE_BOOKINGS, isInit ? [] : INITIAL_BOOKINGS);
    const remaining = current.filter(b => b.id !== id);
    setLocalItem(STORAGE_BOOKINGS, remaining);
    setLocalItem(STORAGE_BOOKINGS_INIT, true);
    return true;
  },

  // --------------------------------------------------------------------------
  // REVIEWS
  // --------------------------------------------------------------------------
  async getReviews(onlyApproved = true): Promise<Review[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase.from('reviews').select('*').order('created_at', { ascending: false });
        if (onlyApproved) {
          query = query.eq('approved', true);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            authorName: d.author_name || d.authorName,
            roleOrEvent: d.role_or_event || d.roleOrEvent,
            rating: Number(d.rating || 5),
            text: d.text,
            eventDate: d.event_date || d.eventDate,
            avatarUrl: d.avatar_url || d.avatarUrl,
            approved: Boolean(d.approved),
            createdAt: d.created_at || d.createdAt,
          }));
        }
      } catch (err) {
        console.warn('Supabase getReviews failed, fallback to local', err);
      }
    }

    const current = getLocalItem<Review[]>(STORAGE_REVIEWS, INITIAL_REVIEWS);
    return onlyApproved ? current.filter(r => r.approved) : current;
  },

  async submitReview(reviewInput: Omit<Review, 'id' | 'createdAt' | 'approved'>): Promise<Review> {
    const newReview: Review = {
      ...reviewInput,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rev-${Date.now()}`,
      approved: false,
      createdAt: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const dbRow = {
          author_name: newReview.authorName,
          role_or_event: newReview.roleOrEvent,
          rating: newReview.rating,
          text: newReview.text,
          event_date: newReview.eventDate || '',
          avatar_url: newReview.avatarUrl || '',
          approved: false,
        };
        await supabase.from('reviews').insert(dbRow);
      } catch (err) {
        console.warn('Supabase submitReview error, saved locally', err);
      }
    }

    const current = getLocalItem<Review[]>(STORAGE_REVIEWS, INITIAL_REVIEWS);
    setLocalItem(STORAGE_REVIEWS, [newReview, ...current]);
    return newReview;
  },

  async approveReview(id: string, approved = true): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('reviews').update({ approved }).eq('id', id);
      } catch (err) {
        console.warn('Supabase approveReview failed', err);
      }
    }

    const current = getLocalItem<Review[]>(STORAGE_REVIEWS, INITIAL_REVIEWS);
    setLocalItem(
      STORAGE_REVIEWS,
      current.map(r => (r.id === id ? { ...r, approved } : r))
    );
    return true;
  },

  async deleteReview(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('reviews').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteReview failed', err);
      }
    }

    const current = getLocalItem<Review[]>(STORAGE_REVIEWS, INITIAL_REVIEWS);
    setLocalItem(STORAGE_REVIEWS, current.filter(r => r.id !== id));
    return true;
  },

  // --------------------------------------------------------------------------
  // GALLERY (PHOTO & VIDEO UPLOAD TO SUPABASE STORAGE + DB)
  // --------------------------------------------------------------------------
  async getGalleryItems(): Promise<GalleryItem[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('gallery_items')
          .select('*')
          .order('order_index', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: GalleryItem[] = data.map((d: any) => ({
            id: d.id,
            title: d.title,
            category: d.category,
            mediaType: d.media_type || d.mediaType,
            mediaUrl: d.media_url || d.mediaUrl,
            thumbnailUrl: d.thumbnail_url || d.thumbnailUrl,
            aspectRatio: d.aspect_ratio || d.aspectRatio || 'square',
            featured: Boolean(d.featured),
            orderIndex: Number(d.order_index || 0),
            description: d.description || '',
            eventDate: d.event_date || d.eventDate || '',
            clientNames: d.client_names || d.clientNames || '',
            createdAt: d.created_at || d.createdAt,
          }));
          setLocalItem(STORAGE_GALLERY, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase getGalleryItems error, fallback to local', err);
      }
    }

    return getLocalItem<GalleryItem[]>(STORAGE_GALLERY, INITIAL_GALLERY);
  },

  async addGalleryItem(itemInput: Omit<GalleryItem, 'id' | 'createdAt'>): Promise<GalleryItem> {
    const uploadedMediaUrl = await uploadMediaToSupabaseStorage(itemInput.mediaUrl, 'gallery');
    const uploadedThumbUrl = itemInput.thumbnailUrl
      ? await uploadMediaToSupabaseStorage(itemInput.thumbnailUrl, 'gallery')
      : uploadedMediaUrl;

    const newItem: GalleryItem = {
      ...itemInput,
      mediaUrl: uploadedMediaUrl,
      thumbnailUrl: uploadedThumbUrl,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `gal-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const dbRow = {
          title: newItem.title,
          category: newItem.category,
          media_type: newItem.mediaType,
          media_url: newItem.mediaUrl,
          thumbnail_url: newItem.thumbnailUrl || newItem.mediaUrl,
          aspect_ratio: newItem.aspectRatio || 'square',
          featured: newItem.featured || false,
          order_index: newItem.orderIndex || 0,
          description: newItem.description || '',
          event_date: newItem.eventDate || '',
          client_names: newItem.clientNames || '',
        };
        const { data, error } = await supabase.from('gallery_items').insert(dbRow).select().single();
        if (!error && data) {
          newItem.id = data.id;
        }
      } catch (err) {
        console.warn('Supabase addGalleryItem error, saved locally', err);
      }
    }

    const current = getLocalItem<GalleryItem[]>(STORAGE_GALLERY, INITIAL_GALLERY);
    setLocalItem(STORAGE_GALLERY, [newItem, ...current]);
    return newItem;
  },

  async updateGalleryItem(item: GalleryItem): Promise<boolean> {
    const uploadedMediaUrl = await uploadMediaToSupabaseStorage(item.mediaUrl, 'gallery');
    const uploadedThumbUrl = item.thumbnailUrl
      ? await uploadMediaToSupabaseStorage(item.thumbnailUrl, 'gallery')
      : uploadedMediaUrl;

    const updatedItem: GalleryItem = {
      ...item,
      mediaUrl: uploadedMediaUrl,
      thumbnailUrl: uploadedThumbUrl,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('gallery_items').update({
          title: updatedItem.title,
          category: updatedItem.category,
          media_type: updatedItem.mediaType,
          media_url: updatedItem.mediaUrl,
          thumbnail_url: updatedItem.thumbnailUrl || updatedItem.mediaUrl,
          featured: updatedItem.featured,
          description: updatedItem.description,
          client_names: updatedItem.clientNames,
        }).eq('id', updatedItem.id);
      } catch (err) {
        console.warn('Supabase updateGalleryItem error', err);
      }
    }

    const current = getLocalItem<GalleryItem[]>(STORAGE_GALLERY, INITIAL_GALLERY);
    const updated = current.map(g => (g.id === updatedItem.id ? updatedItem : g));
    setLocalItem(STORAGE_GALLERY, updated);
    return true;
  },

  async deleteGalleryItem(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('gallery_items').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteGalleryItem error', err);
      }
    }

    const current = getLocalItem<GalleryItem[]>(STORAGE_GALLERY, INITIAL_GALLERY);
    setLocalItem(STORAGE_GALLERY, current.filter(g => g.id !== id));
    return true;
  },

  // --------------------------------------------------------------------------
  // SERVICES & PRODUCTS (FULL SUPABASE CRUD + SUPABASE STORAGE)
  // --------------------------------------------------------------------------
  async getServices(): Promise<ServicePackage[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .order('order_index', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: ServicePackage[] = data.map((d: any) => ({
            id: d.id,
            title: d.title,
            category: d.category,
            price: Number(d.price),
            duration: d.duration,
            durationMin: Number(d.duration_min ?? 40),
            popular: Boolean(d.popular),
            description: d.description || '',
            imageUrl: d.image_url || d.imageUrl || '',
            features: Array.isArray(d.features)
              ? d.features
              : typeof d.features === 'string'
              ? JSON.parse(d.features || '[]')
              : [],
          }));
          setLocalItem(STORAGE_SERVICES, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase getServices error, fallback to local', err);
      }
    }

    const saved = getLocalItem<ServicePackage[]>(STORAGE_SERVICES, INITIAL_SERVICES);
    return saved.map(s => {
      const initMatch = INITIAL_SERVICES.find(i => i.id === s.id);
      return {
        ...s,
        imageUrl: s.imageUrl || initMatch?.imageUrl || '',
      };
    });
  },

  async addService(serviceInput: Omit<ServicePackage, 'id'>): Promise<ServicePackage> {
    const uploadedImageUrl = serviceInput.imageUrl
      ? await uploadMediaToSupabaseStorage(serviceInput.imageUrl, 'services')
      : '';

    const newService: ServicePackage = {
      ...serviceInput,
      imageUrl: uploadedImageUrl,
      id: `svc-${Date.now()}`,
    };

    const current = await this.getServices();
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('services').upsert({
          id: newService.id,
          title: newService.title,
          category: newService.category,
          price: newService.price,
          duration: newService.duration,
          duration_min: newService.durationMin,
          popular: Boolean(newService.popular),
          description: newService.description,
          image_url: newService.imageUrl || '',
          features: newService.features || [],
          order_index: current.length + 1,
        });
      } catch (err) {
        console.warn('Supabase addService error, saved locally', err);
      }
    }

    const updated = [newService, ...current];
    setLocalItem(STORAGE_SERVICES, updated);
    return newService;
  },

  async updateService(service: ServicePackage): Promise<boolean> {
    const uploadedImageUrl = service.imageUrl
      ? await uploadMediaToSupabaseStorage(service.imageUrl, 'services')
      : '';

    const updatedService: ServicePackage = {
      ...service,
      imageUrl: uploadedImageUrl,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('services').upsert({
          id: updatedService.id,
          title: updatedService.title,
          category: updatedService.category,
          price: updatedService.price,
          duration: updatedService.duration,
          duration_min: updatedService.durationMin,
          popular: Boolean(updatedService.popular),
          description: updatedService.description,
          image_url: updatedService.imageUrl || '',
          features: updatedService.features || [],
        });
      } catch (err) {
        console.warn('Supabase updateService error, saved locally', err);
      }
    }

    const current = getLocalItem<ServicePackage[]>(STORAGE_SERVICES, INITIAL_SERVICES);
    const exists = current.some(s => s.id === updatedService.id);
    const updated = exists
      ? current.map(s => (s.id === updatedService.id ? updatedService : s))
      : [updatedService, ...current];
    setLocalItem(STORAGE_SERVICES, updated);
    return true;
  },

  async deleteService(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('services').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteService error', err);
      }
    }

    const current = getLocalItem<ServicePackage[]>(STORAGE_SERVICES, INITIAL_SERVICES);
    const updated = current.filter(s => s.id !== id);
    setLocalItem(STORAGE_SERVICES, updated);
    return true;
  },

  // --------------------------------------------------------------------------
  // OPTIONAL TREATMENTS (ADDONS - FULL SUPABASE CRUD + SUPABASE STORAGE)
  // --------------------------------------------------------------------------
  async getAddons(): Promise<ServiceAddon[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('service_addons')
          .select('*')
          .order('order_index', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: ServiceAddon[] = data.map((d: any) => ({
            id: d.id,
            name: d.name,
            priceRon: Number(d.price_ron ?? d.priceRon ?? 25),
            durationMin: Number(d.duration_min ?? d.durationMin ?? 10),
            description: d.description || '',
            imageUrl: d.image_url || d.imageUrl || '',
            popular: Boolean(d.popular),
          }));
          setLocalItem(STORAGE_ADDONS, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase getAddons error, fallback to local', err);
      }
    }

    return getLocalItem<ServiceAddon[]>(STORAGE_ADDONS, INITIAL_ADDONS);
  },

  async addAddon(addonInput: Omit<ServiceAddon, 'id'>): Promise<ServiceAddon> {
    const uploadedImageUrl = addonInput.imageUrl
      ? await uploadMediaToSupabaseStorage(addonInput.imageUrl, 'addons')
      : '';

    const newAddon: ServiceAddon = {
      ...addonInput,
      imageUrl: uploadedImageUrl,
      id: `addon-${Date.now()}`,
    };

    const current = await this.getAddons();
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('service_addons').upsert({
          id: newAddon.id,
          name: newAddon.name,
          price_ron: newAddon.priceRon,
          duration_min: newAddon.durationMin,
          description: newAddon.description || '',
          image_url: newAddon.imageUrl || '',
          popular: Boolean(newAddon.popular),
          order_index: current.length + 1,
        });
      } catch (err) {
        console.warn('Supabase addAddon error, saved locally', err);
      }
    }

    const updated = [...current, newAddon];
    setLocalItem(STORAGE_ADDONS, updated);
    return newAddon;
  },

  async updateAddon(addon: ServiceAddon): Promise<boolean> {
    const uploadedImageUrl = addon.imageUrl
      ? await uploadMediaToSupabaseStorage(addon.imageUrl, 'addons')
      : '';

    const updatedAddon: ServiceAddon = {
      ...addon,
      imageUrl: uploadedImageUrl,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('service_addons').upsert({
          id: updatedAddon.id,
          name: updatedAddon.name,
          price_ron: updatedAddon.priceRon,
          duration_min: updatedAddon.durationMin,
          description: updatedAddon.description || '',
          image_url: updatedAddon.imageUrl || '',
          popular: Boolean(updatedAddon.popular),
        });
      } catch (err) {
        console.warn('Supabase updateAddon error, saved locally', err);
      }
    }

    const current = getLocalItem<ServiceAddon[]>(STORAGE_ADDONS, INITIAL_ADDONS);
    const exists = current.some(a => a.id === updatedAddon.id);
    const updated = exists
      ? current.map(a => (a.id === updatedAddon.id ? updatedAddon : a))
      : [...current, updatedAddon];
    setLocalItem(STORAGE_ADDONS, updated);
    return true;
  },

  async deleteAddon(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('service_addons').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteAddon error', err);
      }
    }

    const current = getLocalItem<ServiceAddon[]>(STORAGE_ADDONS, INITIAL_ADDONS);
    const updated = current.filter(a => a.id !== id);
    setLocalItem(STORAGE_ADDONS, updated);
    return true;
  },

  // --------------------------------------------------------------------------
  // REMOTE SETTINGS SYNC (PFA_SETTINGS: SITE IMAGES, GALLERY & SERVICES TITLES/TAGS)
  // --------------------------------------------------------------------------
  async fetchRemoteSettings(): Promise<{
    siteImages: SiteImages;
    gallerySettings: SectionSettings;
    servicesSettings: SectionSettings;
  }> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        // 1. Primary query via public.public_site_settings view (security_invoker = true)
        let { data, error } = await supabase
          .from('public_site_settings')
          .select('id, site_images, gallery_settings, services_settings, hours_weekday, hours_saturday, hours_sunday')
          .eq('id', 'current')
          .maybeSingle();

        // 2. Fallback to explicit public columns on public.pfa_settings if view is not yet created
        if (error) {
          const fallbackRes = await supabase
            .from('pfa_settings')
            .select('id, site_images, gallery_settings, services_settings, hours_weekday, hours_saturday, hours_sunday')
            .eq('id', 'current')
            .maybeSingle();
          data = fallbackRes.data;
          error = fallbackRes.error;
        }

        if (!error && data) {
          if (data.site_images && typeof data.site_images === 'object') {
            setLocalItem(STORAGE_SITE_IMAGES, { ...DEFAULT_SITE_IMAGES, ...data.site_images });
          }
          if (data.gallery_settings && typeof data.gallery_settings === 'object') {
            setLocalItem(STORAGE_GALLERY_SETTINGS, { ...DEFAULT_GALLERY_SETTINGS, ...data.gallery_settings });
          }
          if (data.services_settings && typeof data.services_settings === 'object') {
            setLocalItem(STORAGE_SERVICES_SETTINGS, { ...DEFAULT_SERVICES_SETTINGS, ...data.services_settings });
          }
        }
      } catch (err) {
        console.warn('Supabase fetchRemoteSettings fallback to local cache', err);
      }
    }

    return {
      siteImages: this.getSiteImages(),
      gallerySettings: this.getGallerySettings(),
      servicesSettings: this.getServicesSettings(),
    };
  },

  // --------------------------------------------------------------------------
  // SITE PRESENTATION IMAGES & BRANDING (HERO, ABOUT, SALON BANNER)
  // --------------------------------------------------------------------------
  getSiteImages(): SiteImages {
    return getLocalItem<SiteImages>(STORAGE_SITE_IMAGES, DEFAULT_SITE_IMAGES);
  },

  async updateSiteImages(updates: Partial<SiteImages>): Promise<SiteImages> {
    const current = this.getSiteImages();
    const heroBgUrl = updates.heroBgUrl
      ? await uploadMediaToSupabaseStorage(updates.heroBgUrl, 'branding')
      : current.heroBgUrl;
    const aboutPhotoUrl = updates.aboutPhotoUrl
      ? await uploadMediaToSupabaseStorage(updates.aboutPhotoUrl, 'branding')
      : current.aboutPhotoUrl;
    const salonBannerUrl = updates.salonBannerUrl
      ? await uploadMediaToSupabaseStorage(updates.salonBannerUrl, 'branding')
      : current.salonBannerUrl;

    const updated: SiteImages = {
      heroBgUrl,
      aboutPhotoUrl,
      salonBannerUrl,
    };
    setLocalItem(STORAGE_SITE_IMAGES, updated);

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('pfa_settings').upsert({
          id: 'current',
          site_images: updated,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Supabase updateSiteImages warning:', err);
      }
    }

    return updated;
  },

  // --------------------------------------------------------------------------
  // GALLERY SETTINGS & TAGS (TITLU, SUBTITLU, ETICHETE PORTOFOLIU)
  // --------------------------------------------------------------------------
  getGallerySettings(): SectionSettings {
    const settings = getLocalItem<SectionSettings>(STORAGE_GALLERY_SETTINGS, DEFAULT_GALLERY_SETTINGS);
    if (settings && settings.title === 'Lucrări Realizate în Atelierul Roxana Teușde (Buie)') {
      const upgraded: SectionSettings = {
        ...DEFAULT_GALLERY_SETTINGS,
        ...settings,
        title: DEFAULT_GALLERY_SETTINGS.title,
        subtitle: DEFAULT_GALLERY_SETTINGS.subtitle,
        tags: DEFAULT_GALLERY_SETTINGS.tags,
      };
      setLocalItem(STORAGE_GALLERY_SETTINGS, upgraded);
      return upgraded;
    }
    return settings;
  },

  async updateGallerySettings(updates: Partial<SectionSettings>): Promise<SectionSettings> {
    const current = this.getGallerySettings();
    const updated = { ...current, ...updates };
    setLocalItem(STORAGE_GALLERY_SETTINGS, updated);

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('pfa_settings').upsert({
          id: 'current',
          gallery_settings: updated,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Supabase updateGallerySettings warning:', err);
      }
    }

    return updated;
  },

  // --------------------------------------------------------------------------
  // SERVICES SETTINGS & CATEGORIES (TITLU, SUBTITLU, ETICHETE SERVICII)
  // --------------------------------------------------------------------------
  getServicesSettings(): SectionSettings {
    return getLocalItem<SectionSettings>(STORAGE_SERVICES_SETTINGS, DEFAULT_SERVICES_SETTINGS);
  },

  async updateServicesSettings(updates: Partial<SectionSettings>): Promise<SectionSettings> {
    const current = this.getServicesSettings();
    const updated = { ...current, ...updates };
    setLocalItem(STORAGE_SERVICES_SETTINGS, updated);

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('pfa_settings').upsert({
          id: 'current',
          services_settings: updated,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Supabase updateServicesSettings warning:', err);
      }
    }

    return updated;
  },

  // --------------------------------------------------------------------------
  // SYNC LOCAL TO SUPABASE (FĂRĂ DUPLICATE ÎN GALERIE SAU RECENZII)
  // --------------------------------------------------------------------------
  async syncLocalToSupabase(): Promise<{
    success: boolean;
    syncedBookings: number;
    syncedReviews: number;
    syncedGallery: number;
    syncedServices?: number;
    syncedAddons?: number;
    error?: string;
  }> {
    const supabase = getSupabase();
    if (!supabase) {
      return {
        success: false,
        syncedBookings: 0,
        syncedReviews: 0,
        syncedGallery: 0,
        error: 'Supabase nu este configurat',
      };
    }

    try {
      const isInit = getLocalItem<boolean>(STORAGE_BOOKINGS_INIT, false);
      const localBookings = getLocalItem<Booking[]>(STORAGE_BOOKINGS, isInit ? [] : INITIAL_BOOKINGS);
      const localReviews = getLocalItem<Review[]>(STORAGE_REVIEWS, INITIAL_REVIEWS);
      const localGallery = getLocalItem<GalleryItem[]>(STORAGE_GALLERY, INITIAL_GALLERY);
      const localServices = getLocalItem<ServicePackage[]>(STORAGE_SERVICES, INITIAL_SERVICES);
      const localAddons = getLocalItem<ServiceAddon[]>(STORAGE_ADDONS, INITIAL_ADDONS);

      let bCount = 0;
      let rCount = 0;
      let gCount = 0;
      let sCount = 0;
      let aCount = 0;

      // 1. Sync Services (Upsert by ID)
      for (let i = 0; i < localServices.length; i++) {
        const s = localServices[i];
        const uploadedUrl = s.imageUrl ? await uploadMediaToSupabaseStorage(s.imageUrl, 'services') : '';
        const { error } = await supabase.from('services').upsert(
          {
            id: s.id,
            title: s.title,
            category: s.category,
            price: s.price,
            duration: s.duration,
            duration_min: s.durationMin || 40,
            popular: Boolean(s.popular),
            description: s.description || '',
            image_url: uploadedUrl,
            features: s.features || [],
            order_index: i + 1,
          },
          { onConflict: 'id' }
        );
        if (!error) sCount++;
      }

      // 2. Sync Service Addons (Upsert by ID)
      for (let i = 0; i < localAddons.length; i++) {
        const a = localAddons[i];
        const uploadedUrl = a.imageUrl ? await uploadMediaToSupabaseStorage(a.imageUrl, 'addons') : '';
        const { error } = await supabase.from('service_addons').upsert(
          {
            id: a.id,
            name: a.name,
            price_ron: a.priceRon,
            duration_min: a.durationMin,
            description: a.description || '',
            image_url: uploadedUrl,
            popular: Boolean(a.popular),
            order_index: i + 1,
          },
          { onConflict: 'id' }
        );
        if (!error) aCount++;
      }

      // 3. Sync Bookings (Upsert by reference_code)
      for (const b of localBookings) {
        const { error } = await supabase.from('bookings').upsert(
          {
            reference_code: b.referenceCode,
            client_name: b.clientName,
            client_email: b.clientEmail,
            client_phone: b.clientPhone,
            service_id: b.serviceId,
            service_name: b.serviceName,
            barber_name: b.barberName || 'Roxana Teușde (Buie)',
            event_date: b.eventDate,
            event_time: b.eventTime || '12:00',
            location: b.location,
            guests_count: 1,
            estimated_total: b.estimatedTotal,
            deposit_amount: 0,
            notes: b.notes || '',
            addons: b.addons || {},
            status: b.status,
            admin_notes: b.adminNotes || '',
          },
          { onConflict: 'reference_code' }
        );
        if (!error) bCount++;
      }

      // 4. Sync Reviews (Deduplicate by author_name + text)
      const { data: existingReviews } = await supabase.from('reviews').select('id, author_name, text');
      const existingReviewSignatures = new Set(
        (existingReviews || []).map((er: any) => `${(er.author_name || '').toLowerCase()}:::${(er.text || '').trim()}`)
      );

      for (const r of localReviews) {
        const sig = `${r.authorName.toLowerCase()}:::${r.text.trim()}`;
        if (existingReviewSignatures.has(sig)) {
          continue;
        }
        const { error } = await supabase.from('reviews').insert({
          author_name: r.authorName,
          role_or_event: r.roleOrEvent,
          rating: r.rating,
          text: r.text,
          event_date: r.eventDate || '',
          avatar_url: r.avatarUrl || '',
          approved: r.approved,
        });
        if (!error) {
          rCount++;
          existingReviewSignatures.add(sig);
        }
      }

      // 5. Sync Gallery Items (Deduplicate by title + media_url or UUID)
      const { data: existingGallery } = await supabase.from('gallery_items').select('id, title, media_url');
      const existingGalleryByKey = new Map<string, string>();
      for (const eg of existingGallery || []) {
        existingGalleryByKey.set(`${(eg.title || '').trim().toLowerCase()}:::${eg.media_url || ''}`, eg.id);
        if (eg.id) {
          existingGalleryByKey.set(`id:::${eg.id}`, eg.id);
        }
      }

      for (const g of localGallery) {
        const uploadedMediaUrl = await uploadMediaToSupabaseStorage(g.mediaUrl, 'gallery');
        const uploadedThumbUrl = g.thumbnailUrl
          ? await uploadMediaToSupabaseStorage(g.thumbnailUrl, 'gallery')
          : uploadedMediaUrl;

        const keySig = `${g.title.trim().toLowerCase()}:::${uploadedMediaUrl}`;
        const existingId = existingGalleryByKey.get(`id:::${g.id}`) || existingGalleryByKey.get(keySig);

        const rowPayload = {
          title: g.title,
          category: g.category,
          media_type: g.mediaType,
          media_url: uploadedMediaUrl,
          thumbnail_url: uploadedThumbUrl,
          aspect_ratio: g.aspectRatio || 'square',
          featured: g.featured || false,
          order_index: g.orderIndex,
          description: g.description || '',
          event_date: g.eventDate || '',
          client_names: g.clientNames || '',
        };

        if (existingId) {
          const { error } = await supabase.from('gallery_items').update(rowPayload).eq('id', existingId);
          if (!error) gCount++;
        } else {
          const { error } = await supabase.from('gallery_items').insert(rowPayload);
          if (!error) {
            gCount++;
            existingGalleryByKey.set(keySig, 'synced');
          }
        }
      }

      // 6. Sync PFA Settings (Site Images, Gallery Settings, Services Settings)
      await supabase.from('pfa_settings').upsert({
        id: 'current',
        site_images: this.getSiteImages(),
        gallery_settings: this.getGallerySettings(),
        services_settings: this.getServicesSettings(),
        updated_at: new Date().toISOString(),
      });

      return {
        success: true,
        syncedBookings: bCount,
        syncedReviews: rCount,
        syncedGallery: gCount,
        syncedServices: sCount,
        syncedAddons: aCount,
      };
    } catch (err: any) {
      return {
        success: false,
        syncedBookings: 0,
        syncedReviews: 0,
        syncedGallery: 0,
        error: err?.message || 'Eroare la sincronizare',
      };
    }
  },
};
