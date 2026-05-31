import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Footer } from "@/components/footer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AQOJ — À Quoi On Joue",
  description:
    "Lance une partie en 10 secondes. Des jeux rapides à jouer entre amis sur Discord, sans prise de tête.",
};

// Applique le thème persisté avant le 1er paint (évite le flash). Clair par défaut.
const themeScript = `(function(){try{var t=localStorage.getItem('aqoj-theme');document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
