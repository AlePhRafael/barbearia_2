"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Scissors,
  Clock,
  CalendarDays,
  User,
  ChevronLeft,
  ChevronRight,
  Star,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "@/context/app-context";
import {
  money,
  dateKey,
  prettyDate,
  slots,
  barberImages,
  shopDate,
} from "@/data/presentation";
import {
  ApiError,
  Appointment,
  message,
  parseAppointment,
  parseSlots,
  request,
} from "@/lib/api";
const steps = [
  "Serviços",
  "Profissional",
  "Data e horário",
  "Seus dados",
  "Confirmação",
];
export default function Booking() {
  const {
    booking,
    update,
    reset,
    selected,
    total,
    duration,
    services,
    barbers,
    catalogLoading,
    catalogError,
    loadCatalog,
  } = useApp();
  const [step, setStep] = useState(0);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);
  const [availability, setAvailability] = useState<{
    key: string;
    slots: string[];
  }>({ key: "", slots: [] });
  const [availabilityError, setAvailabilityError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const submitting = useRef(false);
  const preselected = useRef(false);
  const availabilityKey = JSON.stringify([
    booking.services,
    booking.barber,
    booking.date,
    refresh,
  ]);
  useEffect(() => {
    if (!booking.date || !booking.barber || !booking.services.length) return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      date: booking.date,
      barber: booking.barber,
    });
    booking.services.forEach((id) => query.append("services", id));
    request(`/api/availability?${query}`, parseSlots, {
      signal: controller.signal,
    })
      .then((slots) => {
        if (!controller.signal.aborted) {
          setAvailability({ key: availabilityKey, slots });
          setAvailabilityError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setAvailability({ key: availabilityKey, slots: [] });
          setAvailabilityError(message(error));
        }
      });
    return () => controller.abort();
  }, [availabilityKey, booking.date, booking.barber, booking.services]);
  useEffect(() => {
    if (preselected.current || !services.length) return;
    preselected.current = true;
    const id = new URLSearchParams(window.location.search).get("servico");
    if (id && services.some((s) => s.id === id))
      update({ services: [id], time: "" });
  }, [update, services]);
  const today = shopDate();
  const available = (time: string) =>
    availability.key === availabilityKey && availability.slots.includes(time);
  const toggle = (id: string) => {
    let ids = booking.services.includes(id)
      ? booking.services.filter((s) => s !== id)
      : [...booking.services, id];
    if (id === "combo" && ids.includes("combo"))
      ids = ids.filter((s) => !["corte", "barba"].includes(s));
    if (["corte", "barba"].includes(id) && ids.includes(id))
      ids = ids.filter((s) => s !== "combo");
    update({ services: ids, time: "" });
  };
  const next = () => {
    setError("");
    if (step === 0 && !selected.length)
      return setError("Selecione pelo menos um serviço.");
    if (step === 1 && !booking.barber)
      return setError("Escolha um profissional ou selecione sem preferência.");
    if (
      step === 2 &&
      (!booking.date || !booking.time || !available(booking.time))
    )
      return setError("Escolha uma data e um horário disponível.");
    setStep((s) => s + 1);
  };
  const confirm = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
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
      update({ barber: appointment.barber });
      setCode(appointment.id);
    } catch (error) {
      setError(message(error));
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 422)
      ) {
        update({ time: "" });
        setStep(2);
        setRefresh((n) => n + 1);
        attempt.current = null;
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const summaryServices = confirmed
    ? confirmed.items.map((item) => ({ ...item, price: item.priceCents / 100 }))
    : selected;
  const summaryDuration = confirmed?.duration ?? duration;
  return (
    <main className="booking-page">
      <div className="progress-bar">
        <div className="container steps">
          {steps.map((label, i) => (
            <button
              key={label}
              disabled={i > step || !!code || pending}
              className={i === step ? "current" : i < step ? "complete" : ""}
              onClick={() => {
                setStep(i);
                setError("");
              }}
            >
              <span>{i < step ? <Check size={14} /> : i + 1}</span>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="container booking-layout">
        <section className="booking-main">
          <Link href="/" className="back-link">
            <ArrowLeft size={15} /> Voltar para início
          </Link>
          <span className="eyebrow">SEU MOMENTO COMEÇA AQUI · 0{step + 1}</span>
          <h1>
            {
              [
                "Qual vai ser o ritual?",
                "Quem cuida do seu estilo?",
                "Um tempo só pra você.",
                "Vamos nos conhecer? ",
                code
                  ? "Seu horário está reservado."
                  : "Tudo pronto para agendar?",
              ][step]
            }
          </h1>
          <p className="page-description">
            {
              [
                "Selecione um ou mais serviços para montar sua experiência.",
                "Escolha seu barbeiro favorito ou deixe com a gente.",
                "Escolha o melhor dia e horário para sua visita.",
                "Só precisamos de alguns detalhes para receber você. ",
                code
                  ? "Esperamos você na Vértice. Até lá!"
                  : "Confira os detalhes e finalize sua reserva.",
              ][step]
            }
          </p>
          {step === 0 && (
            <div className="booking-services">
              {catalogLoading && <p role="status">Carregando serviços…</p>}
              {catalogError && (
                <div role="alert">
                  <p>{catalogError}</p>
                  <button
                    className="button outline"
                    onClick={() => void loadCatalog()}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
              {!catalogLoading && !catalogError && !services.length && (
                <p>Nenhum serviço disponível.</p>
              )}
              {services.map((s) => (
                <button
                  aria-pressed={booking.services.includes(s.id)}
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={`select-card ${booking.services.includes(s.id) ? "selected" : ""}`}
                >
                  <span className="service-icon">
                    <Scissors size={22} />
                  </span>
                  <div>
                    <h3>{s.name}</h3>
                    <p>{s.description}</p>
                    <span className="muted inline-flex items-center gap-2">
                      <Clock size={13} />
                      {s.duration} min
                    </span>
                  </div>
                  <strong>{money(s.price)}</strong>
                  <span className="selection-box">
                    {booking.services.includes(s.id) && <Check size={14} />}
                  </span>
                </button>
              ))}
            </div>
          )}
          {step === 1 && (
            <div className="barber-options">
              {barbers.map((b) => (
                <button
                  key={b.id}
                  aria-pressed={booking.barber === b.id}
                  className={`select-card barber-option ${booking.barber === b.id ? "selected" : ""}`}
                  onClick={() => update({ barber: b.id, time: "" })}
                >
                  {barberImages[b.id] && (
                    <Image
                      src={barberImages[b.id]}
                      width={90}
                      height={95}
                      alt={b.name}
                    />
                  )}
                  <div>
                    <h3>{b.name}</h3>
                    <p>{b.specialty}</p>
                    <span className="gold inline-flex items-center gap-1">
                      <Star size={13} />
                      {b.rating}
                    </span>
                  </div>
                  <span className="selection-box">
                    {booking.barber === b.id && <Check size={14} />}
                  </span>
                </button>
              ))}
              <button
                className={`select-card ${booking.barber === "any" ? "selected" : ""}`}
                onClick={() => update({ barber: "any", time: "" })}
              >
                <User className="gold" />
                <div>
                  <h3>Sem preferência</h3>
                  <p>O primeiro profissional disponível cuida de você.</p>
                </div>
                <span className="selection-box">
                  {booking.barber === "any" && <Check size={14} />}
                </span>
              </button>
            </div>
          )}
          {step === 2 && (
            <div>
              <div className="calendar panel">
                <div className="calendar-title">
                  <button
                    aria-label="Mês anterior"
                    disabled={
                      month.getFullYear() === new Date().getFullYear() &&
                      month.getMonth() === new Date().getMonth()
                    }
                    onClick={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() - 1, 1),
                      )
                    }
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <h3>
                    {month.toLocaleDateString("pt-BR", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h3>
                  <button
                    aria-label="Próximo mês"
                    onClick={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() + 1, 1),
                      )
                    }
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>
                <div className="calendar-grid">
                  {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                    <span key={i}>{d}</span>
                  ))}
                  {Array.from({ length: month.getDay() }, (_, i) => (
                    <span key={"blank" + i} />
                  ))}
                  {Array.from({ length: days }, (_, i) => {
                    const d = new Date(
                        month.getFullYear(),
                        month.getMonth(),
                        i + 1,
                      ),
                      key = dateKey(d);
                    return (
                      <button
                        key={key}
                        disabled={key < today || d.getDay() === 0}
                        className={booking.date === key ? "selected" : ""}
                        onClick={() => update({ date: key, time: "" })}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
                <p className="muted">Domingos: nossa pausa para recarregar.</p>
              </div>
              <h3 className="mt-7 mb-4">Horários disponíveis</h3>
              {booking.date && availability.key !== availabilityKey && (
                <p role="status">Consultando horários…</p>
              )}
              {availabilityError && (
                <div role="alert">
                  <p>{availabilityError}</p>
                  <button
                    className="button outline"
                    onClick={() => setRefresh((n) => n + 1)}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
              {booking.date &&
                availability.key === availabilityKey &&
                !availabilityError &&
                !availability.slots.length && (
                  <p>Nenhum horário disponível neste dia.</p>
                )}
              {booking.date ? (
                <>
                  <div className="time-grid">
                    {slots.map((t) => (
                      <button
                        disabled={!available(t)}
                        className={booking.time === t ? "selected" : ""}
                        key={t}
                        onClick={() => update({ time: t })}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="muted mt-3">
                    Horários esgotados ou encerrados aparecem desabilitados.
                  </p>
                </>
              ) : (
                <p className="empty-state">
                  Selecione um dia no calendário para ver os horários.
                </p>
              )}
            </div>
          )}
          {step === 3 && (
            <form
              id="customer-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (booking.name.trim().length < 3) {
                  setError("Informe seu nome completo.");
                  return;
                }
                if (!/^\d{10,11}$/.test(booking.phone.replace(/\D/g, ""))) {
                  setError("Informe um telefone válido com DDD.");
                  return;
                }
                next();
              }}
              className="customer-form"
            >
              <label>
                Nome completo <span>*</span>
                <input
                  required
                  minLength={3}
                  autoComplete="name"
                  placeholder="Como podemos chamar você?"
                  value={booking.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <label>
                Celular com DDD <span>*</span>
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  placeholder="(11) 99999-9999"
                  value={booking.phone}
                  onChange={(e) => update({ phone: e.target.value })}
                />
              </label>
              <label>
                Alguma observação? <small>Opcional</small>
                <textarea
                  maxLength={500}
                  rows={4}
                  placeholder="Preferências de corte ou algo que devemos saber…"
                  value={booking.note}
                  onChange={(e) => update({ note: e.target.value })}
                />
              </label>
              <p className="muted inline-flex gap-2">
                <ShieldCheck size={17} /> Seus dados são usados apenas para este
                agendamento.
              </p>
            </form>
          )}
          {step === 4 && (
            <div className="confirmation panel">
              {code ? (
                <>
                  <CheckCircle2 size={52} className="gold" />
                  <h2>Nos vemos na cadeira.</h2>
                  <p>Seu código de agendamento</p>
                  <strong className="booking-code">{code}</strong>
                </>
              ) : (
                <Scissors size={36} className="gold" />
              )}
              <dl>
                <div>
                  <dt>Cliente</dt>
                  <dd>{booking.name}</dd>
                </div>
                <div>
                  <dt>Contato</dt>
                  <dd>{booking.phone}</dd>
                </div>
                <div>
                  <dt>Serviços</dt>
                  <dd>
                    {(confirmed?.items || selected)
                      .map((s) => s.name)
                      .join(", ")}
                  </dd>
                </div>
                <div>
                  <dt>Profissional</dt>
                  <dd>
                    {barbers.find((b) => b.id === booking.barber)?.name ||
                      "Sem preferência"}
                  </dd>
                </div>
                <div>
                  <dt>Quando</dt>
                  <dd>
                    {prettyDate(booking.date)} às {booking.time}
                  </dd>
                </div>
                {booking.note && (
                  <div>
                    <dt>Observação</dt>
                    <dd>{booking.note}</dd>
                  </div>
                )}
                <div>
                  <dt>Total · {confirmed?.duration ?? duration} min</dt>
                  <dd className="gold">
                    {money(confirmed ? confirmed.totalCents / 100 : total)}
                  </dd>
                </div>
              </dl>
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="flow-actions">
            {step > 0 && !code && (
              <button
                className="button outline"
                disabled={pending}
                onClick={() => {
                  setStep((s) => s - 1);
                  setError("");
                }}
              >
                <ArrowLeft size={16} /> Voltar
              </button>
            )}
            {step < 4 ? (
              <button
                className="button"
                disabled={catalogLoading || !!catalogError}
                type={step === 3 ? "submit" : "button"}
                form={step === 3 ? "customer-form" : undefined}
                onClick={step === 3 ? undefined : next}
              >
                Continuar <ArrowRight size={17} />
              </button>
            ) : code ? (
              <>
                <Link href="/" className="button outline">
                  Voltar ao início
                </Link>
                <button
                  className="button"
                  onClick={() => {
                    reset();
                    setCode("");
                    setConfirmed(null);
                    attempt.current = null;
                    setStep(0);
                  }}
                >
                  Novo agendamento <ArrowRight size={17} />
                </button>
              </>
            ) : (
              <button
                className="button"
                onClick={() => void confirm()}
                disabled={pending}
              >
                {pending ? "Confirmando…" : "Confirmar agendamento"}{" "}
                <Check size={17} />
              </button>
            )}
          </div>
        </section>
        <aside className="booking-summary panel">
          <span className="eyebrow">CUIDADO EM CADA DETALHE</span>
          <h3>Seu agendamento</h3>
          <div className="summary-services">
            {summaryServices.length ? (
              summaryServices.map((s) => (
                <div key={s.id}>
                  <span>
                    {s.name}
                    <small>{s.duration} minutos</small>
                  </span>
                  <strong>{money(s.price)}</strong>
                </div>
              ))
            ) : (
              <p className="muted">
                Seu ritual começa com a escolha dos serviços.
              </p>
            )}
          </div>
          <div className="summary-line">
            <User size={17} />
            <span>
              {barbers.find((b) => b.id === booking.barber)?.name ||
                (booking.barber === "any"
                  ? "Sem preferência"
                  : "Escolha seu profissional")}
            </span>
          </div>
          <div className="summary-line">
            <CalendarDays size={17} />
            <span>{prettyDate(booking.date)}</span>
          </div>
          <div className="summary-line">
            <Clock size={17} />
            <span>
              {booking.time || "Escolha um horário"}
              {summaryDuration > 0 && ` · ${summaryDuration} min`}
            </span>
          </div>
          <div className="summary-total">
            <span>Total estimado</span>
            <strong>
              {money(confirmed ? confirmed.totalCents / 100 : total)}
            </strong>
          </div>
          <p className="summary-note">
            <ShieldCheck size={16} /> Pagamento no local, após o atendimento.
          </p>
          <div className="summary-brand">
            VÉRTICE <span>SEU ESTILO EM OUTRO NÍVEL.</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
