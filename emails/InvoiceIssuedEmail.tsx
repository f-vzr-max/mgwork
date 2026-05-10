import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout, pick, type EmailLang } from "./_layout";

export type InvoiceIssuedEmailProps = {
  enterpriseName: string;
  amount: number;
  currency: string;
  dueAt: Date | string;
  lang: EmailLang;
};

const TEXTS = {
  FR: {
    subject: "Facture émise",
    preview: "Une nouvelle facture est disponible.",
    greeting: (n: string) => `Bonjour ${n},`,
    body: (amount: string, due: string) =>
      `Une facture d'un montant de ${amount} a été émise. Échéance : ${due}.`,
    cta: "Consulter la facture",
    closing: "Merci de votre coopération.",
  },
  EN: {
    subject: "Invoice issued",
    preview: "A new invoice is available.",
    greeting: (n: string) => `Hello ${n},`,
    body: (amount: string, due: string) =>
      `An invoice for ${amount} has been issued. Due date: ${due}.`,
    cta: "View the invoice",
    closing: "Thank you for your cooperation.",
  },
  MG: {
    subject: "Faktiora navoaka",
    preview: "Misy faktiora vaovao azo jerena.",
    greeting: (n: string) => `Salama ${n},`,
    body: (amount: string, due: string) =>
      `Nisy faktiora mitentina ${amount} navoaka. Fe-potoana: ${due}.`,
    cta: "Hijery ny faktiora",
    closing: "Misaotra noho ny fiaraha-miasa.",
  },
} as const;

export const InvoiceIssuedEmailSubjects: Record<EmailLang, string> = {
  FR: TEXTS.FR.subject,
  EN: TEXTS.EN.subject,
  MG: TEXTS.MG.subject,
};

function fmtAmount(amount: number, currency: string, lang: EmailLang): string {
  const locale = lang === "FR" ? "fr-FR" : lang === "MG" ? "mg-MG" : "en-GB";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function fmtDate(d: Date | string, lang: EmailLang): string {
  const date = d instanceof Date ? d : new Date(d);
  const locale = lang === "FR" ? "fr-FR" : lang === "MG" ? "mg-MG" : "en-GB";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
  } catch {
    return date.toISOString().split("T")[0] ?? "";
  }
}

export default function InvoiceIssuedEmail({
  enterpriseName,
  amount,
  currency,
  dueAt,
  lang,
}: InvoiceIssuedEmailProps): React.ReactElement {
  const t = pick(TEXTS, lang);
  const formattedAmount = fmtAmount(amount, currency, lang);
  const formattedDue = fmtDate(dueAt, lang);
  return (
    <EmailLayout preview={t.preview} lang={lang}>
      <Heading className="m-0 text-xl text-gray-900">{t.greeting(enterpriseName)}</Heading>
      <Text className="text-gray-700">{t.body(formattedAmount, formattedDue)}</Text>
      <Section className="py-4">
        <Button
          href="https://mgwork.io/enterprise/invoices"
          className="rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white"
        >
          {t.cta}
        </Button>
      </Section>
      <Text className="text-gray-700">{t.closing}</Text>
    </EmailLayout>
  );
}
