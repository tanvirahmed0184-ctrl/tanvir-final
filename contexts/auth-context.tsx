"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthUser = Record<string, unknown> | null;

type AuthContextValue = {
  user: AuthUser;
  loading: boolean;
  refreshUser: () => Promise<void>;
};

type AuthProviderProps = {
  children: React.ReactNode;
};

let cachedUser: AuthUser | undefined;
let inflightUserRequest: Promise<AuthUser> | null = null;

function extractUser(payload: unknown): AuthUser {
  if (!payload || typeof payload !== "object") return null;
  const user = (payload as { user?: unknown }).user;
  if (!user || typeof user !== "object") return null;
  return user as Record<string, unknown>;
}

async function fetchUserWithCache(): Promise<AuthUser> {
  if (cachedUser !== undefined) {
    return cachedUser;
  }

  if (inflightUserRequest) {
    return inflightUserRequest;
  }

  inflightUserRequest = fetch("/api/auth/me", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) return null;
      const payload = (await res.json().catch(() => null)) as unknown;
      return extractUser(payload);
    })
    .catch(() => null)
    .finally(() => {
      inflightUserRequest = null;
    });

  const user = await inflightUserRequest;
  cachedUser = user;
  return user;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser>(cachedUser ?? null);
  const [loading, setLoading] = useState(cachedUser === undefined);

  useEffect(() => {
    let active = true;

    if (cachedUser !== undefined) {
      setUser(cachedUser);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    fetchUserWithCache()
      .then((nextUser) => {
        if (!active) return;
        setUser(nextUser);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const payload = res.ok
        ? ((await res.json().catch(() => null)) as unknown)
        : null;
      const nextUser = extractUser(payload);
      cachedUser = nextUser;
      setUser(nextUser);
    } catch {
      cachedUser = null;
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, refreshUser }),
    [user, loading, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
