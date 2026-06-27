import { searchHelp } from "@/lib/reply-machine/help";

describe("searchHelp", () => {
  it("returns nothing when no keyword matches", () => {
    expect(searchHelp("zzz qqq lorem", 4)).toEqual([]);
  });

  it("matches by keyword and respects topK", () => {
    const r = searchHelp("quel est le statut de ma candidature", 1);
    expect(r).toHaveLength(1);
    expect(r[0].text.toLowerCase()).toContain("statut");
  });

  it("ranks higher keyword overlap first", () => {
    const r = searchHelp("offre emploi poste annonce", 6);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].score).toBeGreaterThanOrEqual(r[r.length - 1].score ?? 0);
  });

  it("topK of 0 yields an empty list", () => {
    expect(searchHelp("statut offre document", 0)).toEqual([]);
  });
});
