import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function AdminDashboard() {
  return (
    <>
      <PageHeader title="Admin overview" description="Platform-wide health, signups, and compliance posture." />
      <div className="grid gap-4 p-6 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Candidates</CardTitle>
            <CardDescription>0 total</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">No candidates yet.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Enterprises</CardTitle>
            <CardDescription>0 verified</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">No enterprises yet.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active offers</CardTitle>
            <CardDescription>0 published</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">No offers yet.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open interventions</CardTitle>
            <CardDescription>0 needing attention</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">All clear.</CardContent>
        </Card>
      </div>
    </>
  );
}
