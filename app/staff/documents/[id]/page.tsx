import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { canAccess, type Role } from "@/lib/roles";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocumentStatusBadge, type DocumentStatusValue } from "@/components/staff/StatusBadge";
import { InlineScanViewer } from "@/components/staff/InlineScanViewer";
import { DocumentReviewForm } from "@/components/staff/DocumentReviewForm";

// Document review screen. Embeds the scan/PDF preview, shows owner +
// metadata, lists prior audit-log actions on this document, and exposes
// the approve/reject form (rejection reason ≥ 10 chars enforced on both
// client and server).

export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function formatActionLabel(action: string, t: Awaited<ReturnType<typeof getTranslations>>): string {
  // document.approve -> "Approved", document.reject -> "Rejected", document.upload -> "Uploaded"
  const verb = action.split(".")[1] ?? action;
  if (verb === "approve") return t("documentReview.action.approved");
  if (verb === "reject") return t("documentReview.action.rejected");
  if (verb === "upload") return t("documentReview.action.uploaded");
  if (verb === "update") return t("documentReview.action.updated");
  if (verb === "delete") return t("documentReview.action.deleted");
  return verb.charAt(0).toUpperCase() + verb.slice(1);
}

export default async function StaffDocumentReviewPage({ params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
  if (!user) redirect("/sign-in");
  if (!canAccess(user.role as Role, "staff")) redirect("/");
  const t = await getTranslations("app.staff");

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true } },
      enterprise: { select: { id: true, companyName: true } },
    },
  });
  if (!doc) notFound();

  // Prior audit entries scoped to this document. Most recent first.
  const auditRows = await prisma.auditLog.findMany({
    where: { resourceType: "document", resourceId: doc.id },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      action: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });

  const ownerLabel = doc.candidate
    ? `${doc.candidate.firstName} ${doc.candidate.lastName}`
    : doc.enterprise?.companyName ?? t("documentReview.ownerUnknown");
  const ownerKind = doc.candidate
    ? t("documentReview.ownerKind.candidate")
    : t("documentReview.ownerKind.enterprise");

  const isPending = doc.status === "PENDING";

  return (
    <>
      <PageHeader title={t("documentReview.title", { docType: doc.type.replace(/_/g, " ") })} description={t("documentReview.description", { ownerKind, ownerLabel })}>
        <Button asChild variant="outline" size="sm">
          <Link href="/staff/documents">{t("documentReview.backToQueue")}</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 p-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("documentReview.scanPreview.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <InlineScanViewer documentId={doc.id} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("documentReview.metadata.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("documentReview.metadata.status")}</span>
                <DocumentStatusBadge status={doc.status as DocumentStatusValue} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("documentReview.metadata.type")}</span>
                <span>{doc.type.replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("documentReview.metadata.uploaded")}</span>
                <span>{formatDateTime(doc.createdAt)}</span>
              </div>
              {doc.expiresAt ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("documentReview.metadata.expires")}</span>
                  <span>{formatDateTime(doc.expiresAt)}</span>
                </div>
              ) : null}
              {doc.verifiedAt ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("documentReview.metadata.verifiedAt")}</span>
                  <span>{formatDateTime(doc.verifiedAt)}</span>
                </div>
              ) : null}
              {doc.rejectionNote ? (
                <div className="border-t pt-2">
                  <span className="text-muted-foreground">{t("documentReview.metadata.rejectionNote")}</span>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-red-700">{doc.rejectionNote}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("documentReview.decision.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {isPending ? (
                <DocumentReviewForm documentId={doc.id} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("documentReview.decision.notPending", { status: doc.status.toLowerCase() })}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("documentReview.activity.title")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {auditRows.length === 0 ? (
                <p className="px-6 py-4 text-sm text-muted-foreground">{t("documentReview.activity.empty")}</p>
              ) : (
                <ul className="divide-y">
                  {auditRows.map((row) => (
                    <li key={row.id} className="flex items-start justify-between gap-4 px-6 py-3 text-sm">
                      <div>
                        <div className="font-medium">{formatActionLabel(row.action, t)}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.user?.email ?? t("documentReview.activity.systemActor")}
                        </div>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
