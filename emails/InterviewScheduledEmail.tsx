import * as React from "react";
import { Button, Heading, Link, Section, Text } from "@react-email/components";
import { EmailLayout, pick, type EmailLang } from "./_layout";

export type InterviewScheduledEmailProps = {
  name: string;
  scheduledAt: Date | string;
  type: string;
  videoUrl?: string;
  lang: EmailLang;
};

const TEXTS = {
  FR: {
    subject: "Entretien programmé",
    preview: "Détails de votre prochain entretien.",
    greeting: (n: string) => `Bonjour ${n},`,
    body: (when: string, type: string) =>
      `Un entretien (${type}) est programmé le ${when}. Merci d'être disponible quelques minutes avant le début.`,
    videoLabel: "Lien de l'entretien :",
    cta: "Rejoindre l'entretien",
    closing: "Bonne préparation.",
  },
  EN: {
    subject: "Interview scheduled",
    preview: "Details of your upcoming interview.",
    greeting: (n: string) => `Hello ${n},`,
    body: (when: string, type: string) =>
      `An interview (${type}) is scheduled for ${when}. Please be available a few minutes before the start.`,
    videoLabel: "Interview link:",
    cta: "Join the interview",
    closing: "Good preparation.",
  },
  MG: {
    subject: "Voalamina ny resadresaka",
    preview: "Ny mombamomba ny resadresakao manaraka.",
    greeting: (n: string) => `Salama ${n},`,
    body: (when: string, type: string) =>
      `Voalamina ny resadresaka (${type}) amin'ny ${when}. Mba aoka ho vonona minitra vitsivitsy alohan'ny fotoana.`,
    videoLabel: "Rohy:",
    cta: "Hiditra amin'ny resadresaka",
    closing: "Mirary fiomanana tsara.",
  },
} as const;

export const InterviewScheduledEmailSubjects: Record<EmailLang, string> = {
  FR: TEXTS.FR.subject,
  EN: TEXTS.EN.subject,
  MG: TEXTS.MG.subject,
};

function fmtDateTime(d: Date | string, lang: EmailLang): string {
  const date = d instanceof Date ? d : new Date(d);
  const locale = lang === "FR" ? "fr-FR" : lang === "MG" ? "mg-MG" : "en-GB";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "full",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export default function InterviewScheduledEmail({
  name,
  scheduledAt,
  type,
  videoUrl,
  lang,
}: InterviewScheduledEmailProps): React.ReactElement {
  const t = pick(TEXTS, lang);
  const when = fmtDateTime(scheduledAt, lang);
  return (
    <EmailLayout preview={t.preview} lang={lang}>
      <Heading className="m-0 text-xl text-gray-900">{t.greeting(name)}</Heading>
      <Text className="text-gray-700">{t.body(when, type)}</Text>
      {videoUrl ? (
        <Section className="py-4">
          <Text className="text-sm font-semibold text-gray-700">{t.videoLabel}</Text>
          <Text className="m-0 text-sm text-gray-600">
            <Link href={videoUrl} className="text-blue-600 underline">
              {videoUrl}
            </Link>
          </Text>
          <Section className="pt-4">
            <Button
              href={videoUrl}
              className="rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white"
            >
              {t.cta}
            </Button>
          </Section>
        </Section>
      ) : null}
      <Text className="text-gray-700">{t.closing}</Text>
    </EmailLayout>
  );
}
