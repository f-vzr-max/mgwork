import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { canAccess, type Role } from "@/lib/roles";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckpointStatusBadge,
  type CheckpointStatusValue,
} from "@/components/staff/StatusBadge";
import { InterventionForm } from "@/components/staff/InterventionForm";
import { NoteForm } from "@/components/staff/NoteForm";

// Application detail for follow-up: candidate / enterprise summary, full
// checkpoint timeline, staff-notes thread, and the intervention form
// (creates a Checkpoint).

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export default async function FollowupDetailPage({ params }: { params: { applicationId: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
  if (!user) redirect("/sign-in");
  if (!canAccess(user.role as Role, "staff")) redirect("/");
  const t = await getTranslations("app.staff");

  const app = await prisma.application.findUnique({
    where: { id: params.applicationId },
    include: {
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          city: true,
          nationality: true,
          dateOfBirth: true,
        },
      },
      jobOffer: {
        select: {
          id: true,
          title: true,
          sector: true,
          location: true,
          enterprise: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              contactPhone: true,
              sector: true,
            },
          },
        },
      },
      checkpoints: {
        orderBy: { date: "desc" },
        select: {
          id: true,
          status: true,
          notes: true,
          interventionLog: true,
          date: true,
          staffId: true,
        },
      },
    },
  });
  if (!app) notFound();

  // Staff notes attached to this application.
  const notes = await prisma.staffNote.findMany({
    where: { resourceType: "application", resourceId: app.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      note: true,
      createdAt: true,
      staff: { select: { email: true } },
    },
  });

  return (
    <>
      <PageHeader
        title={`${app.candidate.firstName} ${app.candidate.lastName}`}
        description={`${app.jobOffer.title} · ${app.jobOffer.enterprise.companyName}`}
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/staff/followup">{t("followup.detail.back")}</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("followup.detail.candidateCard.title")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 mg-body-sm">
              <div>
                <div className="mg-caption text-muted-foreground">{t("followup.detail.candidateCard.fullName")}</div>
                <div>
                  {app.candidate.firstName} {app.candidate.lastName}
                </div>
              </div>
              <div>
                <div className="mg-caption text-muted-foreground">{t("followup.detail.candidateCard.nationality")}</div>
                <div>{app.candidate.nationality}</div>
              </div>
              <div>
                <div className="mg-caption text-muted-foreground">{t("followup.detail.candidateCard.phone")}</div>
                <div>{app.candidate.phone ?? "—"}</div>
              </div>
              <div>
                <div className="mg-caption text-muted-foreground">{t("followup.detail.candidateCard.city")}</div>
                <div>{app.candidate.city ?? "—"}</div>
              </div>
              <div>
                <div className="mg-caption text-muted-foreground">{t("followup.detail.candidateCard.dob")}</div>
                <div>{app.candidate.dateOfBirth ? fmtDate(app.candidate.dateOfBirth) : "—"}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("followup.detail.enterpriseCard.title")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 mg-body-sm">
              <div>
                <div className="mg-caption text-muted-foreground">{t("followup.detail.enterpriseCard.company")}</div>
                <div>{app.jobOffer.enterprise.companyName}</div>
              </div>
              <div>
                <div className="mg-caption text-muted-foreground">{t("followup.detail.enterpriseCard.sector")}</div>
                <div>{app.jobOffer.enterprise.sector ?? "—"}</div>
              </div>
              <div>
                <div className="mg-caption text-muted-foreground">{t("followup.detail.enterpriseCard.contact")}</div>
                <div>{app.jobOffer.enterprise.contactName ?? "—"}</div>
              </div>
              <div>
                <div className="mg-caption text-muted-foreground">{t("followup.detail.enterpriseCard.contactPhone")}</div>
                <div>{app.jobOffer.enterprise.contactPhone ?? "—"}</div>
              </div>
              <div className="col-span-2">
                <div className="mg-caption text-muted-foreground">{t("followup.detail.enterpriseCard.roleLocation")}</div>
                <div>
                  {app.jobOffer.title} · {app.jobOffer.location}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("followup.detail.checkpointForm.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <InterventionForm applicationId={app.id} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("followup.detail.timeline.title")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {app.checkpoints.length === 0 ? (
                <p className="px-6 py-4 mg-body-sm text-muted-foreground">{t("followup.detail.timeline.empty")}</p>
              ) : (
                <ul className="divide-y">
                  {app.checkpoints.map((c) => (
                    <li key={c.id} className="px-6 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <CheckpointStatusBadge status={c.status as CheckpointStatusValue} />
                        <span className="mg-caption text-muted-foreground">{fmtDateTime(c.date)}</span>
                      </div>
                      {c.notes ? (
                        <p className="mt-2 whitespace-pre-wrap mg-body-sm">{c.notes}</p>
                      ) : null}
                      {c.interventionLog ? (
                        <p className="mt-2 whitespace-pre-wrap rounded-md bg-amber-50 p-2 mg-caption text-amber-900">
                          <span className="font-medium">{t("followup.detail.timeline.interventionPrefix")}</span>
                          {c.interventionLog}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("followup.detail.notesCard.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NoteForm resourceType="application" resourceId={app.id} />
              {notes.length === 0 ? (
                <p className="mg-body-sm text-muted-foreground">{t("followup.detail.notesCard.empty")}</p>
              ) : (
                <ul className="space-y-3">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-md border bg-muted/20 p-3">
                      <div className="flex items-center justify-between mg-caption text-muted-foreground">
                        <span>{n.staff.email}</span>
                        <span>{fmtDateTime(n.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap mg-body-sm">{n.note}</p>
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
