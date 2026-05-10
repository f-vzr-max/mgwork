import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";

export default async function LandingPage() {
  const t = await getTranslations();
  const year = new Date().getFullYear();

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-card px-8 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-primary">
          MG Work
        </Link>
        <nav className="flex items-center gap-3">
          <LanguageToggle />
          <Button asChild variant="ghost">
            <Link href="/sign-in">{t("home.signIn")}</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">{t("home.start")}</Link>
          </Button>
        </nav>
      </header>

      <section className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {t("home.heroTitle")}{" "}
            <span className="text-primary">{t("home.heroHighlight")}</span>
            {t("home.heroSuffix")}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">{t("home.subtitle")}</p>
          <div className="mt-10 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">{t("home.createAccount")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-in">{t("home.haveAccount")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t bg-card px-8 py-4 text-xs text-muted-foreground">
        &copy; {year} MG Work — {t("home.footer")}
      </footer>
    </main>
  );
}
