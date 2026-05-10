import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout, pick, type EmailLang } from "./_layout";

export type DocumentRejectedEmailProps = {
  name: string;
  docType: string;
  reason: string;
  lang: EmailLang;
};

const TEXTS = {
  FR: {
    subject: "Document refusé — action requise",
    preview: "Votre document n'a pas pu être validé.",
    greeting: (n: string) => `Bonjour ${n},`,
    body: (t: string) =>
      `Votre document « ${t} » n'a pas pu être validé par notre équipe. Vous trouverez ci-dessous le motif du refus. Merci de soumettre une nouvelle version.`,
    reasonLabel: "Motif :",
    cta: "Soumettre un nouveau document",
    closing: "Nous restons à votre disposition.",
  },
  EN: {
    subject: "Document rejected — action required",
    preview: "Your document could not be validated.",
    greeting: (n: string) => `Hello ${n},`,
    body: (t: string) =>
      `Your "${t}" document could not be validated by our team. The reason is provided below. Please upload a new version.`,
    reasonLabel: "Reason:",
    cta: "Upload a new document",
    closing: "We remain at your disposal.",
  },
  MG: {
    subject: "Nolavina ny antontan-taratasy — mila hetsika",
    preview: "Tsy nahomby ny fanamarinana ny antontan-taratasinao.",
    greeting: (n: string) => `Salama ${n},`,
    body: (t: string) =>
      `Tsy afaka nohamarinin'ny ekipanay ny antontan-taratasinao "${t}". Hita etsy ambany ny anton-javatra. Mba ampidiro indray ny dikan-teny vaovao.`,
    reasonLabel: "Anton-javatra:",
    cta: "Hampiakatra antontan-taratasy vaovao",
    closing: "Mijanona vonona hanampy anay anao izahay.",
  },
} as const;

export const DocumentRejectedEmailSubjects: Record<EmailLang, string> = {
  FR: TEXTS.FR.subject,
  EN: TEXTS.EN.subject,
  MG: TEXTS.MG.subject,
};

export default function DocumentRejectedEmail({
  name,
  docType,
  reason,
  lang,
}: DocumentRejectedEmailProps): React.ReactElement {
  const t = pick(TEXTS, lang);
  return (
    <EmailLayout preview={t.preview} lang={lang}>
      <Heading className="m-0 text-xl text-gray-900">{t.greeting(name)}</Heading>
      <Text className="text-gray-700">{t.body(docType)}</Text>
      <Section className="rounded-md border border-red-100 bg-red-50 p-4">
        <Text className="m-0 text-sm font-semibold text-red-900">{t.reasonLabel}</Text>
        <Text className="m-0 mt-1 text-sm text-red-800">{reason}</Text>
      </Section>
      <Section className="py-4">
        <Button
          href="https://mgwork.io/candidate/documents"
          className="rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white"
        >
          {t.cta}
        </Button>
      </Section>
      <Text className="text-gray-700">{t.closing}</Text>
    </EmailLayout>
  );
}
