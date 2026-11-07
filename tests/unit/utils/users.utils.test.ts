import { getInactiveUserIds } from "../../../src/modules/users/users.utils";

describe("getInactiveUserIds", () => {
  it("should return only the ids of inactive users", () => {
    const ids = getInactiveUserIds([
      { id: "a", status: "ACTIVE" },
      { id: "b", status: "INACTIVE" },
      { id: "c", status: "INACTIVE" },
    ]);

    expect([...ids].sort()).toEqual(["b", "c"]);
  });

  it("should return an empty set when everyone is active, or there are no users", () => {
    expect(getInactiveUserIds([{ id: "a", status: "ACTIVE" }]).size).toBe(0);
    expect(getInactiveUserIds([]).size).toBe(0);
  });
});
