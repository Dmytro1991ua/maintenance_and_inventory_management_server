import { z } from "zod";

// Shared money-input validator. Money is handled as a string end to end (stored
// as NUMERIC/Decimal, returned as a string) to stay exact. The regex enforces a
// non-negative amount with at most 2 decimal places and caps the integer part at
// 10 digits to fit DECIMAL(12,2); z.coerce.string() also accepts a JSON number
// (e.g. 8.5) from clients. One source so the two modules that take money
// (inventory unitCost, reorder receivedUnitCost) can't drift apart.
export const MoneyInput = z.coerce.string().regex(/^\d{1,10}(\.\d{1,2})?$/, {
  error: "Must be a non-negative amount with at most 2 decimal places",
});
