import type { Metadata } from "next";
import { AppProvider } from "@/context/app-context";
import { Header, Footer } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Vértice Barbearia | Seu estilo em outro nível",
    template: "%s | Vértice Barbearia",
  },
  description:
    "Cortes precisos, cuidado nos detalhes e uma experiência feita para você. Agende seu horário na Vértice.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <AppProvider>
          <Header />
          {children}
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
