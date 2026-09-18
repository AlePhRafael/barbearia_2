import rafael from "@/assets/rafael.png";
import lucas from "@/assets/lucas.png";
import andre from "@/assets/andre.png";
import type { StaticImageData } from "next/image";
export const barberImages: Record<string, StaticImageData> = {
  rafael,
  lucas,
  andre,
};
export const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const prettyDate = (s: string) =>
  s
    ? new Date(s + "T12:00:00").toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Escolha uma data";
export const slots = Array.from(
  { length: 18 },
  (_, i) =>
    `${String(9 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);
export function shopDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
