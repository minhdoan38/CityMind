import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import { roboto } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "CityMind AI",
  description: "AI-assisted decision intelligence for smarter communities",
  icons: {
    icon: "/logo_citymind.svg",
    apple: "/logo_citymind.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${roboto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
