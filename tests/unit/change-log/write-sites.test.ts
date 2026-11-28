import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Every write to an audited model is listed: audited, or skipped with a reason.
// A new unlisted write fails the test, so none goes unrecorded by accident.
type Site = { audited: number; skipped: string[] };

const site = (audited: number, ...skipped: string[]): Site => ({ audited, skipped });

const WRITE_SITES: Record<string, Site> = {
  "modules/asset-downtimes/asset-downtimes.repository.ts::asset.updateMany": site(1),
  "modules/asset-downtimes/asset-downtimes.repository.ts::assetDowntime.create": site(2),
  "modules/asset-downtimes/asset-downtimes.repository.ts::assetDowntime.updateMany": site(2),
  "modules/asset-downtimes/asset-downtimes.repository.ts::assetDowntime.delete": site(1),

  "modules/assets/assets.repository.ts::asset.updateMany": site(0, "warranty reminder flag"),
  "modules/assets/assets.repository.ts::asset.create": site(1),
  "modules/assets/assets.repository.ts::asset.update": site(1),
  "modules/assets/assets.repository.ts::asset.delete": site(1),

  "modules/auth/auth.repository.ts::user.update": site(1),
  "modules/auth/auth.repository.ts::user.create": site(1),

  "modules/inventory/inventory.repository.ts::inventoryItem.create": site(1),
  "modules/inventory/inventory.repository.ts::inventoryItem.update": site(2),
  "modules/inventory/inventory.repository.ts::inventoryItem.delete": site(1),

  "modules/recurring-tasks/recurring-tasks.meter.ts::recurringTask.updateMany": site(
    0,
    "schedule advanced automatically after a meter reading",
  ),
  "modules/recurring-tasks/recurring-tasks.repository.ts::recurringTask.updateMany": site(
    0,
    "reminder flag",
  ),
  "modules/recurring-tasks/recurring-tasks.repository.ts::recurringTask.create": site(2),
  "modules/recurring-tasks/recurring-tasks.repository.ts::recurringTask.update": site(
    2,
    "next due date advanced when a schedule generates a task",
  ),
  "modules/recurring-tasks/recurring-tasks.repository.ts::recurringTask.delete": site(1),

  "modules/reorders/reorders.repository.ts::inventoryItem.update": site(
    0,
    "stock added on receipt, recorded on the reorder",
  ),

  "modules/task-time-entries/task-time-entries.repository.ts::taskTimeEntry.create": site(1),
  "modules/task-time-entries/task-time-entries.repository.ts::taskTimeEntry.delete": site(1),

  "modules/tasks/tasks.repository.ts::task.updateMany": site(0, "reminder flag"),
  "modules/tasks/tasks.repository.ts::task.updateManyAndReturn": site(1),
  "modules/tasks/tasks.repository.ts::task.create": site(1),
  "modules/tasks/tasks.repository.ts::task.update": site(
    1,
    "before-photo upload, photo URLs are not audited",
    "after-photo upload, photo URLs are not audited",
  ),
  "modules/tasks/tasks.repository.ts::task.delete": site(1),
  "modules/tasks/tasks.repository.ts::inventoryItem.update": site(
    0,
    "stock used by a completed task, recorded as part usage",
  ),

  "modules/users/users.repository.ts::user.update": site(8),
  "modules/users/users.repository.ts::user.delete": site(1),
  "modules/users/users.repository.ts::task.updateMany": site(2),
  "modules/users/users.repository.ts::recurringTask.updateMany": site(1),
};

const AUDITED_MODELS = "asset|assetDowntime|task|taskTimeEntry|recurringTask|user|inventoryItem";
const WRITE_CALL = new RegExp(
  `\\.(${AUDITED_MODELS})\\.(create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\\b`,
  "g",
);

const SRC = path.resolve(__dirname, "../../../src");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) return entry.name === "generated" ? [] : sourceFiles(full);

    return entry.name.endsWith(".ts") ? [full] : [];
  });

const countWrites = (): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const file of sourceFiles(SRC)) {
    const relative = path.relative(SRC, file).split(path.sep).join("/");

    for (const [, model, operation] of readFileSync(file, "utf8").matchAll(WRITE_CALL)) {
      const key = `${relative}::${model}.${operation}`;

      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return counts;
};

describe("change log write sites", () => {
  it("should classify every write to an audited model as audited or skipped with a reason", () => {
    const expected = Object.fromEntries(
      Object.entries(WRITE_SITES).map(([key, { audited, skipped }]) => [
        key,
        audited + skipped.length,
      ]),
    );

    // Mismatch: a write was added, removed or moved. Audit it or list it as skipped.
    expect(countWrites()).toEqual(expected);
  });

  it("should not write to the database with raw SQL, which would bypass the change log", () => {
    const rawWrites = sourceFiles(SRC).filter((file) =>
      /\$executeRaw(Unsafe)?\b/.test(readFileSync(file, "utf8")),
    );

    expect(rawWrites).toEqual([]);
  });

  it("should record through the caller's transaction, never the global client", () => {
    const outsideTransaction = sourceFiles(SRC).filter((file) =>
      /changeLogRepository\.record\(\s*prisma\b/.test(readFileSync(file, "utf8")),
    );

    expect(outsideTransaction).toEqual([]);
  });
});
