import type { Metadata } from "next";
import { Public_Sans, Roboto_Slab } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const fontSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const fontDisplay = Roboto_Slab({
  variable: "--font-roboto-slab",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Observatório Grilagem de Terras",
  description: "Plataforma de monitoramento geoespacial de grilagem de terras",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${fontSans.variable} ${fontDisplay.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
