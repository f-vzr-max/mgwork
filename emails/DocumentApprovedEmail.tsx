import * as React from "react";
import { Heading, Text } from "@react-email/components";
import { EmailLayout, pick, type EmailLang } from "./_layout";

export type DocumentApprovedEmailProps = {
  name: string;
  docType: string;
  lang: EmailLang;
};

const TEXTS = {
  FR: {
    subject: "Document approuvé",
    preview: "Bonne nouvelle — votre document a été validé.",
    greeting: (n: string) => `Bonjour ${n},`,
    body: (t: string) => `Votre document « ${t} » vient d'être approuvé par notre équipe. Aucune action n'est requise.`,
    closing: "Merci de votre confiance.",
  },
  EN: {
    subject: "Document approved",
    preview: "Good news — your document has been validated.",
    greeting: (n: string) => `Hello ${n},`,
    body: (t: string) => `Your "${t}" document has just been approved by our team. No further action is required.`,
    closing: "Thank you for your trust.",
  },
  MG: {
    subject: "Nankatoavina ny antontan-taratasy",
    preview: "Vaovao tsara — nankatoavina ny antontan-taratasinao.",
    greeting: (n: string) => `Salama ${n},`,
    body: (t: string) => `Vao nankatoavin'ny ekipanay ny antontan-taratasinao "${t}". Tsy mila atao na inona na inona intsony.`,
    closing: "Misaotra anao tamin'ny fitokisanao.",
  },
} as const;

export const DocumentApprovedEmailSubjects: Record<EmailLang, string> = {
  FR: TEXTS.FR.subject,
  EN: TEXTS.EN.subject,
  MG: TEXTS.MG.subject,
};

export default function DocumentApprovedEmail({
  name,
  docType,
  lang,
}: DocumentApprovedEmailProps): React.ReactElement {
  const t = pick(TEXTS, lang);
  return (
    <EmailLayout preview={t.preview} lang={lang}>
      <Heading className="m-0 text-xl text-gray-900">{t.greeting(name)}</Heading>
      <Text className="text-gray-700">{t.body(docType)}</Text>
      <Text className="text-gray-700">{t.closing}</Text>
    </EmailLayout>
  );
}
