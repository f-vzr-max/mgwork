import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR, enUS } from "@clerk/localizations";
import { NextIntlClientProvider } from "next-intl";
import { Analytics } from "@vercel/analytics/react";
import { getLocale, messagesFor } from "@/lib/i18n";
import { ThemeProvider } from "@/components/mg/theme-provider";
import { env } from "@/lib/config";
import { LEGAL_ENTITY } from "@/lib/legal-entity";
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

const SITE_NAME = "MG·Work";
const SITE_TITLE =
  "MG·Work — La mobilité du travail entre Madagascar et l'océan Indien";
const SITE_DESCRIPTION =
  "Plateforme sérieuse de matching pour la mobilité du travail. Candidats malgaches vérifiés × employeurs de Maurice, Réunion, Seychelles.";

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl()),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

// Organization structured data (schema.org) for search engines.
const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: env.appUrl(),
  description: SITE_DESCRIPTION,
  email: LEGAL_ENTITY.email.legal,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Port-Louis",
    addressCountry: "MU",
  },
};

// Clerk appearance theming. Readability colors are emitted as CSS var()
// passthroughs so they resolve against :root / .dark in globals.css and
// re-resolve live when next-themes toggles `class="dark"` on <html>. The
// SignIn/SignUp widgets render inline inside <body>, so they sit in the .dark
// cascade subtree. colorPrimary stays concrete: Clerk derives hover/alpha
// shades from it via JS color math at render time, which cannot parse var().
const clerkAppearance = {
  variables: {
    colorPrimary: "hsl(213 62% 27%)",
    colorText: "hsl(var(--foreground))",
    colorTextSecondary: "hsl(var(--muted-foreground))",
    colorBackground: "hsl(var(--card))",
    colorInputBackground: "hsl(var(--input))",
    colorInputText: "hsl(var(--foreground))",
    colorNeutral: "hsl(var(--foreground))",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-sans), system-ui, sans-serif",
  },
  elements: {
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:opacity-90 transition-opacity",
    card: "shadow-mg-md border border-border bg-card",
    // Accent links derive from colorPrimary (concrete navy), which is too dark
    // on the dark card. Pin them to the cascade-aware `text-primary` so they
    // read bright-blue in dark and navy in light.
    footerActionLink: "text-primary hover:text-primary",
    formFieldAction: "text-primary hover:text-primary",
    identityPreviewEditButton: "text-primary hover:text-primary",
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
    <ClerkProvider
      localization={clerkLocalization}
      appearance={clerkAppearance}
      afterSignOutUrl="/"
    >
      <html lang={htmlLang} suppressHydrationWarning>
        <body
          className={`${inter.variable} ${jetBrainsMono.variable} font-sans antialiased overflow-x-hidden`}
        >
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
          />
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
