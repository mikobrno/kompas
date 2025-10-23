/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { mintDevJwt } from '../lib/devJwt';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  theme: 'light' | 'dark';
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  impersonatedUserId?: string | null;
  clearImpersonation: () => void;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const sessionRefreshTimeoutRef = useRef<number | null>(null);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  };

  const ensureProfileExists = useCallback(async (u: User) => {
    // Zkus načíst profil, a pokud neexistuje, vytvoř ho
    const existing = await fetchProfile(u.id);
    if (existing) return existing as UserProfile;

    const meta: Record<string, unknown> | undefined = (u as unknown as { user_metadata?: Record<string, unknown> }).user_metadata;
    const metaFullName = typeof meta?.full_name === 'string' ? (meta.full_name as string) : undefined;
    const metaName = typeof meta?.name === 'string' ? (meta.name as string) : undefined;
    const fallbackName = metaFullName || metaName || (u.email ? u.email.split('@')[0] : 'Uživatel');

    const { error: insertErr } = await supabase
      .from('users')
      .insert({
        id: u.id,
        email: u.email || '',
        full_name: fallbackName,
        role: 'user',
        theme: 'light',
      });
    if (insertErr) {
      // Může nastat závod / RLS, zkusíme načíst ještě jednou
      console.warn('Profile insert failed (will retry fetch):', insertErr.message);
    }
    const created = await fetchProfile(u.id);
    return created as UserProfile | null;
  }, []);

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    const storedImpersonation = localStorage.getItem('impersonateUserId');
    if (storedImpersonation) setImpersonatedUserId(storedImpersonation);
    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const profileData = await ensureProfileExists(session.user);
          setProfile(profileData);
        }
        setLoading(false);
      })();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const profileData = await ensureProfileExists(session.user);
          setProfile(profileData);
        } else {
          setProfile(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, [ensureProfileExists]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const clearScheduledRefresh = () => {
      if (sessionRefreshTimeoutRef.current != null) {
        window.clearTimeout(sessionRefreshTimeoutRef.current);
        sessionRefreshTimeoutRef.current = null;
      }
    };

    const scheduleRefresh = async () => {
      const { data } = await supabase.auth.getSession();
      const activeSession = data.session;
      if (!activeSession) {
        clearScheduledRefresh();
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = activeSession.expires_at ?? now + 3600;
      const refreshInSeconds = Math.max(expiresAt - now - 120, 300);

      clearScheduledRefresh();
      sessionRefreshTimeoutRef.current = window.setTimeout(async () => {
        const { data: refreshed, error } = await supabase.auth.refreshSession();
        if (error) {
          console.warn('Session auto-refresh failed:', error.message);
          return;
        }
        if (refreshed.session) {
          setSession(refreshed.session);
          setUser(refreshed.session.user);
          const profileData = await ensureProfileExists(refreshed.session.user);
          setProfile(profileData);
        }
        scheduleRefresh();
      }, refreshInSeconds * 1000);
    };

    if (user) {
      scheduleRefresh();
    } else {
      clearScheduledRefresh();
    }

    return () => {
      clearScheduledRefresh();
    };
  }, [user, ensureProfileExists]);

  const signIn = async (email: string, password: string) => {
    // Dev fallback: pokud místní GoTrue selže (např. Database error querying schema),
    // umožníme přihlášení mintnutím JWT a nastavením session manuálně.
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return { error: null };

  if (import.meta.env.DEV && email === 'kost@adminreal.cz' && password === 'milan123') {
      try {
  const jwtSecret = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_SUPABASE_JWT_SECRET;
        if (!jwtSecret) return { error };

  // Zjistíme userId pomocí SECURITY DEFINER RPC, aby nás neblokovalo RLS
  const { data: userId } = await supabase.rpc('dev_get_user_id_by_email', { p_email: email });
        if (!userId) return { error };

        const access_token = await mintDevJwt({ jwtSecret, userId, email });
  const refresh_token = await mintDevJwt({ jwtSecret, userId, email, expiresInSeconds: 60 * 60 * 24 * 30 });
        const { error: setSessionError } = await supabase.auth.setSession({ access_token, refresh_token });
        if (setSessionError) {
          console.error('Dev fallback setSession failed', setSessionError.message);
          return { error };
        }
        return { error: null };
      } catch (fallbackErr) {
        console.error('Dev fallback failed', fallbackErr);
        return { error };
      }
    }
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) return { error };

    if (data.user) {
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email,
          full_name: fullName,
          role: 'user',
          theme: 'light',
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setImpersonatedUserId(null);
    localStorage.removeItem('impersonateUserId');
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }

    await refreshProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        impersonatedUserId,
        clearImpersonation: () => { setImpersonatedUserId(null); localStorage.removeItem('impersonateUserId'); },
        signIn,
        signUp,
        signOut,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
