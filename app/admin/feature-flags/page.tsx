// Admin feature-flags page — lists existing flags, lets admin toggle and add
// new ones. SUPER_ADMIN-only writes are enforced server-side. Business logic
// preserved; chrome restyled with MG design system primitives.

import { PageHeader, Card } from "@/components/mg";
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
        subtitle="Activer / désactiver des capacités globales. Les effets se propagent immédiatement."
      />
      <div style={{ padding: "0 32px 32px" }}>
        <Card padding={24}>
          <FeatureFlagsManager
            initial={flags.map((f) => ({
              key: f.key,
              enabled: f.enabled,
              updatedAt: f.updatedAt.toISOString(),
            }))}
          />
        </Card>
      </div>
    </>
  );
}
