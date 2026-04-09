import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "IGP — Infrastructure Ghana Platform",
  description:
    "Report roads, water, power, and sanitation issues to authorities across Ghana. AI-powered triage and real-time status updates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${montserrat.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[9999] -translate-y-24 rounded-lg bg-[var(--gold-500)] px-4 py-2 text-sm font-bold text-[var(--surface-0)] opacity-0 shadow-lg transition focus:translate-y-0 focus:opacity-100 focus:outline-none"
        >
          Skip to main content
        </a>
        <div
          id="main-content"
          tabIndex={-1}
          className="flex min-h-full flex-1 flex-col outline-none"
        >
          {children}
        </div>
      </body>
    </html>
  );
}
