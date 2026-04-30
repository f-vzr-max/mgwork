import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function EnterpriseDashboard() {
  return (
    <>
      <PageHeader title="Enterprise dashboard" description="Open offers, shortlists, and active deployments." />
      <div className="grid gap-4 p-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Active offers</CardTitle>
            <CardDescription>0 published</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Post your first offer to receive matches.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Shortlisted candidates</CardTitle>
            <CardDescription>0 awaiting review</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">No shortlists yet.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Deployed staff</CardTitle>
            <CardDescription>0 placed</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Once candidates are deployed, you can track them here.</CardContent>
        </Card>
      </div>
    </>
  );
}
