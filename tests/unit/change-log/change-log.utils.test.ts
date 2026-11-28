import { ChangeLogAction, Prisma } from "../../../src/generated/prisma/client";
import { buildChanges } from "../../../src/modules/change-log/change-log.utils";

const { CREATE, UPDATE, DELETE } = ChangeLogAction;

describe("buildChanges", () => {
  describe("CREATE", () => {
    it("should record every filled-in audited field with no old value", () => {
      const changes = buildChanges("ASSET", CREATE, null, {
        name: "Forklift 3",
        status: "OPERATIONAL",
        location: "Dock A",
      });

      expect(changes).toEqual([
        { field: "name", oldValue: null, newValue: "Forklift 3" },
        { field: "location", oldValue: null, newValue: "Dock A" },
        { field: "status", oldValue: null, newValue: "OPERATIONAL" },
      ]);
    });

    it("should skip optional fields left empty", () => {
      const changes = buildChanges("ASSET", CREATE, null, {
        name: "Forklift 3",
        manufacturer: null,
        model: undefined,
      });

      expect(changes.map((c) => c.field)).toEqual(["name"]);
    });
  });

  describe("UPDATE", () => {
    it("should record only the fields that changed", () => {
      const before = { name: "Forklift 3", location: "Dock A", status: "OPERATIONAL" };
      const after = { name: "Forklift 3", location: "Dock B", status: "DOWN" };

      expect(buildChanges("ASSET", UPDATE, before, after)).toEqual([
        { field: "location", oldValue: "Dock A", newValue: "Dock B" },
        { field: "status", oldValue: "OPERATIONAL", newValue: "DOWN" },
      ]);
    });

    it("should ignore fields the save did not touch", () => {
      const before = { name: "Forklift 3", location: "Dock A" };

      expect(buildChanges("ASSET", UPDATE, before, { location: "Dock B" })).toEqual([
        { field: "location", oldValue: "Dock A", newValue: "Dock B" },
      ]);
    });

    it("should record nothing when the saved values equal the old ones", () => {
      const row = { name: "Forklift 3", status: "DOWN" };

      expect(buildChanges("ASSET", UPDATE, row, { ...row })).toEqual([]);
    });

    it("should record a value being cleared", () => {
      expect(
        buildChanges("ASSET", UPDATE, { manufacturer: "Acme" }, { manufacturer: null }),
      ).toEqual([{ field: "manufacturer", oldValue: "Acme", newValue: null }]);
    });
  });

  describe("DELETE", () => {
    it("should record the old values with no new value", () => {
      const changes = buildChanges("ASSET", DELETE, { name: "Forklift 3", model: null }, null);

      expect(changes).toEqual([{ field: "name", oldValue: "Forklift 3", newValue: null }]);
    });
  });

  describe("allow-list", () => {
    it("should never record credentials or fields outside the allow-list", () => {
      const row = {
        userName: "anna",
        password: "$2b$10$hash",
        notificationPreferences: { email: true },
        avatarUrl: "x.png",
      };

      const changes = buildChanges("USER", CREATE, null, row);

      expect(changes.map((c) => c.field)).toEqual(["userName"]);
      expect(JSON.stringify(changes)).not.toContain("hash");
    });

    it("should not record internal bookkeeping fields", () => {
      const changes = buildChanges(
        "TASK",
        UPDATE,
        { reminderSentAt: null },
        { reminderSentAt: new Date() },
      );

      expect(changes).toEqual([]);
    });
  });

  describe("value comparison", () => {
    it("should treat a money string and the stored decimal as the same amount", () => {
      const before = { unitCost: new Prisma.Decimal("10.50") };

      expect(buildChanges("INVENTORY_ITEM", UPDATE, before, { unitCost: "10.5" })).toEqual([]);
      expect(buildChanges("INVENTORY_ITEM", UPDATE, before, { unitCost: "10.50" })).toEqual([]);
    });

    it("should record a money change as exact two-decimal amounts", () => {
      const before = { unitCost: new Prisma.Decimal("10.5") };

      expect(buildChanges("INVENTORY_ITEM", UPDATE, before, { unitCost: "12" })).toEqual([
        { field: "unitCost", oldValue: "10.50", newValue: "12.00" },
      ]);
    });

    it("should treat equal dates as unchanged and record different dates as ISO strings", () => {
      const before = { dueDate: new Date("2026-06-01T00:00:00Z") };

      expect(
        buildChanges("TASK", UPDATE, before, { dueDate: new Date("2026-06-01T00:00:00Z") }),
      ).toEqual([]);
      expect(
        buildChanges("TASK", UPDATE, before, { dueDate: new Date("2026-06-02T00:00:00Z") }),
      ).toEqual([
        {
          field: "dueDate",
          oldValue: "2026-06-01T00:00:00.000Z",
          newValue: "2026-06-02T00:00:00.000Z",
        },
      ]);
    });

    it("should compare list values by content", () => {
      const before = { roles: ["TECHNICIAN"] };

      expect(buildChanges("USER", UPDATE, before, { roles: ["TECHNICIAN"] })).toEqual([]);
      expect(buildChanges("USER", UPDATE, before, { roles: ["TECHNICIAN", "MANAGER"] })).toEqual([
        { field: "roles", oldValue: ["TECHNICIAN"], newValue: ["TECHNICIAN", "MANAGER"] },
      ]);
    });

    it("should refuse a value it cannot store as JSON instead of logging garbage", () => {
      expect(() => buildChanges("TASK", UPDATE, { title: "a" }, { title: { set: "b" } })).toThrow(
        'Cannot record a object value for "title"',
      );
    });
  });
});
