import type { Metadata, Viewport } from "next";
import { OfflineBanner } from "./offline-banner";
import "./globals.css";

// Fonte do sistema (não vem do Google Fonts): carrega mais rápido, não
// depende de internet pra aparecer, e funciona melhor em conexão fraca —
// tudo prioridade real aqui, dado o sinal instável no Pátio de Compostagem.

export const metadata: Metadata = {
  title: "App Coletivos",
  description:
    "Organização e gestão de coletivos comunitários e suas frentes de atuação.",
};

export const viewport: Viewport = {
  themeColor: "#2e6b3e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f4f7f2] text-zinc-900 font-sans">
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
