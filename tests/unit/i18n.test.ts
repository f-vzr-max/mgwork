// Regression coverage for lib/i18n.ts locale merge/resolution (the language-
// switcher message pipeline) plus the authMeta.* keys that localize the
// document title on authed layouts (candidate/enterprise/staff/admin) — the
// observed "language didn't change" symptom was the tab title staying French
// because the root layout's static metadata always won on those routes.

// lib/i18n.ts imports request-scoped modules at top level. The helpers under
// test never call them, so stub them out for the node test environment.
jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@clerk/nextjs/server", () => ({ currentUser: jest.fn() }));

import { messagesFor, tFor, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";
import frMessages from "@/i18n/fr.json";
import enMessages from "@/i18n/en.json";
import mgMessages from "@/i18n/mg.json";

type Flat = Record<string, string>;
const CATALOGS: Record<Locale, Flat> = {
  FR: frMessages as Flat,
  EN: enMessages as Flat,
  MG: mgMessages as Flat,
};
const FR = CATALOGS.FR;

// Resolve a flat dotted key against the nested tree messagesFor() returns.
function resolveNested(tree: unknown, dotted: string): unknown {
  let node: unknown = tree;
  for (const part of dotted.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

describe("tFor (flat merge: locale over FR baseline)", () => {
  it("resolves every FR-catalog key for every locale — no raw-key leaks", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = tFor(locale);
      const overlay = CATALOGS[locale];
      for (const key of Object.keys(FR)) {
        expect(t(key)).toBe(overlay[key] ?? FR[key]);
      }
    }
  });

  it("prefers the requested locale's string over the FR baseline", () => {
    expect(tFor("EN")("home.signIn")).toBe(CATALOGS.EN["home.signIn"]);
    expect(tFor("EN")("home.signIn")).not.toBe(FR["home.signIn"]);
  });

  it("falls back to FR for keys a partial locale (MG) does not ship", () => {
    const frOnlyKey = Object.keys(FR).find((k) => !(k in CATALOGS.MG));
    expect(frOnlyKey).toBeDefined();
    expect(tFor("MG")(frOnlyKey!)).toBe(FR[frOnlyKey!]);
  });
});

describe("messagesFor (nested tree for next-intl)", () => {
  it("applies the same locale-over-FR merge after flat→nested expansion", () => {
    expect(resolveNested(messagesFor("EN"), "home.signIn")).toBe(CATALOGS.EN["home.signIn"]);
    expect(resolveNested(messagesFor("FR"), "home.signIn")).toBe(FR["home.signIn"]);
    const frOnlyKey = Object.keys(FR).find((k) => !(k in CATALOGS.MG))!;
    expect(resolveNested(messagesFor("MG"), frOnlyKey)).toBe(FR[frOnlyKey]);
  });
});

describe("authMeta.* (localized titles for authed layouts)", () => {
  const AREAS = ["candidate", "enterprise", "staff", "admin"] as const;

  it("ships a title key for every authed area in all three catalogs", () => {
    for (const area of AREAS) {
      const key = `authMeta.${area}.title`;
      for (const locale of SUPPORTED_LOCALES) {
        expect(CATALOGS[locale][key]).toBeTruthy();
      }
    }
  });

  it("resolves per locale so the tab title follows a language switch", () => {
    for (const area of AREAS) {
      const key = `authMeta.${area}.title`;
      expect(tFor("FR")(key)).toBe(FR[key]);
      expect(tFor("EN")(key)).toBe(CATALOGS.EN[key]);
      expect(resolveNested(messagesFor("EN"), key)).toBe(CATALOGS.EN[key]);
    }
    // The reported symptom: title stayed French after switching to EN.
    expect(tFor("EN")("authMeta.candidate.title")).not.toBe(tFor("FR")("authMeta.candidate.title"));
  });
});
