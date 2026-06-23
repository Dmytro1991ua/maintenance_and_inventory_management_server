import { randomUUID } from "node:crypto";

// uuid@14 dropped its CJS build (pure ESM now), which ts-jest's CommonJS
// transform can't parse. v4() is functionally identical to Node's built-in
// randomUUID() — swapped in here via moduleNameMapper for any test project
// that loads real (non-mocked) production code importing "uuid".
export const v4 = randomUUID;
