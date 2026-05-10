import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout, pick, type EmailLang } from "./_layout";

export type DocumentExpiryEmailProps = {
  name: string;
  docType: string;
  expiresAt: Date | string;
  daysLeft: number;
  lang: EmailLang;
};

const TEXTS = {
  FR: {
    subject: (days: number) => `Document à renouveler (${days} jours)`,
    preview: (days: number) => `Votre document expire dans ${days} jours.`,
    greeting: (n: string) => `Bonjour ${n},`,
    body: (type: string, days: number, when: string) =>
      `Votre document « ${type} » expire dans ${days} jour(s), le ${when}. Merci de le renouveler dès que possible pour éviter toute interruption.`,
    cta: "Téléverser le renouvellement",
    closing: "Merci de votre attention.",
  },
  EN: {
    subject: (days: number) => `Document renewal needed (${days} days)`,
    preview: (days: number) => `Your document expires in ${days} days.`,
    greeting: (n: string) => `Hello ${n},`,
    body: (type: string, days: number, when: string) =>
      `Your "${type}" document expires in ${days} day(s), on ${when}. Please upload a renewal as soon as possible to avoid any interruption.`,
    cta: "Upload the renewal",
    closing: "Thank you for your attention.",
  },
  MG: {
    subject: (days: number) => `Antontan-taratasy havaozina (${days} andro)`,
    preview: (days: number) => `Ho lany ny antontan-taratasinao afaka ${days} andro.`,
    greeting: (n: string) => `Salama ${n},`,
    body: (type: string, days: number, when: string) =>
      `Ho lany ny antontan-taratasinao "${type}" afaka ${days} andro, amin'ny ${when}. Mba avaozy izy haingana mba tsy hisy fitsaharana.`,
    cta: "Hampiakatra fanavaozana",
    closing: "Misaotra noho ny fiheveranao.",
  },
} as const;

export const DocumentExpiryEmailSubjects = (lang: EmailLang, days: number): string =>
  pick(TEXTS, lang).subject(days);

function fmtDate(d: Date | string, lang: EmailLang): string {
  const date = d instanceof Date ? d : new Date(d);
  const locale = lang === "FR" ? "fr-FR" : lang === "MG" ? "mg-MG" : "en-GB";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
  } catch {
    return date.toISOString().split("T")[0] ?? "";
  }
}

export default function DocumentExpiryEmail({
  name,
  docType,
  expiresAt,
  daysLeft,
  lang,
}: DocumentExpiryEmailProps): React.ReactElement {
  const t = pick(TEXTS, lang);
  const when = fmtDate(expiresAt, lang);
  return (
    <EmailLayout preview={t.preview(daysLeft)} lang={lang}>
      <Heading className="m-0 text-xl text-gray-900">{t.greeting(name)}</Heading>
      <Text className="text-gray-700">{t.body(docType, daysLeft, when)}</Text>
      <Section className="py-4">
        <Button
          href="https://mgwork.io/candidate/documents"
          className="rounded-md bg-amber-600 px-4 py-3 text-sm font-medium text-white"
        >
          {t.cta}
        </Button>
      </Section>
      <Text className="text-gray-700">{t.closing}</Text>
    </EmailLayout>
  );
}
