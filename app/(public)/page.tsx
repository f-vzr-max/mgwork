import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Badge,
  Button,
  Card,
  Hairline,
  Icon,
  LogoMarquee,
  MatchingCardStack,
  MobileCarousel,
  PublicShell,
  Section,
  SectionHeader,
  Stack,
  type MatchingCard,
} from "@/components/mg";
import {
  CountryCard,
  CtaBanner,
  FaqItem,
  SectorCard,
  StepCard,
  TestimonialCard,
} from "./_components";

export async function generateMetadata() {
  const t = await getTranslations("marketing");
  return {
    title: t("home.metaTitle"),
    description: t("home.metaDescription"),
  };
}

async function HomeHero() {
  const t = await getTranslations("marketing");

  const matchingCards: MatchingCard[] = [
    {
      name: "Tahiry Razafy",
      short: t("home.hero.match1.name"),
      origin: t("home.hero.match1.role"),
      score: 87,
      role: t("home.hero.match1.target"),
    },
    {
      name: "Naina Andriana",
      short: t("home.hero.match2.name"),
      origin: t("home.hero.match2.role"),
      score: 74,
      role: t("home.hero.match2.target"),
    },
    {
      name: "Iary Rakoto",
      short: t("home.hero.match3.name"),
      origin: t("home.hero.match3.role"),
      score: 92,
      role: t("home.hero.match3.target"),
    },
  ];

  return (
    <div
      className="px-4 md:px-8 py-12 md:py-16"
      style={{
        background:
          "linear-gradient(180deg, rgba(26,60,110,0.06) 0%, hsl(var(--background)) 100%)",
      }}
    >
      <div
        className="mx-auto grid w-full max-w-[1120px] grid-cols-1 items-center gap-10 md:grid-cols-[1.1fr_0.9fr] md:gap-14"
      >
        <div>
          <Badge tone="primary" size="md" icon="shield-check" style={{ marginBottom: 20 }}>
            {t("home.hero.badge")}
          </Badge>
          <h1 className="mg-display" style={{ margin: 0, maxWidth: 540 }}>
            {t("home.hero.titlePart1")}
            <br />
            {t("home.hero.titlePart2Prefix")}
            <span style={{ color: "hsl(var(--primary))" }}>{t("home.hero.titleHighlight")}</span>
            {t("home.hero.titleSuffix")}
          </h1>
          <p
            className="mg-body-lg"
            style={{
              margin: "20px 0 0",
              color: "hsl(var(--muted-foreground))",
              maxWidth: 480,
            }}
          >
            {t("home.hero.subtitle")}
          </p>
          <Stack dir="row" gap={12} style={{ marginTop: 32 }}>
            <Link href="/sign-up?role=candidate" className="no-underline">
              <Button size="lg" iconRight="arrow-right">
                {t("cta.iAmCandidate")}
              </Button>
            </Link>
            <Link href="/sign-up?role=employer" className="no-underline">
              <Button size="lg" variant="outline" iconRight="arrow-up-right">
                {t("cta.iAmRecruiting")}
              </Button>
            </Link>
          </Stack>
          <div
            style={{
              marginTop: 40,
              display: "flex",
              gap: 32,
              alignItems: "center",
            }}
          >
            <div>
              <div
                className="mg-tabular"
                style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}
              >
                {t("home.hero.stats.placed.value")}
              </div>
              <div
                className="mg-caption"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {t("home.hero.stats.placed.label")}
              </div>
            </div>
            <Hairline vertical style={{ height: 32 }} />
            <div>
              <div
                className="mg-tabular"
                style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}
              >
                {t("home.hero.stats.partners.value")}
              </div>
              <div
                className="mg-caption"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {t("home.hero.stats.partners.label")}
              </div>
            </div>
            <Hairline vertical style={{ height: 32 }} />
            <div>
              <div
                className="mg-tabular"
                style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}
              >
                {t("home.hero.stats.countries.value")}
              </div>
              <div
                className="mg-caption"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {t("home.hero.stats.countries.label")}
              </div>
            </div>
          </div>
        </div>
        <MatchingCardStack cards={matchingCards} forLabel={t("home.hero.matchFor")} />
      </div>
    </div>
  );
}

export default async function HomePage() {
  const t = await getTranslations("marketing");

  const sectors = [
    { icon: "briefcase" as const, name: t("home.sectors.hospitality"), jobs: 312, growth: "+24%" },
    { icon: "building-2" as const, name: t("home.sectors.construction"), jobs: 248, growth: "+18%" },
    { icon: "stethoscope" as const, name: t("home.sectors.health"), jobs: 184, growth: "+31%" },
    { icon: "star" as const, name: t("home.sectors.restaurant"), jobs: 156, growth: "+12%" },
    { icon: "shield-check" as const, name: t("home.sectors.security"), jobs: 92, growth: "+8%" },
    { icon: "home" as const, name: t("home.sectors.domestic"), jobs: 78, growth: "+15%" },
  ];

  const pillars = [
    {
      icon: "users" as const,
      title: t("home.pillars.verified.title"),
      body: t("home.pillars.verified.body"),
    },
    {
      icon: "sparkles" as const,
      title: t("home.pillars.matching.title"),
      body: t("home.pillars.matching.body"),
    },
    {
      icon: "shield-check" as const,
      title: t("home.pillars.compliance.title"),
      body: t("home.pillars.compliance.body"),
    },
  ];

  const numbers = [
    { v: t("home.numbers.placed.value"), l: t("home.numbers.placed.label") },
    { v: t("home.numbers.partners.value"), l: t("home.numbers.partners.label") },
    { v: t("home.numbers.delay.value"), l: t("home.numbers.delay.label") },
    { v: t("home.numbers.retention.value"), l: t("home.numbers.retention.label") },
  ];

  const trustLogos = [
    "HÔTEL LUX",
    "CLINIQUE ATLANTIS",
    "BTP RÉUNION",
    "SUCRIÈRE MU",
    "CONSTANCE",
    "BEACHCOMBER",
  ];

  return (
    <PublicShell active={null}>
      <HomeHero />

      {/* Logos / trust strip */}
      <LogoMarquee logos={trustLogos} label={t("home.trust.label")} />

      {/* How it works — split */}
      <Section padY={96}>
        <SectionHeader
          eyebrow={t("home.howItWorks.eyebrow")}
          title={t("home.howItWorks.title")}
          subtitle={t("home.howItWorks.subtitle")}
          align="center"
          maxWidth={620}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div>
            <Badge tone="info" size="md" icon="users" style={{ marginBottom: 16 }}>
              {t("home.howItWorks.candidate.badge")}
            </Badge>
            <h3 className="mg-h2" style={{ margin: "0 0 24px" }}>
              {t("home.howItWorks.candidate.title")}
            </h3>
            <div style={{ display: "grid", gap: 12 }}>
              <StepCard
                n={1}
                title={t("home.howItWorks.candidate.step1.title")}
                body={t("home.howItWorks.candidate.step1.body")}
                icon="users"
              />
              <StepCard
                n={2}
                title={t("home.howItWorks.candidate.step2.title")}
                body={t("home.howItWorks.candidate.step2.body")}
                icon="sparkles"
              />
              <StepCard
                n={3}
                title={t("home.howItWorks.candidate.step3.title")}
                body={t("home.howItWorks.candidate.step3.body")}
                icon="arrow-up-right"
              />
            </div>
          </div>
          <div>
            <Badge tone="primary" size="md" icon="building-2" style={{ marginBottom: 16 }}>
              {t("home.howItWorks.enterprise.badge")}
            </Badge>
            <h3 className="mg-h2" style={{ margin: "0 0 24px" }}>
              {t("home.howItWorks.enterprise.title")}
            </h3>
            <div style={{ display: "grid", gap: 12 }}>
              <StepCard
                n={1}
                title={t("home.howItWorks.enterprise.step1.title")}
                body={t("home.howItWorks.enterprise.step1.body")}
                icon="briefcase"
              />
              <StepCard
                n={2}
                title={t("home.howItWorks.enterprise.step2.title")}
                body={t("home.howItWorks.enterprise.step2.body")}
                icon="shield-check"
              />
              <StepCard
                n={3}
                title={t("home.howItWorks.enterprise.step3.title")}
                body={t("home.howItWorks.enterprise.step3.body")}
                icon="check-circle-2"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Pillars */}
      <Section padY={80} surface={2}>
        <SectionHeader
          eyebrow={t("home.pillars.eyebrow")}
          title={t("home.pillars.title")}
          align="center"
        />
        <MobileCarousel desktopCols={3} ariaLabel={t("home.pillars.eyebrow")}>
          {pillars.map((p) => (
            <Card key={p.title} padding={28}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: "var(--primary-bg)",
                  color: "hsl(var(--primary))",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <Icon name={p.icon} size={24} />
              </div>
              <h3 className="mg-h3" style={{ margin: 0 }}>
                {p.title}
              </h3>
              <p
                className="mg-body"
                style={{
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 8,
                  marginBottom: 0,
                }}
              >
                {p.body}
              </p>
            </Card>
          ))}
        </MobileCarousel>
      </Section>

      {/* Sectors */}
      <Section padY={96}>
        <SectionHeader
          eyebrow={t("home.sectors.eyebrow")}
          title={t("home.sectors.title")}
          subtitle={t("home.sectors.subtitle")}
        />
        <MobileCarousel desktopCols={3} ariaLabel={t("home.sectors.eyebrow")}>
          {sectors.map((s) => (
            <SectorCard key={s.name} {...s} />
          ))}
        </MobileCarousel>
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link href="/candidats" className="no-underline">
            <Button variant="outline" iconRight="arrow-right">
              {t("cta.viewAllSectors")}
            </Button>
          </Link>
        </div>
      </Section>

      {/* Countries */}
      <Section padY={96} surface={2}>
        <SectionHeader
          eyebrow={t("home.countries.eyebrow")}
          title={t("home.countries.title")}
        />
        <MobileCarousel desktopCols={3} ariaLabel={t("home.countries.eyebrow")}>
          <CountryCard
            name={t("home.countries.mauritius.name")}
            label={t("home.countries.mauritius.label")}
            flagColors={["#1A3C6E", "#007B55"]}
            stats={[
              { value: "52", label: t("home.countries.stats.companies") },
              { value: "720+", label: t("home.countries.stats.placements") },
              { value: "14 j", label: t("home.countries.stats.avgDelay") },
              { value: "12", label: t("home.countries.stats.sectors") },
            ]}
          />
          <CountryCard
            name={t("home.countries.reunion.name")}
            label={t("home.countries.reunion.label")}
            flagColors={["#1373B0", "#5B3D8B"]}
            stats={[
              { value: "23", label: t("home.countries.stats.companies") },
              { value: "310+", label: t("home.countries.stats.placements") },
              { value: "18 j", label: t("home.countries.stats.avgDelay") },
              { value: "8", label: t("home.countries.stats.sectors") },
            ]}
          />
          <CountryCard
            name={t("home.countries.seychelles.name")}
            label={t("home.countries.seychelles.label")}
            flagColors={["#007B55", "#DC8A12"]}
            stats={[
              { value: "12", label: t("home.countries.stats.companies") },
              { value: "210+", label: t("home.countries.stats.placements") },
              { value: "22 j", label: t("home.countries.stats.avgDelay") },
              { value: "6", label: t("home.countries.stats.sectors") },
            ]}
          />
        </MobileCarousel>
      </Section>

      {/* Testimonials */}
      <Section padY={96}>
        <SectionHeader
          eyebrow={t("home.testimonials.eyebrow")}
          title={t("home.testimonials.title")}
          align="center"
        />
        <MobileCarousel desktopCols={3} ariaLabel={t("home.testimonials.eyebrow")}>
          <TestimonialCard
            quote={t("home.testimonials.t1.quote")}
            name={t("home.testimonials.t1.name")}
            role={t("home.testimonials.t1.role")}
            score={91}
          />
          <TestimonialCard
            quote={t("home.testimonials.t2.quote")}
            name={t("home.testimonials.t2.name")}
            role={t("home.testimonials.t2.role")}
          />
          <TestimonialCard
            quote={t("home.testimonials.t3.quote")}
            name={t("home.testimonials.t3.name")}
            role={t("home.testimonials.t3.role")}
            score={84}
          />
        </MobileCarousel>
      </Section>

      {/* Numbers */}
      <Section padY={80} surface={2}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {numbers.map((s) => (
            <div key={s.l} style={{ textAlign: "center" }}>
              <div
                className="mg-tabular text-[28px] sm:text-[32px] md:text-[40px] whitespace-nowrap"
                style={{
                  fontWeight: 700,
                  color: "hsl(var(--primary))",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {s.v}
              </div>
              <div
                className="mg-body-sm"
                style={{ color: "hsl(var(--muted-foreground))", marginTop: 8 }}
              >
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section padY={96}>
        <SectionHeader
          eyebrow={t("home.faq.eyebrow")}
          title={t("home.faq.title")}
          align="center"
        />
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gap: 12 }}>
          <FaqItem
            open
            q={t("home.faq.q1.q")}
            a={t("home.faq.q1.a")}
          />
          <FaqItem q={t("home.faq.q2.q")} />
          <FaqItem q={t("home.faq.q3.q")} />
          <FaqItem q={t("home.faq.q4.q")} />
          <FaqItem q={t("home.faq.q5.q")} />
        </div>
      </Section>

      {/* CTA */}
      <Section padY={80}>
        <CtaBanner
          title={t("home.cta.title")}
          body={t("home.cta.body")}
          primary={t("home.cta.primary")}
          primaryHref="/sign-up"
          secondary={t("home.cta.secondary")}
          secondaryHref="/contact"
        />
      </Section>
    </PublicShell>
  );
}
