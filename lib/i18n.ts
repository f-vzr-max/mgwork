import { cookies } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import frMessages from "@/i18n/fr.json";
import enMessages from "@/i18n/en.json";
import mgMessages from "@/i18n/mg.json";

export const SUPPORTED_LOCALES = ["FR", "EN", "MG"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "FR";

// Cookie used by the LanguageSwitcher and read by the server resolver.
// Lower-cased values for compatibility with browser Accept-Language.
export const LOCALE_COOKIE = "mgwork_lang";

type Messages = Record<string, string>;

const MESSAGES: Record<Locale, Messages> = {
  FR: frMessages as Messages,
  EN: enMessages as Messages,
  MG: mgMessages as Messages,
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(v);
}

function normalize(v: unknown): Locale | null {
  if (typeof v !== "string") return null;
  const upper = v.toUpperCase();
  return isLocale(upper) ? upper : null;
}

// Resolve the current user's locale, in priority order:
//   1. `mgwork_lang` cookie (set by LanguageSwitcher) — survives across tabs.
//   2. Clerk publicMetadata.lang (set on signup + via /api/me/language).
//   3. DEFAULT_LOCALE (FR).
// Each step is wrapped in a try because middleware/headers/cookies can throw
// when called outside of a request scope (e.g. during static generation).
export async function getLocale(): Promise<Locale> {
  // 1. Cookie
  try {
    const c = (await cookies()).get(LOCALE_COOKIE)?.value;
    const fromCookie = normalize(c);
    if (fromCookie) return fromCookie;
  } catch {
    // not in a request scope
  }

  // 2. Clerk publicMetadata.lang
  try {
    const user = await currentUser();
    const fromClerk = normalize(user?.publicMetadata?.lang);
    if (fromClerk) return fromClerk;
  } catch {
    // not in a request scope
  }

  return DEFAULT_LOCALE;
}

// Synchronous helper for places that already know the locale (server components
// can read from `getLocale()` and pass it through to children that need a `t`).
export type TranslationFn = (key: string, fallback?: string) => string;

export function tFor(lang: Locale): TranslationFn {
  // Fall through to the default-locale baseline for any key missing from the
  // requested locale (e.g. MG ships only a partial dictionary) so we never
  // surface a raw dotted key. See `mergedFlatFor` for the merge semantics.
  const dict = mergedFlatFor(lang);
  return (key, fallback) => dict[key] ?? fallback ?? key;
}

// next-intl integration shim — exported so `i18n/request.ts` can import it.
// We keep this in `lib/i18n.ts` so all locale logic stays in one place.
//
// Our JSON files use flat dotted keys (e.g. "home.signIn") because the legacy
// `tFor` translator does direct `dict[key]` lookup. next-intl, however, treats
// `t("home.signIn")` as a path traversal (messages.home.signIn). We expand the
// flat dictionary to a nested object here so both translators stay correct
// against the same source files.
type NestedMessages = { [key: string]: string | NestedMessages };

// Recursive deep-merge of `override` onto `base`. Plain objects merge key by
// key; any other value (string leaf, array) on `override` wins. `base` is
// never mutated. Used so a partial locale (e.g. MG) inherits every key it does
// not define from the default-locale baseline.
function deepMerge(base: NestedMessages, override: NestedMessages): NestedMessages {
  const out: NestedMessages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    if (
      isPlainObject(existing) &&
      isPlainObject(value)
    ) {
      out[key] = deepMerge(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isPlainObject(v: unknown): v is NestedMessages {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Flat-dictionary merge: the requested locale's keys overlaid on the default
// locale's keys. Our catalogs are flat dotted strings, so this single spread is
// a complete deep-merge at the dotted-key granularity — every key the locale
// omits falls through to the default. The default locale is returned as-is.
function mergedFlatFor(lang: Locale): Messages {
  if (lang === DEFAULT_LOCALE) return MESSAGES[DEFAULT_LOCALE];
  return { ...MESSAGES[DEFAULT_LOCALE], ...(MESSAGES[lang] ?? {}) };
}

function expandFlatToNested(flat: Messages): NestedMessages {
  const out: NestedMessages = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let cursor: NestedMessages = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      const existing = cursor[part];
      if (typeof existing !== "object" || existing === null) {
        const node: NestedMessages = {};
        cursor[part] = node;
        cursor = node;
      } else {
        cursor = existing;
      }
    }
    cursor[parts[parts.length - 1]!] = value;
  }
  return out;
}

// Each locale's nested dictionary is built from its FLAT dict merged over the
// default-locale baseline (see `mergedFlatFor`), so every locale resolves every
// key. The default-locale nested dict is the deep-merge identity, kept explicit
// via `deepMerge` so a future locale shipping nested (non-flat) overrides still
// inherits correctly.
const FR_BASELINE = expandFlatToNested(MESSAGES[DEFAULT_LOCALE]);

const NESTED_MESSAGES: Record<Locale, NestedMessages> = {
  FR: FR_BASELINE,
  EN: deepMerge(FR_BASELINE, expandFlatToNested(mergedFlatFor("EN"))),
  MG: deepMerge(FR_BASELINE, expandFlatToNested(mergedFlatFor("MG"))),
};

// Returns the nested message tree for a locale. Because every entry is already
// merged over the default-locale baseline, the requested locale always resolves
// — the `?? DEFAULT_LOCALE` guard only covers an out-of-range `lang`.
export function messagesFor(lang: Locale): NestedMessages {
  return NESTED_MESSAGES[lang] ?? NESTED_MESSAGES[DEFAULT_LOCALE];
}
