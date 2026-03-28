import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Civic Ghana — Community infrastructure reporting",
  description:
    "Report roads, water, power, and sanitation issues to authorities across Ghana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[2000] -translate-y-24 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white opacity-0 shadow-lg transition focus:translate-y-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-sky-300"
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
