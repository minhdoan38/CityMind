import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const GOLDEN_DIR = path.join(ROOT, "tests", "contracts", "fastapi-golden");

const FIXTURE_FILES = [
  "analyze.json",
  "intake.json",
  "citizen-status.json",
  "officer-reports.json",
  "analytics.json",
] as const;

const REQUIRED_ENDPOINT_COVERAGE: Record<string, string> = {
  "POST /api/v1/reports/analyze": "analyze.json",
  "POST /api/v1/reports": "intake.json",
  "POST /api/v1/reports/status": "citizen-status.json",
  "GET /api/v1/reports/recent": "officer-reports.json",
  "GET /api/v1/reports/summary": "officer-reports.json",
  "GET /api/v1/reports/:id": "officer-reports.json",
  "GET /api/v1/reports/:id/status-history": "officer-reports.json",
  "GET /api/v1/reports/:id/image": "officer-reports.json",
  "PATCH /api/v1/reports/:id/status": "officer-reports.json",
  "GET /api/v1/reports/export": "officer-reports.json",
  "GET /api/v1/analytics": "analytics.json",
};

const DEFERRED_ENDPOINTS: Record<string, string> = {
  "GET /health": "07-15 production smoke gate",
  "GET /api/v1/reports/geo/pins": "Phase 6 geo pins; dashboard-map.test.mjs until ported",
  "GET /api/v1/public/stats": "Phase 5 public stats; public-stats.test.mjs until ported",
};

const FORBIDDEN_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._-]{8,}/,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  /service[_-]?role/i,
  /supabase\.co/i,
  /gs:\/\//i,
  /GOOGLE_CLOUD_PROJECT/i,
  /X-CityMind-Officer-Key:\s*\S+/i,
  /-----BEGIN/,
  /password\s*[:=]\s*["'][^"']+["']/i,
];

type FixtureCase = {
  id: string;
  endpoint?: string;
  request?: Record<string, unknown>;
  response: Record<string, unknown>;
};

type FixtureFile = {
  endpoint?: string;
  endpoints?: string[];
  cases: FixtureCase[];
  deferredToLaterSlices?: Record<string, string>;
};

function loadFixture(fileName: string): FixtureFile {
  const filePath = path.join(GOLDEN_DIR, fileName);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as FixtureFile;
}

function collectEndpoints(fixture: FixtureFile): Set<string> {
  const endpoints = new Set<string>();
  if (fixture.endpoint) endpoints.add(fixture.endpoint);
  if (fixture.endpoints) fixture.endpoints.forEach((e) => endpoints.add(e));
  for (const testCase of fixture.cases) {
    if (testCase.endpoint) endpoints.add(testCase.endpoint);
  }
  return endpoints;
}

function assertCaseShape(testCase: FixtureCase) {
  expect(testCase.id, "case id required").toBeTruthy();
  expect(testCase.response?.status, `${testCase.id} status required`).toBeTypeOf("number");
}

describe("fastapi golden contract fixtures", () => {
  const fixtures = FIXTURE_FILES.map((fileName) => ({
    fileName,
    fixture: loadFixture(fileName),
  }));

  it("loads all golden fixture files", () => {
    expect(fixtures).toHaveLength(5);
    for (const { fileName, fixture } of fixtures) {
      expect(fixture.cases.length, `${fileName} must contain cases`).toBeGreaterThan(0);
    }
  });

  it("validates fixture case structure", () => {
    for (const { fixture } of fixtures) {
      for (const testCase of fixture.cases) {
        assertCaseShape(testCase);
      }
    }
  });

  it("covers every legacy FastAPI endpoint or defers explicitly", () => {
    const covered = new Set<string>();
    const deferred = new Set(Object.keys(DEFERRED_ENDPOINTS));

    for (const { fixture } of fixtures) {
      collectEndpoints(fixture).forEach((endpoint) => covered.add(endpoint));
      Object.keys(fixture.deferredToLaterSlices ?? {}).forEach((endpoint) =>
        deferred.add(endpoint)
      );
    }

    for (const endpoint of Object.keys(REQUIRED_ENDPOINT_COVERAGE)) {
      expect(
        covered.has(endpoint) || deferred.has(endpoint),
        `missing coverage for ${endpoint}`
      ).toBe(true);
    }
  });

  it("contains no secrets, credentials, endpoints, or evidence payloads", () => {
    for (const fileName of FIXTURE_FILES) {
      const raw = fs.readFileSync(path.join(GOLDEN_DIR, fileName), "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(pattern.test(raw), `${fileName} matched forbidden pattern ${pattern}`).toBe(
          false
        );
      }
      expect(raw.toLowerCase()).not.toContain("http://");
      expect(raw.toLowerCase()).not.toContain("https://");
    }
  });

  it("preserves citizen-safe and officer auth invariants", () => {
    const citizen = loadFixture("citizen-status.json");
    const uniform401 = citizen.cases.filter((c) => c.id.includes("uniform-401"));
    expect(uniform401.length).toBeGreaterThanOrEqual(3);
    for (const testCase of uniform401) {
      expect(testCase.response.status).toBe(401);
      expect((testCase.response.body as { detail?: string })?.detail).toBe(
        "We could not verify that report and token."
      );
    }

    const intake = loadFixture("intake.json");
    const failure = intake.cases.find((c) => c.id === "intake-submission-failure");
    expect(failure?.response.status).toBe(502);
    expect((failure?.response.body as { detail?: string })?.detail).toBe(
      "Report submission failed"
    );

    const analyze = loadFixture("analyze.json");
    const gone = analyze.cases.find((c) => c.id === "analyze-removed-gone");
    expect(gone?.response.status).toBe(410);

    const officer = loadFixture("officer-reports.json");
    const authCase = officer.cases.find((c) => c.id === "officer-auth-required-recent");
    expect(authCase?.response.status).toBe(401);
  });

  it("records rate-limit Retry-After contracts", () => {
    const intake = loadFixture("intake.json");
    const status = loadFixture("citizen-status.json");
    const intakeRate = intake.cases.find((c) => c.id === "intake-rate-limit");
    const statusRate = status.cases.find((c) => c.id === "citizen-status-rate-limit");
    expect(intakeRate?.response.headers).toMatchObject({ "retry-after": "integer" });
    expect(statusRate?.response.headers).toMatchObject({ "retry-after": "integer" });
  });
});
