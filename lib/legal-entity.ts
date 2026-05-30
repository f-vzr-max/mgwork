// Single source of truth for MG·Work's legal-entity facts.
//
// The __PLACEHOLDER__ values are real-world data only the owner/counsel has
// (Mauritius Business Registration Number, capital, named director, registered
// street address, incorporation date). They MUST be replaced with verified
// values before production. Do NOT invent registration numbers — the markers
// render literally on the legal pages so they are impossible to miss in review.
//
// Translatable legal copy lives in i18n (marketing.legal.*); these factual
// values are injected into that copy as ICU params (mirroring footer.copyright
// {year}) so each fact is defined exactly once and never drifts FR vs EN.

export const LEGAL_ENTITY = {
  legalName: "MG·Work SARL",
  form: "Société à responsabilité limitée de droit mauricien",
  brn: "__PLACEHOLDER_BRN__", // Mauritius Business Registration Number — REQUIRED
  capital: "__PLACEHOLDER_CAPITAL__", // e.g. "MUR 100 000"
  director: "__PLACEHOLDER_DIRECTOR_NAME__", // named directeur de la publication
  registeredAddress: "__PLACEHOLDER_ADDRESS_PORT_LOUIS__",
  operationalAddress: "Antananarivo, Madagascar",
  incorporationDate: "__PLACEHOLDER_INCORPORATION_DATE__",
  // Bump whenever legal copy changes. Shown as the "last updated" date.
  lastUpdated: "2026-05-29",
  // Contact domain — standardized to mgwork.io (matches transactional email +
  // lib/config.ts). Defined once here so the domain is never split again.
  emailDomain: "mgwork.io",
  email: {
    legal: "contact@mgwork.io",
    privacy: "privacy@mgwork.io",
    dpo: "dpo@mgwork.io",
  },
} as const;

export type LegalEntity = typeof LEGAL_ENTITY;
