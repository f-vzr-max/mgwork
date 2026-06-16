import { _test } from "./security-check";

const { checkApiRoute, checkMissingRateLimit, findings, reset } = _test;

beforeEach(() => reset());

function rules(filter: string): string[] {
  return findings.filter((f) => f.rule === filter).map((f) => `${f.file}:${f.rule}`);
}

const TWO_VERB_ROUTE = `
export async function POST(req: Request) {
  await rateLimit(key, "x", 5, 60);
  return Response.json({});
}
export async function DELETE(req: Request) {
  return Response.json({});
}
`;

const WEBHOOK_BODY = `
export async function POST(req: Request) {
  return Response.json({});
}
`;

const UNLINK_AUDIT_BODY = `
export async function DELETE(req: Request) {
  await auth();
  await unlinkChannelIdentity(id);
  return Response.json({});
}
`;

describe("checkMissingRateLimit (body-scoped)", () => {
  it("flags the verb WITHOUT rateLimit and the sibling WITH it does not suppress it", () => {
    checkMissingRateLimit("app/api/x/route.ts", TWO_VERB_ROUTE);
    const flagged = findings.filter((f) => f.rule === "missing-ratelimit");
    expect(flagged).toHaveLength(1);
    expect(flagged[0].message).toMatch(/^DELETE/);
  });

  it("exempts webhook routes (signature auth, no rateLimit needed)", () => {
    checkMissingRateLimit("app/api/webhooks/clerk/route.ts", WEBHOOK_BODY);
    expect(rules("missing-ratelimit")).toHaveLength(0);
  });

  it("exempts cron routes (Bearer token)", () => {
    checkMissingRateLimit("app/api/cron/expiry-alerts/route.ts", WEBHOOK_BODY);
    expect(rules("missing-ratelimit")).toHaveLength(0);
  });
});

describe("checkApiRoute audit", () => {
  it("treats a body calling unlinkChannelIdentity( as audited", () => {
    checkApiRoute("app/api/me/channel-links/route.ts", UNLINK_AUDIT_BODY);
    expect(rules("missing-audit")).toHaveLength(0);
  });
});
