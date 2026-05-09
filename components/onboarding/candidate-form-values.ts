// Shared TypeScript types for the candidate onboarding form.
//
// We don't reuse z.infer<typeof candidateCreateSchema> directly because the
// form holds intermediate display values (e.g. dateOfBirth as ISO string from
// the date input) before zod coerces them. The submit handler is responsible
// for sending values through candidateCreateSchema parse.

export type CandidateFormValues = {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phone?: string;
  city?: string;
  bio?: string;
  skills: string[];
  sectors: string[];
  langScoreFR?: number;
  langScoreEN?: number;
  cvFileUrl?: string;
};

export const CANDIDATE_FORM_DEFAULTS: CandidateFormValues = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  phone: "",
  city: "",
  bio: "",
  skills: [],
  sectors: [],
  langScoreFR: undefined,
  langScoreEN: undefined,
  cvFileUrl: undefined,
};
