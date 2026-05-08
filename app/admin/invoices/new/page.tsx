// New-invoice form. Server-renders the enterprise list to populate the
// dropdown; the form itself is a small client component so we can show
// validation errors inline before redirecting on success.

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { NewInvoiceForm } from "@/components/admin/NewInvoiceForm";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const enterprises = await prisma.enterprise.findMany({
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
    take: 500,
  });

  return (
    <>
      <PageHeader
        title="Create invoice"
        description="Issue a new invoice to an enterprise. Status starts as PENDING."
      />
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <NewInvoiceForm enterprises={enterprises} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
