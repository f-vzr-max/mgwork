// Shared email layout used by every MG Work transactional template.
//
// All templates render through `@react-email/components`. Keep the markup
// inline-style only — most email clients ignore <style> blocks. We expose a
// minimal i18n helper so templates pick the right language string without
// pulling in next-intl (which is for the app, not server-rendered emails).

import * as React from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export type EmailLang = "FR" | "EN" | "MG";

export const APP_NAME = "MG Work";
export const APP_TAGLINE = {
  FR: "Plateforme de matching Madagascar–Maurice",
  EN: "Madagascar–Mauritius matching platform",
  MG: "Sehatry ny fampifandraisana asa Madagasikara–Maorisy",
};

const FOOTER_TEXT: Record<EmailLang, string> = {
  FR: "Vous recevez cet email car vous êtes inscrit sur MG Work.",
  EN: "You received this email because you are registered on MG Work.",
  MG: "Mahazo ity mailaka ity ianao satria voasoratra anarana eo amin'ny MG Work.",
};

const FOOTER_RIGHTS: Record<EmailLang, string> = {
  FR: "Tous droits réservés.",
  EN: "All rights reserved.",
  MG: "Voatahiry ny zo rehetra.",
};

export type LayoutProps = {
  preview: string;
  lang: EmailLang;
  children: React.ReactNode;
};

export function EmailLayout({ preview, lang, children }: LayoutProps): React.ReactElement {
  const tagline = APP_TAGLINE[lang] ?? APP_TAGLINE.EN;
  const footer = FOOTER_TEXT[lang] ?? FOOTER_TEXT.EN;
  const rights = FOOTER_RIGHTS[lang] ?? FOOTER_RIGHTS.EN;
  const year = new Date().getFullYear();

  return (
    <Html lang={lang.toLowerCase()}>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-8 max-w-[560px] rounded-lg bg-white p-8 shadow-sm">
            <Section className="border-b border-gray-200 pb-4">
              <Text className="m-0 text-xl font-semibold text-gray-900">{APP_NAME}</Text>
              <Text className="m-0 text-xs text-gray-500">{tagline}</Text>
            </Section>
            <Section className="py-4">{children}</Section>
            <Hr className="my-6 border-gray-200" />
            <Section>
              <Text className="m-0 text-xs text-gray-500">{footer}</Text>
              <Text className="m-0 text-xs text-gray-400">
                © {year} {APP_NAME}. {rights}{" "}
                <Link href="https://mgwork.io" className="text-gray-500 underline">
                  mgwork.io
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

// Helper for picking a translation tuple/object by language with EN fallback.
// We use a per-key generic so each language can declare narrower literal
// types (`as const`) without TS demanding they all match.
type LangMap<F, E, M> = { FR: F; EN: E; MG: M };

export function pick<F, E, M>(
  strings: LangMap<F, E, M>,
  lang: EmailLang,
): F | E | M {
  if (lang === "FR") return strings.FR;
  if (lang === "MG") return strings.MG;
  return strings.EN;
}
