import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR, enUS } from "@clerk/localizations";
import { NextIntlClientProvider } from "next-intl";
import { Analytics } from "@vercel/analytics/react";
import { getLocale, messagesFor } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "MG Work — Mauritius × Madagascar",
  description: "Matchmaking platform connecting Malagasy candidates with Mauritian companies.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = messagesFor(locale);
  // FR is the canonical default; MG falls back to FR for Clerk widgets since
  // there's no first-party Malagasy localization in @clerk/localizations.
  const clerkLocalization = locale === "EN" ? enUS : frFR;
  const htmlLang = locale.toLowerCase();

  return (
    <ClerkProvider localization={clerkLocalization}>
      <html lang={htmlLang} suppressHydrationWarning>
        <body className={`${inter.variable} font-sans antialiased`}>
          <NextIntlClientProvider locale={htmlLang} messages={messages}>
            {children}
            <Analytics />
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
