// GDPR Article 17 — Right to erasure.
//
// Admin-only endpoint that cascades the deletion of a user and all directly
// owned data (Candidate, Enterprise, Documents, Applications, Interviews,
// Conversations, Checkpoints, etc.) inside a single Prisma transaction.
//
// Auth: ADMIN or SUPER_ADMIN only.
// Audit: written BEFORE deletion so the entry survives the user.id removal
// (AuditLog.userId is the *acting* admin, not the erased subject).
//
// We intentionally keep AuditLog rows referencing the erased user.id intact
// per roadmap §7 (5y retention) — the FK from AuditLog.userId → User.id is
// for the actor, not the subject. The subject's id is captured in metadata.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";

type Params = { params: { id: string } };

function getIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

export async function POST(req: Request, { params }: Params) {
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

  const actor = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
  });
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });
  if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const targetUserId = params.id;
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) return new NextResponse("Not Found", { status: 404 });

  // Refuse to erase another admin unless caller is SUPER_ADMIN — defense
  // against a compromised regular admin nuking peers.
  if (
    (target.role === "ADMIN" || target.role === "SUPER_ADMIN") &&
    actor.role !== "SUPER_ADMIN"
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Placed after auth/role so forbidden callers don't consume the limiter.
  if (!(await rateLimit(actor.id, "admin.erasure", 5, 60))) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  const ip = getIp(req);

  // Write audit log first.
  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "user.erasure",
      resourceType: "user",
      resourceId: targetUserId,
      ipAddress: ip ?? undefined,
      metadata: {
        targetRole: target.role,
        // never log plaintext email — keep a domain-only breadcrumb
        targetEmailDomain: target.email.split("@")[1] ?? null,
      },
    },
  });

  // Cascade delete in dependency order.
  await prisma.$transaction(async (tx) => {
    const candidate = await tx.candidate.findUnique({
      where: { userId: targetUserId },
    });
    const enterprise = await tx.enterprise.findUnique({
      where: { userId: targetUserId },
    });

    if (candidate) {
      // Applications and their dependents
      const apps = await tx.application.findMany({
        where: { candidateId: candidate.id },
        select: { id: true },
      });
      const appIds = apps.map((a) => a.id);
      if (appIds.length > 0) {
        await tx.checkinPing.deleteMany({
          where: { applicationId: { in: appIds } },
        });
        await tx.interview.deleteMany({
          where: { applicationId: { in: appIds } },
        });
        await tx.checkpoint.deleteMany({
          where: { applicationId: { in: appIds } },
        });
      }
      await tx.application.deleteMany({
        where: { candidateId: candidate.id },
      });
      await tx.matching.deleteMany({
        where: { candidateId: candidate.id },
      });
      await tx.checkpoint.deleteMany({
        where: { candidateId: candidate.id },
      });
      await tx.conversation.deleteMany({
        where: { candidateId: candidate.id },
      });
      await tx.document.deleteMany({
        where: { candidateId: candidate.id },
      });
      await tx.candidate.delete({ where: { id: candidate.id } });
    }

    if (enterprise) {
      const offers = await tx.jobOffer.findMany({
        where: { enterpriseId: enterprise.id },
        select: { id: true },
      });
      const offerIds = offers.map((o) => o.id);
      if (offerIds.length > 0) {
        const apps = await tx.application.findMany({
          where: { jobOfferId: { in: offerIds } },
          select: { id: true },
        });
        const appIds = apps.map((a) => a.id);
        if (appIds.length > 0) {
          await tx.checkinPing.deleteMany({
            where: { applicationId: { in: appIds } },
          });
          await tx.interview.deleteMany({
            where: { applicationId: { in: appIds } },
          });
          await tx.checkpoint.deleteMany({
            where: { applicationId: { in: appIds } },
          });
        }
        await tx.application.deleteMany({
          where: { jobOfferId: { in: offerIds } },
        });
        await tx.matching.deleteMany({
          where: { jobOfferId: { in: offerIds } },
        });
        await tx.jobOffer.deleteMany({
          where: { enterpriseId: enterprise.id },
        });
      }
      await tx.invoice.deleteMany({
        where: { enterpriseId: enterprise.id },
      });
      await tx.document.deleteMany({
        where: { enterpriseId: enterprise.id },
      });
      await tx.enterprise.delete({ where: { id: enterprise.id } });
    }

    // Staff notes authored BY this user (rare for non-staff but cleanly handled)
    await tx.staffNote.deleteMany({ where: { staffId: targetUserId } });

    // Audit logs authored BY the target user (their own past actions). Right
    // to erasure (GDPR Art.17) overrides the 5y retention rule for the data
    // subject's own data — but the *erasure* AuditLog row, written above
    // with userId=actor.id, is preserved.
    // NOTE: schema FK on AuditLog.userId is non-nullable, so we must remove
    // these rows here to avoid violating the FK on the User.delete below.
    // A future migration could make AuditLog.userId nullable + introduce a
    // separate `subjectUserId` column to retain the activity record while
    // erasing identity links.
    await tx.auditLog.deleteMany({ where: { userId: targetUserId } });

    await tx.user.delete({ where: { id: targetUserId } });
  });

  return NextResponse.json({ erased: targetUserId });
}
