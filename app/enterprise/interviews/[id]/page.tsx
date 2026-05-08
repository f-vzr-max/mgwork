// MG Work — Single interview detail (M7, enterprise side).
//
// Server component. Renders interview info, the optional video URL as an
// iframe (provider-agnostic — Daily / Whereby / Google Meet all expose
// embeddable URLs), and a notes form posting to /api/interviews/[id].

import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InterviewNotesForm } from "./notes-form";

export const dynamic = "force-dynamic";

export default async function EnterpriseInterviewDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      role: true,
      enterprise: { select: { id: true } },
    },
  });
  if (!user) redirect("/sign-in");

  if (
    user.role !== "ENTERPRISE" &&
    user.role !== "ADMIN" &&
    user.role !== "SUPER_ADMIN"
  ) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You do not have access to this page.
      </div>
    );
  }

  const interview = await prisma.interview.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      scheduledAt: true,
      type: true,
      videoUrl: true,
      status: true,
      enterpriseNotes: true,
      application: {
        select: {
          id: true,
          candidate: {
            select: { id: true, firstName: true, lastName: true },
          },
          jobOffer: {
            select: { id: true, title: true, enterpriseId: true },
          },
        },
      },
    },
  });
  if (!interview) notFound();

  // Ownership: enterprise must own the offer.
  if (
    user.role === "ENTERPRISE" &&
    user.enterprise &&
    interview.application.jobOffer.enterpriseId !== user.enterprise.id
  ) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Not your interview.
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`Interview — ${interview.application.candidate.firstName} ${interview.application.candidate.lastName}`}
        description={interview.application.jobOffer.title}
      />

      <div className="grid gap-6 p-6 md:grid-cols-2">
        <div className="rounded-md border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Details</h2>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Scheduled</dt>
            <dd>{format(interview.scheduledAt, "EEE d MMM yyyy, HH:mm")}</dd>
            <dt className="text-muted-foreground">Type</dt>
            <dd>{interview.type}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{interview.status}</dd>
            {interview.videoUrl && (
              <>
                <dt className="text-muted-foreground">Video URL</dt>
                <dd className="break-all">
                  <a
                    href={interview.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {interview.videoUrl}
                  </a>
                </dd>
              </>
            )}
          </dl>
        </div>

        {interview.videoUrl && (
          <div className="rounded-md border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Live video</h2>
            <div className="aspect-video w-full overflow-hidden rounded-md border">
              <iframe
                src={interview.videoUrl}
                title="Interview video"
                className="h-full w-full"
                allow="camera; microphone; fullscreen; speaker; display-capture"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Provider-agnostic embed. Some providers require additional auth.
            </p>
          </div>
        )}

        <div className="rounded-md border bg-card p-4 md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Notes & status</h2>
          <InterviewNotesForm
            interviewId={interview.id}
            initialNotes={interview.enterpriseNotes ?? ""}
            initialStatus={interview.status}
            initialVideoUrl={interview.videoUrl ?? ""}
          />
        </div>
      </div>
    </>
  );
}
