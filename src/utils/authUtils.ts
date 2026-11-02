/**
 * Secure Authentication, Role Verification & Supabase Auth Integration
 * for ROXANA TEUSDE PFA (BUIE) Administrator
 */

import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

export interface AdminSession {
  token: string;
  username: string;
  role: 'admin';
  authProvider: 'supabase';
  createdAt: number;
  expiresAt: number;
}

export interface AuthAttemptLog {
  id: string;
  username: string;
  status: 'SUCCESS' | 'FAILED' | 'LOGOUT';
  timestamp: string;
  userAgent: string;
  city: string;
  failureReason?: string;
}

export const AUTH_CONFIG = {
  DEFAULT_ADMIN_USER: 'admin@roxanateusde.ro',
  SALT: 'roxana_buie_pfa_salt_2026',
  SESSION_STORAGE_KEY: 'rxt_admin_auth_session',
  AUDIT_STORAGE_KEY: 'rxt_auth_audit_logs',
  SESSION_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Hashes a plaintext string using SHA-256 with salt via Web Crypto API or Node crypto
 */
export async function hashPassword(password: string, salt = AUTH_CONFIG.SALT): Promise<string> {
  const salted = `${password}:::${salt}`;

  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const encoder = new TextEncoder();
    const data = encoder.encode(salted);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  try {
    const nodeCrypto = await import('node:crypto');
    return nodeCrypto.createHash('sha256').update(salted).digest('hex');
  } catch {
    let hash = 0;
    for (let i = 0; i < salted.length; i++) {
      hash = (hash << 5) - hash + salted.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Verifies a plaintext string against a stored SHA-256 hash
 */
export async function verifyPassword(password: string, storedHash: string, salt = AUTH_CONFIG.SALT): Promise<boolean> {
  if (!password || !storedHash) return false;
  const computed = await hashPassword(password, salt);
  return computed.toLowerCase() === storedHash.toLowerCase();
}

/**
 * Creates an authenticated session object
 */
export function createAdminSession(
  username: string,
  authProvider: 'supabase' = 'supabase',
  accessToken?: string
): AdminSession {
  const now = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return {
    token: accessToken || `rxt_sess_${now}_${randomSuffix}`,
    username: username.trim().toLowerCase(),
    role: 'admin',
    authProvider,
    createdAt: now,
    expiresAt: now + AUTH_CONFIG.SESSION_DURATION_MS,
  };
}

/**
 * Validates whether an admin session is currently active and not expired
 */
export function validateAdminSession(session: AdminSession | null | undefined): boolean {
  if (!session) return false;
  if (session.role !== 'admin') return false;
  if (!session.token || !session.username) return false;
  return Date.now() < session.expiresAt;
}

/**
 * Persists session in localStorage
 */
export function saveAdminSession(session: AdminSession): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(AUTH_CONFIG.SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('Could not store session in localStorage', err);
  }
}

/**
 * Retrieves persisted session from storage and validates expiration
 */
export function getStoredAdminSession(): AdminSession | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_CONFIG.SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session: AdminSession = JSON.parse(raw);
    if (validateAdminSession(session)) {
      return session;
    }
    clearAdminSession();
    return null;
  } catch {
    return null;
  }
}

/**
 * Clears stored admin session
 */
export function clearAdminSession(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(AUTH_CONFIG.SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn('Could not clear session', err);
  }
}

/**
 * Verifies in the database whether a Supabase Auth user has active administrator
 * privileges in `public.admin_users` via the `public.is_admin()` RPC or direct
 * `user_id` lookup. Never trusts unverified email addresses or stale JWT `app_metadata`.
 */
export async function verifyUserIsAdmin(user: {
  id?: string;
  email?: string;
} | null | undefined): Promise<boolean> {
  if (!user || !user.id) return false;

  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    return false;
  }

  try {
    // 1. Primary verification via SECURITY DEFINER function `public.is_admin()` in PostgreSQL
    const { data: rpcResult, error: rpcError } = await supabase.rpc('is_admin');
    if (!rpcError && typeof rpcResult === 'boolean') {
      return rpcResult;
    }

    // 2. Direct database verification on `public.admin_users` by `user_id = auth.uid()` and `active = true`
    const { data: adminRow, error: tableError } = await supabase
      .from('admin_users')
      .select('user_id, role, active')
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle();

    if (!tableError && adminRow) {
      return adminRow.role === 'admin' || adminRow.role === 'super_admin';
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Checks if there is an active, database-verified Supabase Auth admin session
 */
export async function checkActiveAdminSession(): Promise<{ isLoggedIn: boolean; email?: string }> {
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data?.session?.user) {
        const isVerifiedAdmin = await verifyUserIsAdmin(data.session.user);
        if (!isVerifiedAdmin) {
          clearAdminSession();
          return { isLoggedIn: false };
        }
        const email = data.session.user.email || AUTH_CONFIG.DEFAULT_ADMIN_USER;
        const sessionObj = createAdminSession(email, 'supabase', data.session.access_token);
        saveAdminSession(sessionObj);
        return { isLoggedIn: true, email };
      }
      clearAdminSession();
      return { isLoggedIn: false };
    } catch {
      clearAdminSession();
      return { isLoggedIn: false };
    }
  }

  clearAdminSession();
  return { isLoggedIn: false };
}

/**
 * Authenticates the administrator exclusively via Supabase Auth (`signInWithPassword`)
 * and verifies their active administrator role in the database (`public.admin_users` / `public.is_admin()`).
 * Contains no hardcoded passwords and no email-only or local bypasses.
 */
export async function authenticateAdmin(
  emailOrUser: string,
  password: string
): Promise<{ success: boolean; error?: string; session?: AdminSession }> {
  const cleanInput = emailOrUser.trim().toLowerCase();
  const normalizedEmail = cleanInput.includes('@') ? cleanInput : `${cleanInput}@roxanateusde.ro`;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser';

  if (!cleanInput || !password || !password.trim()) {
    return {
      success: false,
      error: 'Introduceți adresa de email și parola contului de administrator Supabase Auth.',
    };
  }

  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    await logAuthAttempt({
      username: normalizedEmail,
      status: 'FAILED',
      userAgent,
      city: 'Tileagd, Bihor',
      failureReason: 'Supabase nu este configurat (lipsesc VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)',
    });
    return {
      success: false,
      error: 'Conexiunea Supabase nu este configurată. Verificați variabilele VITE_SUPABASE_URL și VITE_SUPABASE_ANON_KEY.',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: password.trim(),
    });

    if (error || !data?.session?.user) {
      await logAuthAttempt({
        username: normalizedEmail,
        status: 'FAILED',
        userAgent,
        city: 'Tileagd, Bihor',
        failureReason: error?.message || 'Supabase Auth: Date de autentificare invalide',
      });

      return {
        success: false,
        error:
          error?.message === 'Invalid login credentials'
            ? 'Email sau parolă incorectă în Supabase Auth.'
            : `Autentificare eșuată: ${error?.message || 'Credențiale invalide'}`,
      };
    }

    // Verify in the database (`public.is_admin()` / `public.admin_users` by `user_id`)
    const isVerifiedAdmin = await verifyUserIsAdmin(data.session.user);
    if (!isVerifiedAdmin) {
      await logAuthAttempt({
        username: data.session.user.email || normalizedEmail,
        status: 'FAILED',
        userAgent,
        city: 'Tileagd, Bihor',
        failureReason: 'Acces refuzat: Utilizatorul nu este asociat sau activ în public.admin_users',
      });
      await supabase.auth.signOut();
      clearAdminSession();

      return {
        success: false,
        error:
          'Acces interzis: Contul există în Supabase Auth, dar nu este autorizat sau activ în tabelul public.admin_users.',
      };
    }

    const adminSession = createAdminSession(
      data.session.user.email || normalizedEmail,
      'supabase',
      data.session.access_token
    );
    saveAdminSession(adminSession);

    await logAuthAttempt({
      username: data.session.user.email || normalizedEmail,
      status: 'SUCCESS',
      userAgent,
      city: 'Tileagd, Bihor',
    });

    return {
      success: true,
      session: adminSession,
    };
  } catch (err: any) {
    await logAuthAttempt({
      username: normalizedEmail,
      status: 'FAILED',
      userAgent,
      city: 'Tileagd, Bihor',
      failureReason: err?.message || 'Eroare rețea Supabase Auth',
    });
    return {
      success: false,
      error: `Eroare la conectarea cu Supabase Auth: ${err?.message || 'Reîncercați.'}`,
    };
  }
}

/**
 * Signs out the administrator from Supabase Auth and clears local session.
 * Logs LOGOUT before terminating the Supabase Auth session so RLS (`public.is_admin()`) permits the audit entry.
 */
export async function signOutAdmin(): Promise<void> {
  const current = getStoredAdminSession();
  const supabase = getSupabase();

  if (current?.username) {
    await logAuthAttempt({
      username: current.username,
      status: 'LOGOUT',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser',
      city: 'Tileagd, Bihor',
    });
  }

  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase signOut warning:', err);
    }
  }

  clearAdminSession();
}

/**
 * Logs an authentication attempt (SUCCESS, FAILED, LOGOUT) to Supabase and Local Storage audit table
 */
export async function logAuthAttempt(attempt: Omit<AuthAttemptLog, 'id' | 'timestamp'>): Promise<AuthAttemptLog> {
  const fullLog: AuthAttemptLog = {
    ...attempt,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `auth-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('admin_auth_audit').insert({
        username: fullLog.username,
        status: fullLog.status,
        timestamp: fullLog.timestamp,
        user_agent: fullLog.userAgent,
        city: fullLog.city,
        failure_reason:
          fullLog.status === 'FAILED'
            ? fullLog.failureReason || 'Autentificare eșuată'
            : fullLog.failureReason || null,
      });
    } catch (err) {
      console.warn('Could not write auth audit to Supabase, saving locally', err);
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(AUTH_CONFIG.AUDIT_STORAGE_KEY);
      const logs: AuthAttemptLog[] = raw ? JSON.parse(raw) : [];
      window.localStorage.setItem(AUTH_CONFIG.AUDIT_STORAGE_KEY, JSON.stringify([fullLog, ...logs.slice(0, 100)]));
    } catch {
      // Ignore storage write issues
    }
  }

  return fullLog;
}

/**
 * Retrieves the security audit logs from Supabase or Local Storage
 */
export async function getAuthAuditLogs(): Promise<AuthAttemptLog[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('admin_auth_audit')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data)) {
        return data.map((d: any) => ({
          id: d.id,
          username: d.username,
          status: d.status,
          timestamp: d.timestamp,
          userAgent: d.user_agent || d.userAgent || '',
          city: d.city || 'Tileagd, Bihor',
          failureReason: d.failure_reason || d.failureReason,
        }));
      }
    } catch {
      // Fallback
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(AUTH_CONFIG.AUDIT_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Fallback
    }
  }

  return [];
}
