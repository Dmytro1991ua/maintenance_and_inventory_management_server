const tsJestTransform = {
  "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
};

module.exports = {
  collectCoverageFrom: ["src/**/*.ts"],
  coveragePathIgnorePatterns: ["/node_modules/", "/generated/"],
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      clearMocks: true,
      transform: tsJestTransform,
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/unit/setup.ts"],
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      clearMocks: true,
      transform: tsJestTransform,
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
    },
    {
      displayName: "e2e",
      testEnvironment: "node",
      clearMocks: true,
      transform: tsJestTransform,
      testMatch: ["<rootDir>/tests/e2e/**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/e2e/setup.ts"],
    },
  ],
};
