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
  const dict = MESSAGES[lang] ?? MESSAGES[DEFAULT_LOCALE];
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

const NESTED_MESSAGES: Record<Locale, NestedMessages> = {
  FR: expandFlatToNested(MESSAGES.FR),
  EN: expandFlatToNested(MESSAGES.EN),
  MG: expandFlatToNested(MESSAGES.MG),
};

export function messagesFor(lang: Locale): NestedMessages {
  return NESTED_MESSAGES[lang] ?? NESTED_MESSAGES[DEFAULT_LOCALE];
}
