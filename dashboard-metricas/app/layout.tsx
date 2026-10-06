import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Produção de cortes",
  description: "Acompanhe os cortes renderizados e seus identificadores.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
