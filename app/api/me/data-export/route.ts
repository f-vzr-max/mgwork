// GDPR Article 20 — Right to data portability.
//
// Returns the authenticated user's full record as a JSON blob: their
// User row, Candidate or Enterprise profile, Documents (metadata only —
// not the binary content; clients can fetch the files via signed URLs),
// Applications, Interviews, Conversations, Checkpoints.
//
// Auth: any authenticated user; returns ONLY their own data.
// Audit: logged as `user.export`.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

function getIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

export async function GET(req: Request) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new NextResponse("Unauthorized", { status: 401 });

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
  });
  if (!user) return new NextResponse("Not Found", { status: 404 });

  if (!(await rateLimit(clerkUserId, "user.export", 3, 3600)))
    return new NextResponse("Too Many Requests", { status: 429 });

  const candidate = await prisma.candidate.findUnique({
    where: { userId: user.id },
    include: {
      documents: {
        select: {
          id: true,
          type: true,
          status: true,
          expiresAt: true,
          rejectionNote: true,
          verifiedAt: true,
          createdAt: true,
          updatedAt: true,
          // Intentionally OMIT fileUrl — caller must use signed URL endpoint.
        },
      },
      applications: {
        include: {
          interviews: true,
          checkpoints: true,
          checkinPings: true,
        },
      },
      conversations: true,
      checkpoints: true,
    },
  });

  const enterprise = await prisma.enterprise.findUnique({
    where: { userId: user.id },
    include: {
      jobOffers: {
        include: { applications: true },
      },
      documents: {
        select: {
          id: true,
          type: true,
          status: true,
          expiresAt: true,
          rejectionNote: true,
          verifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      invoices: true,
    },
  });

  // Audit log AFTER successfully gathering the data — failure cases shouldn't
  // claim an export happened.
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "user.export",
      resourceType: "user",
      resourceId: user.id,
      ipAddress: getIp(req) ?? undefined,
      metadata: {
        hasCandidate: !!candidate,
        hasEnterprise: !!enterprise,
      },
    },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      lang: user.lang,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    candidate,
    enterprise,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="mgwork-data-export-${user.id}.json"`,
      // Prevent caching of personal data.
      "Cache-Control": "no-store",
    },
  });
}
