import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../src/context/app-context";
import Booking from "../src/components/booking";
import Login from "../src/components/login";
import Dashboard from "../src/components/dashboard";
import {
  dateKey,
  services,
  barbers,
  initialAppointments,
  slots,
} from "../src/data/mock";
import { Appointment, parseAppointment, parseCatalog } from "../src/lib/api";
import type { ReactNode } from "react";
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
let authenticated = false;
let saved: Appointment[] = [];
let bookingFailure = 0;
let invalidCatalog = false;
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const catalog = {
  services: services.map((s) => ({ ...s, priceCents: s.price * 100 })),
  barbers,
};
const makeAppointment = (
  draft: ReturnType<typeof initialAppointments>[number],
): Appointment => {
  const selected = services.filter((s) => draft.services.includes(s.id));
  return {
    ...draft,
    totalCents: selected.reduce((n, s) => n + s.price * 100, 0),
    duration: selected.reduce((n, s) => n + s.duration, 0),
    items: selected.map((s) => ({
      id: s.id,
      name: s.name,
      priceCents: s.price * 100,
      duration: s.duration,
    })),
  };
};
const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
  if (path === "/api/catalog")
    return reply(invalidCatalog ? { services: "invalid" } : catalog);
  if (path === "/api/auth/me")
    return authenticated
      ? reply({ username: "equipe" })
      : reply({ detail: "Entre com sua conta da equipe." }, 401);
  if (path === "/api/auth/login") {
    const body = JSON.parse(init?.body as string);
    if (body.username !== "equipe" || body.password !== "vertice123")
      return reply({ detail: "Usuário ou senha incorretos." }, 401);
    authenticated = true;
    return reply({ username: "equipe" });
  }
  if (path === "/api/auth/logout") {
    authenticated = false;
    return reply({ ok: true });
  }
  if (path.startsWith("/api/availability?")) return reply({ slots });
  if (path === "/api/appointments" && init?.method === "POST") {
    if (bookingFailure) {
      const status = bookingFailure;
      bookingFailure = 0;
      return reply(
        {
          detail:
            status === 409
              ? "Este horário não está mais disponível. Escolha outro."
              : "Servidor indisponível. Tente novamente.",
        },
        status,
      );
    }
    const body = JSON.parse(init.body as string);
    const appointment = makeAppointment({
      ...body,
      id: "VT-ABC123",
      status: "confirmado",
      barber: body.barber === "any" ? "rafael" : body.barber,
    });
    saved.push(appointment);
    return reply(appointment, 201);
  }
  if (path.startsWith("/api/appointments?") && authenticated)
    return reply(saved);
  if (path.endsWith("/status") && authenticated) {
    const id = path.split("/")[3],
      status = JSON.parse(init?.body as string).status;
    saved = saved.map((a) => (a.id === id ? { ...a, status } : a));
    return reply(saved.find((a) => a.id === id));
  }
  return reply({ detail: "Não autorizado." }, 401);
});
beforeEach(() => {
  sessionStorage.clear();
  replace.mockReset();
  window.history.replaceState({}, "", "/agendar");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-01-07T12:00:00-03:00"));
  authenticated = false;
  saved = initialAppointments().map(makeAppointment);
  bookingFailure = 0;
  invalidCatalog = false;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("Fluxo de agendamento", () => {
  it("valida etapas, soma serviços e confirma somente após a API salvar", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <Booking />
      </AppProvider>,
    );
    await screen.findByRole("button", { name: /Corte de cabelo/ });
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(screen.getByRole("alert").textContent).toContain("Selecione");
    await user.click(screen.getByRole("button", { name: /Corte de cabelo/ }));
    await user.click(
      screen.getByRole("button", { name: /Design de sobrancelha/ }),
    );
    expect(document.querySelector(".summary-total")?.textContent).toContain(
      "80,00",
    );
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("button", { name: /Sem preferência/ }));
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    const calendar = document.querySelector(".calendar-grid") as HTMLElement;
    const day = within(calendar)
      .getAllByRole("button")
      .find((b) => !(b as HTMLButtonElement).disabled)!;
    await user.click(day);
    await user.click(screen.getByRole("button", { name: "09:00" }));
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.type(screen.getByLabelText(/Nome completo/), "Cliente Teste");
    await user.type(screen.getByLabelText(/Celular/), "123");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(screen.getByRole("alert").textContent).toContain("telefone válido");
    await user.clear(screen.getByLabelText(/Celular/));
    await user.type(screen.getByLabelText(/Celular/), "11987654321");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(
      screen.getByRole("button", { name: /Confirmar agendamento/ }),
    );
    expect(await screen.findByText(/^VT-[A-F0-9]{6}$/)).toBeTruthy();
    expect(saved.some((a) => a.name === "Cliente Teste")).toBe(true);
    await user.click(screen.getByRole("button", { name: /Novo agendamento/ }));
    expect(document.querySelector(".summary-total")?.textContent).toContain(
      "0,00",
    );
  });
  it("evita somar corte e barba em duplicidade com o combo", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <Booking />
      </AppProvider>,
    );
    await user.click(
      await screen.findByRole("button", { name: /Corte de cabelo/ }),
    );
    await user.click(screen.getByRole("button", { name: /Corte \+ barba/ }));
    expect(
      screen
        .getByRole("button", { name: /Corte de cabelo/ })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(document.querySelector(".summary-total")?.textContent).toContain(
      "95,00",
    );
  });
});
describe("Painel da equipe", () => {
  it("rejeita credenciais inválidas e estabelece sessão pela API", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <Login />
      </AppProvider>,
    );
    await user.type(screen.getByLabelText("Usuário"), "equipe");
    await user.type(screen.getByLabelText("Senha"), "errada");
    await user.click(screen.getByRole("button", { name: /Entrar/ }));
    expect(screen.getByRole("alert")).toBeTruthy();
    await user.clear(screen.getByLabelText("Senha"));
    await user.type(screen.getByLabelText("Senha"), "vertice123");
    await user.click(screen.getByRole("button", { name: /Entrar/ }));
    expect(authenticated).toBe(true);
    expect(sessionStorage.getItem("vertice-session")).toBeNull();
    expect(replace).toHaveBeenCalledWith("/painel");
  });
  it("redireciona acesso ao painel sem sessão", async () => {
    render(
      <AppProvider>
        <Dashboard />
      </AppProvider>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(
      fetchMock.mock.calls.some(([path]) =>
        path.startsWith("/api/appointments?"),
      ),
    ).toBe(false);
  });
  it("troca status, atualiza receita e filtra clientes", async () => {
    authenticated = true;
    const user = userEvent.setup();
    render(
      <AppProvider>
        <Dashboard />
      </AppProvider>,
    );
    await screen.findByLabelText("Status de Matheus Silva");
    expect(document.querySelector(".dashboard-stats")?.textContent).toContain(
      "155,00",
    );
    await user.selectOptions(
      screen.getByLabelText("Status de Matheus Silva"),
      "concluído",
    );
    await waitFor(() =>
      expect(document.querySelector(".dashboard-stats")?.textContent).toContain(
        "215,00",
      ),
    );
    await user.click(screen.getByRole("tab", { name: "Clientes" }));
    await user.type(screen.getByLabelText("Buscar cliente"), "Gabriel");
    expect(screen.getByText("Gabriel Martins")).toBeTruthy();
    expect(screen.queryByText("Pedro Almeida")).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Faturamento" }));
    expect(screen.getByText("+38.7%")).toBeTruthy();
    expect(screen.getByLabelText("Data da agenda").getAttribute("value")).toBe(
      dateKey(new Date()),
    );
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(sessionStorage.getItem("vertice-session")).toBeNull();
    expect(authenticated).toBe(false);
  });
});

async function fillBooking() {
  const user = userEvent.setup();
  render(
    <AppProvider>
      <Booking />
    </AppProvider>,
  );
  await user.click(
    await screen.findByRole("button", { name: /Corte de cabelo/ }),
  );
  await user.click(screen.getByRole("button", { name: /Continuar/ }));
  await user.click(screen.getByRole("button", { name: /Sem preferência/ }));
  await user.click(screen.getByRole("button", { name: /Continuar/ }));
  await user.click(screen.getByRole("button", { name: "Próximo mês" }));
  const day = within(document.querySelector(".calendar-grid") as HTMLElement)
    .getAllByRole("button")
    .find((b) => !(b as HTMLButtonElement).disabled)!;
  await user.click(day);
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "09:00" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  await user.click(screen.getByRole("button", { name: "09:00" }));
  await user.click(screen.getByRole("button", { name: /Continuar/ }));
  await user.type(screen.getByLabelText(/Nome completo/), "Cliente Teste");
  await user.type(screen.getByLabelText(/Celular/), "11987654321");
  await user.click(screen.getByRole("button", { name: /Continuar/ }));
  return user;
}
describe("Falhas e contratos da API", () => {
  it("bloqueia nova confirmação enquanto a resposta está pendente", async () => {
    const user = await fillBooking();
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const before = fetchMock.mock.calls.length;
    await user.click(
      screen.getByRole("button", { name: /Confirmar agendamento/ }),
    );
    const button = screen.getByRole("button", { name: /Confirmando/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await user.click(button);
    expect(fetchMock.mock.calls.length).toBe(before + 1);
    expect(screen.queryByText(/^VT-/)).toBeNull();
    finish(
      reply(
        makeAppointment({
          ...initialAppointments()[0],
          id: "VT-ABC123",
          name: "Cliente Teste",
        }),
        201,
      ),
    );
    await screen.findByText("VT-ABC123");
  });
  it("mantém dados após erro de rede e permite tentar novamente", async () => {
    const user = await fillBooking();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await user.click(
      screen.getByRole("button", { name: /Confirmar agendamento/ }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "conectar ao servidor",
    );
    expect(screen.getByText("Cliente Teste")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: /Confirmar agendamento/ }),
    );
    await screen.findByText("VT-ABC123");
  });
  it("retira a agenda quando a sessão expira durante uma alteração", async () => {
    authenticated = true;
    const user = userEvent.setup();
    render(
      <AppProvider>
        <Dashboard />
      </AppProvider>,
    );
    await screen.findByLabelText("Status de Matheus Silva");
    authenticated = false;
    await user.selectOptions(
      screen.getByLabelText("Status de Matheus Silva"),
      "concluído",
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Matheus Silva")).toBeNull();
  });
  it("preserva o rascunho e reutiliza idempotência após falha", async () => {
    const user = await fillBooking();
    bookingFailure = 503;
    await user.click(
      screen.getByRole("button", { name: /Confirmar agendamento/ }),
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(/^VT-/)).toBeNull();
    expect(screen.getByText("Cliente Teste")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: /Confirmar agendamento/ }),
    );
    await screen.findByText("VT-ABC123");
    const calls = fetchMock.mock.calls.filter(
      ([path, init]) => path === "/api/appointments" && init?.method === "POST",
    );
    expect(calls).toHaveLength(2);
    expect(calls[0][1]?.headers).toEqual(calls[1][1]?.headers);
  });
  it("volta aos horários quando o servidor informa conflito", async () => {
    const user = await fillBooking();
    bookingFailure = 409;
    await user.click(
      screen.getByRole("button", { name: /Confirmar agendamento/ }),
    );
    expect(await screen.findByText("Horários disponíveis")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "não está mais disponível",
    );
    expect(screen.queryByText(/^VT-/)).toBeNull();
  });
  it("mostra erro de contrato sem usar catálogo fictício", async () => {
    invalidCatalog = true;
    render(
      <AppProvider>
        <Booking />
      </AppProvider>,
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Resposta inválida",
    );
    expect(
      screen.queryByRole("button", { name: /Corte de cabelo/ }),
    ).toBeNull();
  });
  it("recusa respostas incompletas ou valores inválidos", () => {
    expect(() => parseCatalog({ services: [{}], barbers: [] })).toThrow();
    expect(() =>
      parseAppointment({ ...saved[0], totalCents: "6000" }),
    ).toThrow();
  });
});
