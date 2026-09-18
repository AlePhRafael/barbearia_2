import rafael from "@/assets/rafael.png";
import lucas from "@/assets/lucas.png";
import andre from "@/assets/andre.png";
export const services = [
  {
    id: "corte",
    name: "Corte de cabelo",
    description: "Seu estilo, na medida certa. Do clássico ao contemporâneo.",
    duration: 40,
    price: 60,
    icon: "scissors",
  },
  {
    id: "barba",
    name: "Barba & toalha quente",
    description: "Ritual completo para uma barba alinhada e pele renovada.",
    duration: 30,
    price: 45,
    icon: "razor",
  },
  {
    id: "combo",
    name: "Corte + barba",
    description: "A experiência completa. Cabelo e barba em perfeita sintonia.",
    duration: 70,
    price: 95,
    icon: "sparkles",
  },
  {
    id: "sobrancelha",
    name: "Design de sobrancelha",
    description: "Os pequenos detalhes que fazem toda a diferença.",
    duration: 15,
    price: 20,
    icon: "eye",
  },
];
export const barbers = [
  {
    id: "rafael",
    name: "Rafael Costa",
    specialty: "Clássicos & tesoura",
    rating: "4,9",
    image: rafael,
  },
  {
    id: "lucas",
    name: "Lucas Santos",
    specialty: "Degradês & estilo urbano",
    rating: "5,0",
    image: lucas,
  },
  {
    id: "andre",
    name: "André Oliveira",
    specialty: "Barbas & navalha",
    rating: "4,9",
    image: andre,
  },
];
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
export type Status =
  "confirmado" | "em atendimento" | "concluído" | "cancelado";
export type Appointment = {
  id: string;
  name: string;
  phone: string;
  note: string;
  services: string[];
  barber: string;
  date: string;
  time: string;
  status: Status;
};
export function initialAppointments(): Appointment[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return [today, yesterday].flatMap((d, j) =>
    [
      "Gabriel Martins",
      "Pedro Almeida",
      "Matheus Silva",
      "Bruno Ferreira",
      "João Ribeiro",
      "Felipe Souza",
    ].map((name, i) => ({
      id: `demo-${j}-${i}`,
      name,
      phone: `1198765432${i}`,
      note: "",
      services: [i % 2 ? "combo" : "corte"],
      barber: barbers[i % 3].id,
      date: dateKey(d),
      time: slots[i * 2],
      status: (i < 2
        ? "concluído"
        : i === 2
          ? "em atendimento"
          : "confirmado") as Status,
    })),
  );
}
