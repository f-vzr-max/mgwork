import type { Config } from "jest";

// TS-aware Jest config. Most lib tests are pure functions; the matching test
// uses jest.mock for `@/lib/prisma`. Coverage thresholds are intentionally
// modest (70%) — they protect lib/** from regressing, not the whole tree.

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/tests/unit/**/*.test.ts", "<rootDir>/tests/unit/**/*.test.tsx", "<rootDir>/scripts/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
  // Don't pull Playwright e2e specs into Jest.
  testPathIgnorePatterns: ["/node_modules/", "/\\.next/", "/tests/e2e/"],
  // Coverage scope is limited to the M1 (Wave 1) lib modules tested here.
  // Wave 2 modules (lib/email/*, lib/social/*, lib/validation/{ai,chat,...},
  // lib/i18n.ts, lib/utils.ts, lib/roles.ts, lib/staff-auth.ts) are owned by
  // other agents and tested in their own suites. Adding them here would create
  // a misleading 0% coverage regression.
  collectCoverageFrom: [
    "lib/scoring.ts",
    "lib/dates.ts",
    "lib/matching.ts",
    "lib/aidefence.ts",
    "lib/rate-limit.ts",
    "lib/billing.ts",
    "lib/validation/candidate.ts",
    "lib/validation/enterprise.ts",
    "lib/validation/document.ts",
    "lib/validation/job-offer.ts",
    "lib/validation/application.ts",
    "lib/validation/invoice.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  clearMocks: true,
  // Stop after first 5 unrelated failures so the developer feedback is fast.
  bail: 0,
};

export default config;
