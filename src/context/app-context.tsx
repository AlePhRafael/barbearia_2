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
  Appointment,
  BookingDraft,
  Catalog,
  message,
  parseCatalog,
  parseAppointment,
  parseOk,
  parseUser,
  request,
} from "@/lib/api";
type Booking = BookingDraft;
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
  const [step, setStep] = useState(0);
  const [bookingError, setBookingError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const submitting = useRef(false);
  const preselected = useRef(false);
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
  const preselectService = useCallback((id: string) => {
    if (preselected.current || submitting.current || attempt.current) return;
    preselected.current = true;
    setBooking((draft) =>
      draft.services.length ? draft : { ...draft, services: [id] },
    );
  }, []);
  const reset = () => {
    if (submitting.current) return;
    setBooking({ ...blank });
    setStep(0);
    setBookingError("");
    setFieldErrors({});
    setConfirmed(null);
    attempt.current = null;
    preselected.current = true;
  };
  const confirm = async () => {
    if (submitting.current || confirmed) return;
    submitting.current = true;
    setPending(true);
    setBookingError("");
    setFieldErrors({});
    const body = JSON.stringify(booking);
    if (!attempt.current || attempt.current.body !== body)
      attempt.current = { body, key: crypto.randomUUID() };
    try {
      const appointment = await request("/api/appointments", parseAppointment, {
        method: "POST",
        body,
        headers: { "Idempotency-Key": attempt.current.key },
      });
      setConfirmed(appointment);
      setStep(4);
    } catch (error) {
      setBookingError(message(error));
      if (error instanceof ApiError) {
        setFieldErrors(error.fields);
        if (error.code === "invalid_services" || error.fields.services)
          setStep(0);
        else if (error.code === "invalid_barber" || error.fields.barber)
          setStep(1);
        else if (
          error.code === "invalid_schedule" ||
          error.code === "slot_unavailable" ||
          error.fields.date ||
          error.fields.time
        ) {
          update({ time: "" });
          setStep(2);
          setAvailabilityRevision((n) => n + 1);
        } else if (
          ["name", "phone", "note"].some((field) => error.fields[field])
        )
          setStep(3);
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
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
    step,
    setStep,
    bookingError,
    setBookingError,
    fieldErrors,
    setFieldErrors,
    pending,
    confirmed,
    confirm,
    preselectService,
    availabilityRevision,
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
