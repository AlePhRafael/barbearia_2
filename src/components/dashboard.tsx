"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Users,
  ChartNoAxesCombined,
  LogOut,
  ArrowUpRight,
  Clock,
  Scissors,
  Search,
} from "lucide-react";
import { useApp } from "@/context/app-context";
import {
  money,
  dateKey,
  prettyDate,
  slots,
  shopDate,
} from "@/data/presentation";
import {
  ApiError,
  Appointment,
  Status,
  message,
  parseAgenda,
  parseAppointment,
  request,
} from "@/lib/api";
const statuses: Status[] = [
  "confirmado",
  "em atendimento",
  "concluído",
  "cancelado",
];
const value = (a: Appointment) => a.totalCents / 100;
export default function Dashboard() {
  const {
    session,
    ready,
    logout,
    barbers,
    sessionError,
    checkSession,
    expireSession,
    catalogError,
    loadCatalog,
  } = useApp();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState("");
  const [refresh, setRefresh] = useState(0);
  const router = useRouter();
  const [tab, setTab] = useState("agenda");
  const [date, setDate] = useState(shopDate);
  const [barber, setBarber] = useState("all");
  const [query, setQuery] = useState("");
  const agendaKey = JSON.stringify([date, barber, refresh]);
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const previous = new Date(date + "T12:00:00");
    previous.setDate(previous.getDate() - 1);
    const params = new URLSearchParams({ start: dateKey(previous), end: date });
    if (barber !== "all") params.set("barber", barber);
    request(`/api/appointments?${params}`, parseAgenda, {
      signal: controller.signal,
    })
      .then((rows) => {
        if (!controller.signal.aborted) {
          setAppointments(rows);
          setLoadedKey(agendaKey);
          setError("");
          setLoadFailed(false);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setAppointments([]);
          setError(message(error));
          setLoadedKey(agendaKey);
          setLoadFailed(true);
          if (error instanceof ApiError && error.status === 401)
            expireSession();
        }
      });
    return () => controller.abort();
  }, [session, date, barber, refresh, agendaKey, expireSession]);
  const changeStatus = async (id: string, status: Status) => {
    if (pending) return;
    setPending(id);
    setError("");
    try {
      await request(`/api/appointments/${id}/status`, parseAppointment, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setRefresh((n) => n + 1);
    } catch (error) {
      setError(message(error));
      if (error instanceof ApiError && error.status === 401) {
        setAppointments([]);
        expireSession();
      }
    } finally {
      setPending("");
    }
  };
  useEffect(() => {
    if (ready && !session && !sessionError) router.replace("/login");
  }, [session, ready, sessionError, router]);
  if (sessionError)
    return (
      <main className="container loading">
        <p role="alert">{sessionError}</p>
        <button className="button" onClick={() => void checkSession()}>
          Tentar novamente
        </button>
      </main>
    );
  if (!ready || !session)
    return <main className="container loading">Verificando sessão…</main>;
  const currentAppointments = loadedKey === agendaKey ? appointments : [];
  const daily = currentAppointments
    .filter((a) => a.date === date && (barber === "all" || a.barber === barber))
    .sort((a, b) => a.time.localeCompare(b.time));
  const done = daily.filter((a) => a.status === "concluído");
  const revenue = done.reduce((n, a) => n + value(a), 0);
  const yesterday = new Date(date + "T12:00:00");
  yesterday.setDate(yesterday.getDate() - 1);
  const previous = currentAppointments
    .filter(
      (a) =>
        a.date === dateKey(yesterday) &&
        a.status === "concluído" &&
        (barber === "all" || a.barber === barber),
    )
    .reduce((n, a) => n + value(a), 0);
  const change = previous ? ((revenue - previous) / previous) * 100 : null;
  return (
    <main className="dashboard container">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">ÁREA DA EQUIPE</span>
          <h1>Um bom dia começa aqui.</h1>
          <p>Sua agenda organizada. Seu foco em quem está na cadeira.</p>
        </div>
        <button
          className="button outline small"
          disabled={!!pending}
          onClick={async () => {
            setPending("logout");
            try {
              await logout();
              setAppointments([]);
              router.replace("/login");
            } catch (error) {
              setError(message(error));
            } finally {
              setPending("");
            }
          }}
        >
          <LogOut size={16} /> Sair
        </button>
      </div>
      {loadedKey !== agendaKey && <p role="status">Carregando agenda…</p>}
      {catalogError && (
        <div role="alert">
          <p className="error">{catalogError}</p>
          <button className="button outline" onClick={() => void loadCatalog()}>
            Recarregar profissionais
          </button>
        </div>
      )}
      {error && (
        <div role="alert">
          <p className="error">{error}</p>
          <button
            className="button outline"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Atualizar agenda
          </button>
        </div>
      )}
      <div className="dashboard-toolbar">
        <button
          className="button outline small"
          disabled={!!pending || loadedKey !== agendaKey}
          onClick={() => setRefresh((n) => n + 1)}
        >
          Atualizar agenda
        </button>
        <div className="tabs" role="tablist" aria-label="Seções do painel">
          {(
            [
              ["agenda", "Agenda", CalendarDays],
              ["clientes", "Clientes", Users],
              ["faturamento", "Faturamento", ChartNoAxesCombined],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              role="tab"
              id={`tab-${id}`}
              aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onKeyDown={(event) => {
                const tabs = Array.from(
                  event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]',
                  ),
                );
                const index = tabs.indexOf(event.currentTarget);
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % tabs.length
                    : event.key === "ArrowLeft"
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  tabs[next].focus();
                  tabs[next].click();
                }
              }}
              aria-selected={tab === id}
              key={id as string}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id as string)}
            >
              <Icon size={16} />
              {label as string}
            </button>
          ))}
        </div>
        <div className="filters">
          <label>
            <span className="sr-only">Data da agenda</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </label>
          <label>
            <span className="sr-only">Filtrar por barbeiro</span>
            <select value={barber} onChange={(e) => setBarber(e.target.value)}>
              <option value="all">Todos os barbeiros</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div
        className="dashboard-stats"
        hidden={loadFailed || loadedKey !== agendaKey}
      >
        {(
          [
            [
              CalendarDays,
              "Agendamentos",
              daily.filter((a) => a.status !== "cancelado").length,
              "Para o dia selecionado",
            ],
            [Scissors, "Concluídos", done.length, "Clientes bem cuidados"],
            [
              ChartNoAxesCombined,
              "Faturamento",
              money(revenue),
              "Atendimentos concluídos",
            ],
            [
              Users,
              "Ticket médio",
              money(done.length ? revenue / done.length : 0),
              "Por atendimento concluído",
            ],
          ] as const
        ).map(([Icon, label, num, note]) => (
          <div className="stat-card panel" key={label as string}>
            <span>
              {label as string}
              <Icon size={18} />
            </span>
            <strong>{num as string | number}</strong>
            <small>{note as string}</small>
          </div>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        className="panel dashboard-content"
        hidden={loadFailed || loadedKey !== agendaKey}
      >
        <div className="content-heading">
          <div>
            <h2>
              {tab === "agenda"
                ? "Agenda do dia"
                : tab === "clientes"
                  ? "Clientes do dia"
                  : "Visão do faturamento"}
            </h2>
            <p>{prettyDate(date)}</p>
          </div>
          {tab === "clientes" ? (
            <div className="search-box">
              <Search size={16} />
              <input
                aria-label="Buscar cliente"
                placeholder="Buscar cliente…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          ) : (
            <span className="muted">
              {barber === "all"
                ? "Toda a equipe"
                : barbers.find((b) => b.id === barber)?.name}
            </span>
          )}
        </div>
        {tab === "agenda" && (
          <div className="timeline">
            {slots.map((time) => {
              const rows = daily.filter((a) => a.time === time);
              return (
                <div className="timeline-slot" key={time}>
                  <time>{time}</time>
                  <div className="timeline-appointments">
                    {rows.length ? (
                      rows.map((a) => (
                        <div
                          key={a.id}
                          className={`appointment status-${a.status.replace(" ", "-")}`}
                        >
                          <span className="appointment-avatar">
                            {a.name
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <div>
                            <h3>{a.name}</h3>
                            <p>
                              {a.items.map((s) => s.name).join(" + ")}{" "}
                              <span>
                                · {barbers.find((b) => b.id === a.barber)?.name}
                              </span>
                            </p>
                          </div>
                          <strong>{money(value(a))}</strong>
                          <select
                            aria-label={`Status de ${a.name}`}
                            value={a.status}
                            disabled={!!pending}
                            onChange={(e) =>
                              void changeStatus(a.id, e.target.value as Status)
                            }
                          >
                            {statuses.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                          <details className="appointment-details">
                            <summary>
                              Detalhes do atendimento de {a.name}
                            </summary>
                            <dl>
                              <div>
                                <dt>Código</dt>
                                <dd>{a.id}</dd>
                              </div>
                              <div>
                                <dt>Duração</dt>
                                <dd>{a.duration} minutos</dd>
                              </div>
                              <div>
                                <dt>Observação</dt>
                                <dd>
                                  {a.note.trim() ? a.note : "Sem observações"}
                                </dd>
                              </div>
                            </dl>
                          </details>
                        </div>
                      ))
                    ) : (
                      <div className="free-slot">
                        <Clock size={15} />
                        {currentAppointments.some(
                          (a) =>
                            a.date === date &&
                            (barber === "all" || a.barber === barber) &&
                            a.status !== "cancelado" &&
                            a.time < time &&
                            Number(a.time.slice(0, 2)) * 60 +
                              Number(a.time.slice(3)) +
                              a.duration >
                              Number(time.slice(0, 2)) * 60 +
                                Number(time.slice(3)),
                        )
                          ? "Atendimento em andamento neste intervalo"
                          : "Livre · sem início de atendimento"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {tab === "clientes" && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Serviço</th>
                  <th>Profissional</th>
                  <th>Horário</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {daily
                  .filter((a) =>
                    a.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.name}</strong>
                        <a href={`tel:${a.phone}`}>{a.phone}</a>
                      </td>
                      <td>{a.items.map((s) => s.name).join(", ")}</td>
                      <td>{barbers.find((b) => b.id === a.barber)?.name}</td>
                      <td>{a.time}</td>
                      <td>{money(value(a))}</td>
                      <td>
                        <span className="status-label">{a.status}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!daily.filter((a) =>
              a.name.toLowerCase().includes(query.toLowerCase()),
            ).length && (
              <p className="empty-state">
                Nenhum cliente encontrado para estes filtros.
              </p>
            )}
          </div>
        )}
        {tab === "faturamento" && (
          <div className="revenue-grid">
            <div>
              <h3>Receita por profissional</h3>
              <p className="muted mb-7">Somente atendimentos concluídos</p>
              {barbers
                .filter((b) => barber === "all" || b.id === barber)
                .map((b) => {
                  const amount = done
                    .filter((a) => a.barber === b.id)
                    .reduce((n, a) => n + value(a), 0);
                  return (
                    <div className="bar-row" key={b.id}>
                      <div>
                        <span>{b.name}</span>
                        <strong>{money(amount)}</strong>
                      </div>
                      <div className="bar-track">
                        <span
                          style={{
                            width: `${revenue ? (amount / revenue) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="comparison">
              <ArrowUpRight className="gold" size={29} />
              <h3>Em relação ao dia anterior</h3>
              <strong>
                {change === null
                  ? "—"
                  : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
              </strong>
              <p>
                {previous
                  ? `Dia anterior: ${money(previous)}`
                  : "Sem faturamento no dia anterior para comparar."}
              </p>
              <small>
                O valor é atualizado quando um atendimento é concluído.
              </small>
            </div>
          </div>
        )}
      </section>
      <p className="dashboard-footnote">
        Agenda salva neste computador · Faturamento dos atendimentos concluídos.
      </p>
    </main>
  );
}
