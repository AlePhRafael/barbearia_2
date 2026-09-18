import Dashboard from "@/components/dashboard";
export const metadata = {
  title: "Painel da equipe",
  description: "Agenda diária, clientes e faturamento da equipe Vértice.",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Dashboard />;
}
