import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MathScan — Scanne ton exercice de maths",
  description:
    "Scanne un exercice de maths et obtiens la solution étape par étape, sans connexion internet.",
  manifest: "/manifest.json",
  applicationName: "MathScan",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MathScan" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#7c3aed" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b13" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Thème appliqué avant le premier rendu pour éviter le flash blanc */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('mathscan:theme');if(t==='sombre'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
      </head>
      <body className="safe mx-auto max-w-md">{children}</body>
    </html>
  );
}
