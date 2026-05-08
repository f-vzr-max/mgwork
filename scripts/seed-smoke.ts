// Smoke-test seed. Idempotent: re-runs upsert per row keyed by email/clerkId.
//
// Run via: npm run seed:smoke
//
// Inserts: 1 candidate + 1 enterprise + 2 staff + 1 admin users (synthetic
// clerkIds — these accounts cannot login through Clerk, but staff/admin
// dashboards can render rows that reference them). For real signup smoke
// tests, use Clerk's UI in the browser.
//
// Also seeds: 1 ACTIVE JobOffer, 1 PENDING Document on the candidate, and
// the MatchingConfig singleton with DEFAULT_WEIGHTS.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertUser(input: {
  clerkId: string;
  email: string;
  role:
    | "SUPER_ADMIN"
    | "ADMIN"
    | "STAFF_FOLLOWUP"
    | "STAFF_DOCUMENTS"
    | "ENTERPRISE"
    | "CANDIDATE";
}) {
  return prisma.user.upsert({
    where: { clerkId: input.clerkId },
    update: { email: input.email, role: input.role },
    create: { clerkId: input.clerkId, email: input.email, role: input.role, lang: "FR" },
  });
}

async function main() {
  // 1. Users (synthetic Clerk IDs — for UI signups, use the Clerk sign-up flow)
  const candidateUser = await upsertUser({
    clerkId: "smoke_candidate_user",
    email: "smoke.candidate@mgwork.test",
    role: "CANDIDATE",
  });
  const enterpriseUser = await upsertUser({
    clerkId: "smoke_enterprise_user",
    email: "smoke.enterprise@mgwork.test",
    role: "ENTERPRISE",
  });
  const staffDocsUser = await upsertUser({
    clerkId: "smoke_staff_docs_user",
    email: "smoke.staff.docs@mgwork.test",
    role: "STAFF_DOCUMENTS",
  });
  const staffFollowupUser = await upsertUser({
    clerkId: "smoke_staff_followup_user",
    email: "smoke.staff.followup@mgwork.test",
    role: "STAFF_FOLLOWUP",
  });
  const adminUser = await upsertUser({
    clerkId: "smoke_admin_user",
    email: "smoke.admin@mgwork.test",
    role: "SUPER_ADMIN",
  });

  // 2. Candidate profile
  const candidate = await prisma.candidate.upsert({
    where: { userId: candidateUser.id },
    update: {},
    create: {
      userId: candidateUser.id,
      firstName: "Hery",
      lastName: "Rakoto",
      dateOfBirth: new Date("1995-04-12"),
      nationality: "MG",
      phone: "+261 34 00 00 00",
      city: "Antananarivo",
      bio: "Bartender with 5 years experience in Antananarivo hotels.",
      skills: ["bartender", "english", "cocktails", "customer-service"],
      sectors: ["hospitality"],
      langScoreFR: 80,
      langScoreEN: 60,
      profileScore: 60,
    },
  });

  // 3. Enterprise profile
  const enterprise = await prisma.enterprise.upsert({
    where: { userId: enterpriseUser.id },
    update: {},
    create: {
      userId: enterpriseUser.id,
      companyName: "Grand Baie Resorts Ltd.",
      registrationNumber: "C-12345-MU",
      sector: "hospitality",
      address: "Royal Road, Grand Baie, Mauritius",
      contactName: "Marie Dupont",
      contactPhone: "+230 5 000 0000",
      verified: true,
      plan: "FREE",
    },
  });

  // 4. ACTIVE job offer (idempotent by [enterpriseId, title])
  const existingOffer = await prisma.jobOffer.findFirst({
    where: { enterpriseId: enterprise.id, title: "Bartender — Grand Baie" },
  });
  const offer =
    existingOffer ??
    (await prisma.jobOffer.create({
      data: {
        enterpriseId: enterprise.id,
        title: "Bartender — Grand Baie",
        description:
          "Beachfront resort hiring a senior bartender. 5* property, English-speaking guests.",
        sector: "hospitality",
        location: "Mauritius",
        slots: 2,
        status: "ACTIVE",
        requirements: ["bartender", "cocktails", "customer-service"],
        langRequired: ["EN"],
      },
    }));

  // 5. PENDING document on the candidate (passport, expiring in 90 days)
  const existingDoc = await prisma.document.findFirst({
    where: { candidateId: candidate.id, type: "PASSPORT" },
  });
  const document =
    existingDoc ??
    (await prisma.document.create({
      data: {
        type: "PASSPORT",
        fileUrl: "supabase://passports/CANDIDATE/" + candidate.id + "/PASSPORT/seed-passport.pdf",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        candidateId: candidate.id,
      },
    }));

  // 6. MatchingConfig singleton (id = "singleton")
  const matchingConfig = await prisma.matchingConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      weights: {
        skills: 30,
        languages: 20,
        sector: 15,
        mobility: 10,
        experience: 15,
        documents: 10,
      },
    },
  });

  console.log("Smoke seed complete:");
  console.log("  candidate.userId      =", candidateUser.id);
  console.log("  candidate.id          =", candidate.id);
  console.log("  enterprise.userId     =", enterpriseUser.id);
  console.log("  enterprise.id         =", enterprise.id);
  console.log("  staffDocs.userId      =", staffDocsUser.id);
  console.log("  staffFollowup.userId  =", staffFollowupUser.id);
  console.log("  admin.userId          =", adminUser.id);
  console.log("  jobOffer.id           =", offer.id);
  console.log("  document.id           =", document.id);
  console.log("  matchingConfig.id     =", matchingConfig.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
