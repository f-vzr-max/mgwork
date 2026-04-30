import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function CandidateDashboard() {
  return (
    <>
      <PageHeader title="Candidate dashboard" description="Your matches, applications, and document status." />
      <div className="grid gap-4 p-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile completion</CardTitle>
            <CardDescription>0 / 100</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Finish your profile to start receiving matches.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open applications</CardTitle>
            <CardDescription>0 in progress</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">No applications yet.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>0 verified</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Upload your passport and CV.</CardContent>
        </Card>
      </div>
    </>
  );
}
