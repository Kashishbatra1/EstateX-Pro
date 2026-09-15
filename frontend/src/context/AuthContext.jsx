import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loginRequest, logoutRequest, meRequest } from "../api/auth.js";
import {
  clearStoredSession,
  getStoredAdmin,
  getStoredToken,
  setStoredSession,
  UNAUTH_EVENT,
} from "../api/client.js";

const AuthContext = createContext(null);
const BOOTSTRAP_MS = 5000;

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [admin, setAdmin] = useState(() => getStoredAdmin());
  const [bootstrapping, setBootstrapping] = useState(true);

  const clearAuthState = useCallback(() => {
    clearStoredSession();
    setToken(null);
    setAdmin(null);
  }, []);

  useEffect(() => {
    function onUnauthorized() {
      clearAuthState();
    }
    window.addEventListener(UNAUTH_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTH_EVENT, onUnauthorized);
  }, [clearAuthState]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function bootstrap() {
      const existing = getStoredToken();
      if (!existing) {
        if (!cancelled) {
          clearAuthState();
          setBootstrapping(false);
        }
        return;
      }

      const timeoutId = setTimeout(() => controller.abort(), BOOTSTRAP_MS);

      try {
        const profile = await meRequest({ signal: controller.signal });
        if (cancelled) return;
        if (!profile?.id) {
          clearAuthState();
          return;
        }
        setToken(existing);
        setAdmin(profile);
        setStoredSession(existing, profile);
      } catch {
        if (!cancelled) clearAuthState();
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setBootstrapping(false);
      }
    }

    bootstrap();

    // Absolute safety net: never leave the app stuck on the boot spinner
    const hardStop = setTimeout(() => {
      if (!cancelled) {
        setBootstrapping(false);
      }
    }, BOOTSTRAP_MS + 1500);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(hardStop);
    };
  }, [clearAuthState]);

  const login = useCallback(async (email, password) => {
    const data = await loginRequest(email, password);
    if (!data?.token || !data?.admin) {
      throw new Error("Login response was incomplete. Please try again.");
    }
    setStoredSession(data.token, data.admin);
    setToken(data.token);
    setAdmin(data.admin);
    return data.admin;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getStoredToken()) {
        await logoutRequest();
      }
    } catch {
      // Still clear local session if API logout fails
    } finally {
      clearAuthState();
    }
  }, [clearAuthState]);

  const value = useMemo(
    () => ({
      token,
      admin,
      isAuthenticated: Boolean(token && admin),
      bootstrapping,
      login,
      logout,
    }),
    [token, admin, bootstrapping, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
