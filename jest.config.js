const tsJestTransform = {
  "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
};

module.exports = {
  clearMocks: true,
  coveragePathIgnorePatterns: ["/node_modules/", "/generated/"],
  // No test files exist yet — this is the harness only. Remove once real
  // tests land so an empty test run starts failing again as expected.
  passWithNoTests: true,
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      transform: tsJestTransform,
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/unit/setup.ts"],
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      transform: tsJestTransform,
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
    },
    {
      displayName: "e2e",
      testEnvironment: "node",
      transform: tsJestTransform,
      testMatch: ["<rootDir>/tests/e2e/**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/e2e/setup.ts"],
    },
  ],
};
