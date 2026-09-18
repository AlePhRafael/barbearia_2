export type Service = {
  id: string;
  name: string;
  description: string;
  icon: string;
  priceCents: number;
  price: number;
  duration: number;
};
export type Barber = {
  id: string;
  name: string;
  specialty: string;
  rating: string;
};
export type Status =
  "confirmado" | "em atendimento" | "concluído" | "cancelado";
export type BookingDraft = {
  services: string[];
  barber: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  note: string;
};
export type Appointment = BookingDraft & {
  id: string;
  status: Status;
  totalCents: number;
  duration: number;
  items: { id: string; name: string; priceCents: number; duration: number }[];
};
export type Catalog = { services: Service[]; barbers: Barber[] };
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente novamente.";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError("Resposta inválida do servidor.", 502);
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string")
    throw new ApiError("Resposta inválida do servidor.", 502);
  return value;
}
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new ApiError("Resposta inválida do servidor.", 502);
  return value;
}
function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value))
    throw new ApiError("Resposta inválida do servidor.", 502);
  return value.map(parse);
}
export function parseCatalog(value: unknown): Catalog {
  const data = object(value);
  return {
    services: array(data.services, (value) => {
      const s = object(value),
        priceCents = integer(s.priceCents);
      return {
        id: string(s.id),
        name: string(s.name),
        description: string(s.description),
        icon: string(s.icon),
        priceCents,
        price: priceCents / 100,
        duration: integer(s.duration),
      };
    }),
    barbers: array(data.barbers, (value) => {
      const b = object(value);
      return {
        id: string(b.id),
        name: string(b.name),
        specialty: string(b.specialty),
        rating: string(b.rating),
      };
    }),
  };
}
export function parseAppointment(value: unknown): Appointment {
  const a = object(value),
    status = string(a.status);
  if (
    !["confirmado", "em atendimento", "concluído", "cancelado"].includes(status)
  )
    throw new ApiError("Status inválido do servidor.", 502);
  return {
    id: string(a.id),
    name: string(a.name),
    phone: string(a.phone),
    note: string(a.note),
    barber: string(a.barber),
    date: string(a.date),
    time: string(a.time),
    services: array(a.services, string),
    status: status as Status,
    totalCents: integer(a.totalCents),
    duration: integer(a.duration),
    items: array(a.items, (value) => {
      const i = object(value);
      return {
        id: string(i.id),
        name: string(i.name),
        priceCents: integer(i.priceCents),
        duration: integer(i.duration),
      };
    }),
  };
}
export async function request<T>(
  path: string,
  parse: (data: unknown) => T,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      "Não foi possível conectar ao servidor. Tente novamente.",
      0,
    );
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data ? data.detail : null;
    throw new ApiError(
      typeof detail === "string"
        ? detail
        : "Servidor indisponível. Tente novamente.",
      response.status,
    );
  }
  return parse(data);
}
export const parseUser = (data: unknown) => ({
  username: string(object(data).username),
});
export const parseOk = (data: unknown) => {
  if (object(data).ok !== true)
    throw new ApiError("Resposta inválida do servidor.", 502);
  return true;
};
export const parseSlots = (data: unknown) => array(object(data).slots, string);
export const parseAgenda = (data: unknown) => array(data, parseAppointment);
