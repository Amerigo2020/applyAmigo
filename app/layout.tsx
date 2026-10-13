import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "applyAmigo | Dein nächster Schritt",
  description: "Finde passende Stellen. Bereite gute Bewerbungen vor. Behalte deinen nächsten Schritt im Blick.",
icons: {
    icon: "/brand-mark.svg",
    shortcut: "/brand-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
