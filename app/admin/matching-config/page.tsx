// MG Work — Admin matching-config (M5).
//
// Server-rendered shell that loads the current weights then hands them to the
// client editor below. The editor sends a PUT to /api/admin/matching-config
// with the full `{ weights }` shape on save.

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMatchingWeights } from "@/lib/matching-config";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchingConfigEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function MatchingConfigPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
  if (!user) redirect("/onboarding");
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return (
      <>
        <PageHeader title="Forbidden" description="Admin only." />
      </>
    );
  }

  const weights = await getMatchingWeights();

  return (
    <>
      <PageHeader
        title="Matching weights"
        description="Tune how strongly each criterion contributes to candidate ranking."
      />
      <div className="p-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Compatibility weights</CardTitle>
            <CardDescription>
              Each weight is bounded 0–100. Scores are normalized against the total weight, so the absolute
              numbers don&apos;t have to sum to 100 — relative size is what matters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MatchingConfigEditor initial={weights} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
