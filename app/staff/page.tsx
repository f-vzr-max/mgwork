import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function StaffDashboard() {
  return (
    <>
      <PageHeader title="Staff dashboard" description="Document verification and post-deployment follow-up." />
      <div className="grid gap-4 p-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Documents pending</CardTitle>
            <CardDescription>0 in queue</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Nothing to verify right now.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open follow-ups</CardTitle>
            <CardDescription>0 due this week</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">No checkpoints scheduled.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active alerts</CardTitle>
            <CardDescription>0 needing intervention</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">All clear.</CardContent>
        </Card>
      </div>
    </>
  );
}
