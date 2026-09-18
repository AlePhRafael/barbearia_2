"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  ApiError,
  Catalog,
  message,
  parseCatalog,
  parseOk,
  parseUser,
  request,
} from "@/lib/api";
type Booking = {
  services: string[];
  barber: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  note: string;
};
const blank: Booking = {
  services: [],
  barber: "",
  date: "",
  time: "",
  name: "",
  phone: "",
  note: "",
};
function useAppState() {
  const [booking, setBooking] = useState<Booking>(blank);
  const [catalog, setCatalog] = useState<Catalog>({
    services: [],
    barbers: [],
  });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [session, setSession] = useState(false);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const sessionRevision = useRef(0);
  const loadCatalog = useCallback(
    (signal?: AbortSignal) =>
      request("/api/catalog", parseCatalog, { signal })
        .then((data) => {
          if (signal?.aborted) return;
          setCatalog(data);
          setCatalogError("");
        })
        .catch((error) => {
          if (!signal?.aborted) setCatalogError(message(error));
        })
        .finally(() => {
          if (!signal?.aborted) setCatalogLoading(false);
        }),
    [],
  );
  const checkSession = useCallback((signal?: AbortSignal) => {
    const revision = ++sessionRevision.current;
    const current = () =>
      !signal?.aborted && revision === sessionRevision.current;
    return request("/api/auth/me", parseUser, { signal })
      .then(() => {
        if (!current()) return;
        setSession(true);
        setSessionError("");
      })
      .catch((error) => {
        if (!current()) return;
        setSession(false);
        setSessionError(
          error instanceof ApiError && error.status === 401
            ? ""
            : message(error),
        );
      })
      .finally(() => {
        if (current()) setReady(true);
      });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void loadCatalog(controller.signal);
    void checkSession(controller.signal);
    return () => controller.abort();
  }, [loadCatalog, checkSession]);
  const update = useCallback(
    (patch: Partial<Booking>) => setBooking((b) => ({ ...b, ...patch })),
    [],
  );
  const reset = () => setBooking({ ...blank });
  const login = async (username: string, password: string) => {
    sessionRevision.current++;
    await request("/api/auth/login", parseUser, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setSession(true);
    setSessionError("");
    setReady(true);
  };
  const logout = async () => {
    sessionRevision.current++;
    await request("/api/auth/logout", parseOk, { method: "POST" });
    setSession(false);
  };
  const expireSession = useCallback(() => setSession(false), []);
  const retryCatalog = () => {
    setCatalogLoading(true);
    setCatalogError("");
    return loadCatalog();
  };
  const retrySession = () => {
    setReady(false);
    setSessionError("");
    return checkSession();
  };
  const { services, barbers } = catalog;
  const selected = services.filter((s) => booking.services.includes(s.id));
  return {
    booking,
    update,
    reset,
    services,
    barbers,
    catalogLoading,
    catalogError,
    loadCatalog: retryCatalog,
    sessionError,
    checkSession: retrySession,
    expireSession,
    session,
    ready,
    login,
    logout,
    selected,
    total: selected.reduce((a, s) => a + s.priceCents, 0) / 100,
    duration: selected.reduce((a, s) => a + s.duration, 0),
  };
}
const AppContext = createContext<ReturnType<typeof useAppState> | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const value = useAppState();
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("AppProvider obrigatório");
  return context;
}
