// Shared TypeScript types for the enterprise onboarding form.

export type EnterpriseFormValues = {
  companyName: string;
  registrationNumber?: string;
  sector?: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  plan: "FREE" | "STARTER" | "PRO";
};

export const ENTERPRISE_FORM_DEFAULTS: EnterpriseFormValues = {
  companyName: "",
  registrationNumber: "",
  sector: "",
  address: "",
  contactName: "",
  contactPhone: "",
  plan: "FREE",
};
