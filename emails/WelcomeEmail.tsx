import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout, pick, type EmailLang } from "./_layout";

export type WelcomeEmailProps = {
  name: string;
  lang: EmailLang;
};

const TEXTS = {
  FR: {
    subject: "Bienvenue sur MG Work",
    preview: "Votre compte est prêt — finalisez votre profil.",
    greeting: (n: string) => `Bonjour ${n},`,
    body: "Bienvenue sur MG Work. Votre compte est créé. Pour commencer, finalisez votre profil et téléversez vos documents.",
    cta: "Accéder au tableau de bord",
    closing: "À bientôt sur la plateforme.",
  },
  EN: {
    subject: "Welcome to MG Work",
    preview: "Your account is ready — finish your profile.",
    greeting: (n: string) => `Hello ${n},`,
    body: "Welcome to MG Work. Your account has been created. To get started, complete your profile and upload your documents.",
    cta: "Go to dashboard",
    closing: "See you on the platform.",
  },
  MG: {
    subject: "Tongasoa eto amin'ny MG Work",
    preview: "Vonona ny kaontinao — fenoy ny mombamomba anao.",
    greeting: (n: string) => `Salama ${n},`,
    body: "Tongasoa eto amin'ny MG Work. Voaforona ny kaontinao. Mba hanombohana, fenoy ny mombamomba anao ary ampidiro ireo antontan-taratasinao.",
    cta: "Ho any amin'ny tabilao",
    closing: "Mandra-pihaona eto amin'ny sehatra.",
  },
} as const;

export const WelcomeEmailSubjects: Record<EmailLang, string> = {
  FR: TEXTS.FR.subject,
  EN: TEXTS.EN.subject,
  MG: TEXTS.MG.subject,
};

export default function WelcomeEmail({ name, lang }: WelcomeEmailProps): React.ReactElement {
  const t = pick(TEXTS, lang);
  const dashboardUrl = `https://mgwork.io/`;
  return (
    <EmailLayout preview={t.preview} lang={lang}>
      <Heading className="m-0 text-xl text-gray-900">{t.greeting(name)}</Heading>
      <Text className="text-gray-700">{t.body}</Text>
      <Section className="py-4">
        <Button
          href={dashboardUrl}
          className="rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white"
        >
          {t.cta}
        </Button>
      </Section>
      <Text className="text-gray-700">{t.closing}</Text>
    </EmailLayout>
  );
}
