const tsJestTransform = {
  "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
};

// uuid@14 ships pure ESM with no CJS build — ts-jest's CommonJS transform
// can't parse it. Unit tests sidestep this with per-file jest.mock("uuid"),
// but integration/e2e load real (unmocked) production code that imports it.
const moduleNameMapper = {
  "^uuid$": "<rootDir>/tests/mocks/uuid.stub.ts",
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
      moduleNameMapper,
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
    },
    {
      displayName: "e2e",
      testEnvironment: "node",
      clearMocks: true,
      transform: tsJestTransform,
      moduleNameMapper,
      testMatch: ["<rootDir>/tests/e2e/**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/e2e/setup.ts"],
    },
  ],
};
