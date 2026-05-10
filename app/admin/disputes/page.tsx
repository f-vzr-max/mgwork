// Admin disputes view — read-only timeline of Checkpoints flagged
// `INTERVENTION_REQUIRED`. Staff own the actual intervention; admin observes.

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDisputesPage() {
  const items = await prisma.checkpoint.findMany({
    where: { status: "INTERVENTION_REQUIRED" },
    orderBy: { date: "desc" },
    take: 100,
    include: {
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          user: { select: { email: true } },
        },
      },
      application: {
        select: {
          id: true,
          jobOffer: {
            select: {
              id: true,
              title: true,
              enterprise: { select: { id: true, companyName: true } },
            },
          },
        },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Disputes"
        description="Open interventions across deployed candidates. Read-only — staff handles resolution."
      />
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Candidate</th>
                  <th className="p-3">Enterprise</th>
                  <th className="p-3">Offer</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No open interventions.
                    </td>
                  </tr>
                ) : (
                  items.map((c) => (
                    <tr key={c.id} className="border-b last:border-b-0 align-top">
                      <td className="p-3 whitespace-nowrap">
                        {c.date.toISOString().slice(0, 10)}
                      </td>
                      <td className="p-3">
                        {c.candidate.firstName} {c.candidate.lastName}
                        <div className="text-xs text-muted-foreground">
                          {c.candidate.user.email}
                        </div>
                      </td>
                      <td className="p-3">
                        {c.application?.jobOffer?.enterprise?.companyName ?? "—"}
                      </td>
                      <td className="p-3">
                        {c.application?.jobOffer?.title ?? "—"}
                      </td>
                      <td className="p-3 max-w-md whitespace-pre-wrap">
                        {c.interventionLog ?? c.notes ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
