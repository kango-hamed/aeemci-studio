import type { Metadata } from "next";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/600.css";
import "@fontsource/amiri/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AEEMCI Studio", template: "%s · AEEMCI Studio" },
  description: "Les documents de la section AEEMCI ESATIC, au même endroit.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
