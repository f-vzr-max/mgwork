// MG Work — shared API request/response types.
// Pure type module: no runtime, no logic. Imported by route handlers and clients.
// Source of truth: docs/contracts.md.

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

export type ApiOk<T> = {
  ok: true;
  data: T;
};

export type ApiErr = {
  ok: false;
  error: ApiError;
};

export type ApiResponse<T> = ApiOk<T> | ApiErr;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PLAN_LIMIT_REACHED'
  | 'EXTERNAL_DEPENDENCY_FAILED'
  | 'INTERNAL_ERROR';

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
};

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export type PaginationQuery = {
  cursor?: string;
  limit?: number;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  total?: number;
};

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

// Convention: `{resource}.{action}` — see docs/contracts.md.
export type AuditActionKey = `${string}.${string}`;

export type AuditContext = {
  ip?: string;
  userAgent?: string;
  requestId?: string;
};

// ---------------------------------------------------------------------------
// Common resource refs
// ---------------------------------------------------------------------------

export type Id = string;

export type ResourceRef = {
  type:
    | 'candidate'
    | 'enterprise'
    | 'document'
    | 'job_offer'
    | 'application'
    | 'interview'
    | 'invoice'
    | 'matching_config'
    | 'feature_flag'
    | 'translation'
    | 'checkpoint'
    | 'staff_note'
    | 'user';
  id: Id;
};

// ---------------------------------------------------------------------------
// Signed URL
// ---------------------------------------------------------------------------

export type SignedUrlResponse = {
  url: string;
  expiresAt: string; // ISO timestamp
};

// ---------------------------------------------------------------------------
// AI endpoints
// ---------------------------------------------------------------------------

export type CvExtractResult = {
  firstName?: string;
  lastName?: string;
  skills: string[];
  sectors: string[];
  languages: { code: 'FR' | 'EN' | 'MG'; selfLevel: number }[];
  experience: { title: string; company: string; years: number }[];
  education: { degree: string; institution: string; year?: number }[];
};

export type LangTestResult = {
  lang: 'FR' | 'EN';
  score: number; // 0-100
  feedback?: string;
};

export type InterviewSimQuestionsResponse = {
  questions: { id: string; text: string }[];
};

export type InterviewSimEvaluationResponse = {
  total: number; // 0-100
  perQuestion: { id: string; score: number; feedback: string }[];
};

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export type MatchingWeights = {
  skills: number;
  languages: number;
  sector: number;
  mobility: number;
  experience: number;
  documents: number;
};

export type MatchingResultEntry = {
  candidateId: Id;
  score: number;
  breakdown: Record<keyof MatchingWeights, number>;
};

// ---------------------------------------------------------------------------
// Envelope helpers (runtime — keep tiny)
// ---------------------------------------------------------------------------

export function ok<T>(data: T): ApiOk<T> {
  return { ok: true, data };
}

export function err(
  code: ApiErrorCode,
  message: string,
  extras?: Pick<ApiError, 'fieldErrors' | 'requestId'>,
): ApiErr {
  return {
    ok: false,
    error: { code, message, ...extras },
  };
}
