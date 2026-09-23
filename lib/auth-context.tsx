"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createSupabaseBrowserClient } from "./supabase";

export type AgencyContext = {
  id: string;
  name: string;
  slug: string;
};

export type ActorContext = {
  actorId: string;
  agencyId: string;
  role: "owner" | "admin" | "operator" | "viewer";
  email: string;
};

type AuthState = {
  userEmail: string | null;
  actor: ActorContext | null;
  agency: AgencyContext | null;
  loading: boolean;
  needsOnboarding: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (agencyName: string) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthState>({
  userEmail: null,
  actor: null,
  agency: null,
  loading: true,
  needsOnboarding: false,
  refreshAuth: async () => {},
  signOut: async () => {},
  completeOnboarding: async () => ({ success: false }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [actor, setActor] = useState<ActorContext | null>(null);
  const [agency, setAgency] = useState<AgencyContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const fetchActor = useCallback(async (token?: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/auth/actor", { headers });
      if (!res.ok) {
        setUserEmail(null);
        setActor(null);
        setAgency(null);
        setNeedsOnboarding(false);
        return;
      }

      const data = await res.json();
      if (data.authenticated) {
        setUserEmail(data.email);
        if (data.needsOnboarding) {
          setNeedsOnboarding(true);
          setActor(null);
          setAgency(null);
        } else {
          setNeedsOnboarding(false);
          setActor({
            actorId: data.actorId,
            agencyId: data.agencyId,
            role: data.role,
            email: data.email,
          });
          setAgency({
            id: data.agencyId,
            name: data.agencyName,
            slug: data.agencySlug ?? "agencia",
          });
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await fetchActor(session?.access_token);
        return;
      }
    } catch {
      // Fallback
    }
    await fetchActor();
  }, [fetchActor]);

  useEffect(() => {
    let mounted = true;
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        void fetchActor();
        return () => {
          mounted = false;
        };
      }

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!mounted) return;
        void fetchActor(session?.access_token);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        void fetchActor(session?.access_token);
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    } catch {
      void fetchActor();
      return () => {
        mounted = false;
      };
    }
  }, [fetchActor]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch {
      // Ignore
    }
    setUserEmail(null);
    setActor(null);
    setAgency(null);
    setNeedsOnboarding(false);
    window.location.reload();
  }, []);

  const completeOnboarding = useCallback(
    async (agencyName: string) => {
      try {
        const supabase = createSupabaseBrowserClient();
        const session = supabase
          ? (await supabase.auth.getSession()).data.session
          : null;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        const res = await fetch("/api/auth/onboard-agency", {
          method: "POST",
          headers,
          body: JSON.stringify({ name: agencyName }),
        });

        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error ?? "Erro ao criar agência." };
        }

        await refreshAuth();
        return { success: true };
      } catch {
        return { success: false, error: "Erro na conexão com o servidor." };
      }
    },
    [refreshAuth],
  );

  return (
    <AuthContext.Provider
      value={{
        userEmail,
        actor,
        agency,
        loading,
        needsOnboarding,
        refreshAuth,
        signOut,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
