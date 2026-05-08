// Admin feature-flags page — lists existing flags, lets admin toggle and
// add new ones. SUPER_ADMIN-only writes are enforced server-side; the UI is
// shown to ADMIN and SUPER_ADMIN.

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { FeatureFlagsManager } from "@/components/admin/FeatureFlagsManager";

export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Feature flags"
        description="Toggle platform-level capabilities. Effects propagate immediately."
      />
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <FeatureFlagsManager
              initial={flags.map((f) => ({
                key: f.key,
                enabled: f.enabled,
                updatedAt: f.updatedAt.toISOString(),
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
