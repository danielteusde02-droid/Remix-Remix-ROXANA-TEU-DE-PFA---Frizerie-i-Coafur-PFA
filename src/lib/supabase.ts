import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isValidSupabaseKey, isValidSupabaseUrl } from '../utils/securityUtils';

// Configuration keys
const STORAGE_KEY_URL = 'roxana_teusde_supabase_url';
const STORAGE_KEY_ANON = 'roxana_teusde_supabase_anon_key';
export const STORAGE_KEY_TURNSTILE = 'roxana_teusde_turnstile_site_key';
export const DEFAULT_TURNSTILE_SITE_KEY = '0x4AAAAAAC9vn34-a32h2x7O';

export const SUPABASE_STORAGE_BUCKET = 'atelier-media';
export const MAX_MEDIA_FILE_SIZE_BYTES = 52428800; // 50 MB
export const ALLOWED_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
];

let cachedClient: SupabaseClient | null = null;
let cachedConfigString = '';

/**
 * Normalizes any Supabase URL to its strict origin (e.g. 'https://xyzcompany.supabase.co'),
 * stripping any accidental trailing slashes, /rest/v1, /auth/v1, or subpaths that would break GoTrue auth.
 */
export function normalizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    try {
      const parsedWithHttps = new URL(`https://${trimmed.replace(/^https?:\/\//, '')}`);
      return parsedWithHttps.origin;
    } catch {
      return trimmed.replace(/\/+$/, '');
    }
  }
}

/**
 * Returns the Cloudflare Turnstile public site key, prioritizing environment variables,
 * then localStorage, falling back to the configured site key.
 */
export function getTurnstileSiteKey(): string {
  const envKey =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim()
      : '';

  let storedKey = '';
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      storedKey = (window.localStorage.getItem(STORAGE_KEY_TURNSTILE) || '').trim();
    } catch {
      // Ignore localStorage access restrictions
    }
  }

  return envKey || storedKey || DEFAULT_TURNSTILE_SITE_KEY;
}

/**
 * Saves the Turnstile site key to localStorage
 */
export function saveTurnstileSiteKey(key: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY_TURNSTILE, key.trim());
    } catch (err) {
      console.warn('Could not save Turnstile key to localStorage', err);
    }
  }
}

/**
 * Retrieves the current Supabase configuration, prioritizing environment variables
 * (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY), then falling back to localStorage.
 * Automatically normalizes the URL to guarantee clean origin (no /rest/v1 or trailing slashes).
 */
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_SUPABASE_URL || '')
      : '';
  const envKey =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_SUPABASE_ANON_KEY || '')
      : '';

  let storedUrl = '';
  let storedKey = '';

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      storedUrl = window.localStorage.getItem(STORAGE_KEY_URL) || '';
      storedKey = window.localStorage.getItem(STORAGE_KEY_ANON) || '';
    } catch {
      // Ignore localStorage access restrictions
    }
  }

  const rawUrl = (envUrl || storedUrl).trim();
  const normalizedUrl = normalizeSupabaseUrl(rawUrl);

  return {
    url: normalizedUrl,
    anonKey: (envKey || storedKey).trim(),
  };
}

/**
 * Checks whether valid Supabase credentials are configured
 */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return isValidSupabaseUrl(url) && isValidSupabaseKey(anonKey);
}

/**
 * Saves Supabase credentials to localStorage with automatic URL normalization
 */
export function saveSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const normalized = normalizeSupabaseUrl(url);
      window.localStorage.setItem(STORAGE_KEY_URL, normalized);
      window.localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
      cachedClient = null; // Invalidate cache
      cachedConfigString = '';
    } catch (err) {
      console.warn('Could not save to localStorage', err);
    }
  }
}

/**
 * Returns a configured Supabase client if valid credentials exist, or null.
 * Supports both legacy JWT anon keys (eyJ...) and new publishable keys (sb_publishable_...).
 */
export function getSupabase(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();

  if (!url || !anonKey) {
    return null;
  }

  if (!isValidSupabaseUrl(url) || !isValidSupabaseKey(anonKey)) {
    console.warn('Supabase credentials present but invalid format (never use secret/service_role keys in frontend).');
    return null;
  }

  const configSignature = `${url}:::${anonKey}`;
  if (cachedClient && cachedConfigString === configSignature) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    cachedConfigString = configSignature;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

/**
 * Helper to convert a base64 DataURL into a Blob for uploading to Supabase Storage
 */
function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string; ext: string } | null {
  try {
    const [header, base64Data] = dataUrl.split(',');
    if (!header || !base64Data) return null;
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';

    const byteCharacters = atob(base64Data);
    const byteArrays: Uint8Array[] = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return {
      blob: new Blob(byteArrays as unknown as BlobPart[], { type: mimeType }),
      mimeType,
      ext,
    };
  } catch {
    return null;
  }
}

/**
 * Converts a File to a base64 DataURL as fallback when offline or unconfigured
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve((e.target?.result as string) || '');
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a File or a base64 DataURL to the Supabase Storage bucket `atelier-media`
 * and returns its permanent public URL.
 * Validates MIME type and maximum file size (50 MB) before uploading.
 */
export async function uploadMediaToSupabaseStorage(
  fileOrUrl: File | string,
  folder: 'gallery' | 'services' | 'addons' | 'branding' = 'gallery'
): Promise<string> {
  if (typeof fileOrUrl === 'string') {
    const trimmed = fileOrUrl.trim();
    if (!trimmed) return '';
    // Already a hosted URL or local public asset
    if (!trimmed.startsWith('data:')) {
      return trimmed;
    }

    const supabase = getSupabase();
    if (!supabase) {
      return trimmed;
    }

    const converted = dataUrlToBlob(trimmed);
    if (!converted) return trimmed;

    if (converted.blob.size > MAX_MEDIA_FILE_SIZE_BYTES) {
      throw new Error('Fișierul depășește limita maximă admisă de 50 MB pentru bucket-ul atelier-media.');
    }

    if (!ALLOWED_MEDIA_MIME_TYPES.includes(converted.mimeType)) {
      throw new Error(
        `Tipul de fișier (${converted.mimeType}) nu este permis. Formate acceptate: JPG, PNG, WEBP, GIF, MP4, WEBM.`
      );
    }

    const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${converted.ext}`;
    const { error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(filePath, converted.blob, {
        contentType: converted.mimeType,
        upsert: true,
      });

    if (error) {
      console.warn('Supabase Storage upload from dataUrl failed, keeping dataUrl fallback:', error.message);
      return trimmed;
    }

    const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(filePath);
    return data?.publicUrl || trimmed;
  }

  // Input is a File object: validate size and MIME type
  if (fileOrUrl.size > MAX_MEDIA_FILE_SIZE_BYTES) {
    throw new Error('Fișierul selectat depășește limita maximă admisă de 50 MB.');
  }

  if (fileOrUrl.type && !ALLOWED_MEDIA_MIME_TYPES.includes(fileOrUrl.type)) {
    throw new Error(
      `Formatul fișierului (${fileOrUrl.type}) nu este acceptat. Folosiți JPG, PNG, WEBP, GIF, MP4 sau WEBM.`
    );
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const ext = fileOrUrl.name.split('.').pop()?.toLowerCase() || 'jpg';
      const cleanName = fileOrUrl.name
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .substring(0, 40);
      const filePath = `${folder}/${Date.now()}-${cleanName || 'media'}.${ext}`;

      const { error } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(filePath, fileOrUrl, {
          contentType: fileOrUrl.type || 'image/jpeg',
          upsert: true,
        });

      if (!error) {
        const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(filePath);
        if (data?.publicUrl) {
          return data.publicUrl;
        }
      } else {
        console.warn('Supabase Storage direct file upload failed:', error.message);
      }
    } catch (err) {
      console.warn('Supabase Storage upload error:', err);
    }
  }

  // Fallback to base64 DataURL if Supabase Storage bucket is not yet created
  return fileToDataUrl(fileOrUrl);
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  isConfigured: boolean;
  hasTables?: boolean;
  missingTables?: string[];
  permissionErrors?: string[];
}

/**
 * Tests live connection to Supabase and checks all required public tables and views
 * without requesting restricted private columns on `pfa_settings`.
 */
export async function testSupabaseConnection(
  overrideUrl?: string,
  overrideKey?: string
): Promise<ConnectionTestResult> {
  const url = overrideUrl !== undefined ? overrideUrl.trim() : getSupabaseCredentials().url;
  const anonKey = overrideKey !== undefined ? overrideKey.trim() : getSupabaseCredentials().anonKey;

  if (!url || !anonKey) {
    return {
      success: false,
      isConfigured: false,
      message: 'Supabase nu este configurat încă. Adăugați VITE_SUPABASE_URL și VITE_SUPABASE_ANON_KEY.',
    };
  }

  if (!isValidSupabaseUrl(url)) {
    return {
      success: false,
      isConfigured: false,
      message: 'URL-ul Supabase este invalid. Trebuie să fie de forma https://proiect.supabase.co',
    };
  }

  if (!isValidSupabaseKey(anonKey)) {
    return {
      success: false,
      isConfigured: false,
      message: 'Cheia Supabase este invalidă. Folosiți cheia publică (sb_publishable_... sau anon JWT), nu cheia secretă!',
    };
  }

  try {
    const tempClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const checks: Array<{ name: string; columns: string }> = [
      { name: 'services', columns: 'id' },
      { name: 'service_addons', columns: 'id' },
      { name: 'gallery_items', columns: 'id' },
      { name: 'reviews', columns: 'id' },
      {
        name: 'pfa_settings',
        columns: 'id, site_images, gallery_settings, services_settings, hours_weekday, hours_saturday, hours_sunday',
      },
      {
        name: 'public_site_settings',
        columns: 'id, site_images, gallery_settings, services_settings',
      },
    ];

    const missingTables: string[] = [];
    const permissionErrors: string[] = [];

    for (const check of checks) {
      const { error } = await tempClient
        .from(check.name)
        .select(check.columns, { count: 'exact', head: true });

      if (error) {
        if (
          error.code === 'PGRST116' ||
          error.code === '42P01' ||
          error.message.includes('does not exist') ||
          error.message.includes('schema cache')
        ) {
          missingTables.push(check.name);
        } else if (error.code === '42501' || error.message.toLowerCase().includes('permission denied')) {
          permissionErrors.push(`${check.name}: ${error.message}`);
        }
      }
    }

    if (permissionErrors.length > 0) {
      return {
        success: false,
        isConfigured: true,
        hasTables: missingTables.length === 0,
        missingTables,
        permissionErrors,
        message: `Eroare de permisiuni RLS / GRANT detectată pe: ${permissionErrors.join('; ')}. Rulați migrarea SQL actualizată.`,
      };
    }

    if (missingTables.length > 0) {
      return {
        success: true,
        isConfigured: true,
        hasTables: false,
        missingTables,
        permissionErrors: [],
        message: `Conectat la Supabase! Atenție: Următoarele tabele/view-uri lipsesc și trebuie create rulând migrarea SQL: ${missingTables.join(', ')}.`,
      };
    }

    return {
      success: true,
      isConfigured: true,
      hasTables: true,
      missingTables: [],
      permissionErrors: [],
      message: 'Conexiune reușită! Toate tabelele Supabase, view-ul public_site_settings și politicile RLS sunt active și comunică normal.',
    };
  } catch (err: any) {
    return {
      success: false,
      isConfigured: true,
      message: `Eroare la conectare: ${err?.message || 'Verificați URL-ul și cheia publică.'}`,
    };
  }
}

