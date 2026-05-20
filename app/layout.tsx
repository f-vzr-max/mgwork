import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR, enUS } from "@clerk/localizations";
import { NextIntlClientProvider } from "next-intl";
import { Analytics } from "@vercel/analytics/react";
import { getLocale, messagesFor } from "@/lib/i18n";
import { ThemeProvider } from "@/components/mg/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MG·Work — La mobilité du travail entre Madagascar et l'océan Indien",
  description:
    "Plateforme sérieuse de matching pour la mobilité du travail. Candidats malgaches vérifiés × employeurs de Maurice, Réunion, Seychelles.",
};

// Clerk appearance theming. The widget reads CSS vars at render time, so light
// and dark modes both stay aligned with the MG palette.
const clerkAppearance = {
  variables: {
    colorPrimary: "hsl(213 62% 27%)",
    colorText: "hsl(222 47% 11%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInputBackground: "hsl(0 0% 100%)",
    colorInputText: "hsl(222 47% 11%)",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-sans), system-ui, sans-serif",
  },
  elements: {
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:opacity-90 transition-opacity",
    card: "shadow-mg-md border border-border bg-card",
  },
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
    <ClerkProvider localization={clerkLocalization} appearance={clerkAppearance}>
      <html lang={htmlLang} suppressHydrationWarning>
        <body
          className={`${inter.variable} ${jetBrainsMono.variable} font-sans antialiased overflow-x-hidden`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <NextIntlClientProvider locale={htmlLang} messages={messages}>
              {children}
              <Analytics />
            </NextIntlClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
