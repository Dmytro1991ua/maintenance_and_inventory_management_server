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

// An hourly labor rate: up to 5 integer digits and 2 decimals, to fit DECIMAL(10,2) with room to spare.
export const HourlyRateInput = z.coerce.string().regex(/^\d{1,5}(\.\d{1,2})?$/, {
  error: "Must be a non-negative rate with at most 2 decimal places",
});
