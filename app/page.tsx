import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-card px-8 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-primary">
          MG Work
        </Link>
        <nav className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
        </nav>
      </header>

      <section className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Mauritius hires Madagascar — <span className="text-primary">cleanly</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            MG Work is the matchmaking platform connecting Mauritian employers with qualified Malagasy candidates,
            built to international HR and legal compliance standards.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">Create your account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-in">I already have one</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t bg-card px-8 py-4 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} MG Work — Phase 1 build.
      </footer>
    </main>
  );
}
