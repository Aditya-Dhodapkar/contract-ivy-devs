import type { Metadata } from "next";
import { Cormorant_Garamond, Mulish } from "next/font/google";
import "./globals.css";

// Same two faces as the public site.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-display",
});
const ui = Mulish({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "Sansi Africa — Back Office",
  robots: { index: false, follow: false }, // private area, never indexed
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body className="min-h-full font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
