// GDPR Article 17 — self-service erasure request.
//
// A signed-in user asks for their account to be deleted. The authoritative
// record is the auditLog row (action `user.deletion_request`); an admin
// processes it via app/admin/audit. The DPO email is a best-effort notice —
// the route still 202s and still writes the audit row if it fails to send.
//
// Auth: any authenticated user; acts on their own account only.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { rateLimit } from "@/lib/rate-limit";
import { send } from "@/lib/email/client";
import { LEGAL_ENTITY } from "@/lib/legal-entity";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    throw e;
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new NextResponse("Unauthorized", { status: 401 });

  if (!(await rateLimit(clerkUserId, "deletion.request", 3, 86400)))
    return new NextResponse("Too Many Requests", { status: 429 });

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
  if (!user) return new NextResponse("Not Found", { status: 404 });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "user.deletion_request",
      resourceType: "user",
      resourceId: user.id,
    },
  });

  const result = await send({
    template: "deletion-request",
    to: LEGAL_ENTITY.email.dpo,
    props: {
      userId: user.id,
      email: user.email,
      requestedAt: new Date().toISOString(),
    },
  });
  if ("error" in result) {
    // eslint-disable-next-line no-console
    console.error("[deletion-request] DPO email not delivered", { userId: user.id, result });
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
