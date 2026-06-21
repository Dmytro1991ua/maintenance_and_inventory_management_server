import { ForbiddenError, NotFoundError } from "../../../src/errors";
import { ensureOwner, findOrThrow } from "../../../src/utils";

describe("findOrThrow", () => {
  it("should return the entity when find() resolves to a value", async () => {
    const entity = { id: "1", name: "test" };

    const result = await findOrThrow(() => Promise.resolve(entity), "Not found");

    expect(result).toEqual(entity);
  });

  it("should throw NotFoundError with the given message when find() resolves to null", async () => {
    await expect(
      findOrThrow(() => Promise.resolve(null), "Custom not found message"),
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw NotFoundError when find() resolves to undefined", async () => {
    await expect(findOrThrow(() => Promise.resolve(undefined), "Not found")).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("ensureOwner", () => {
  it("should not throw when resourceOwnerId matches requestingUserId", () => {
    expect(() => ensureOwner("user-1", "user-1", "message")).not.toThrow();
  });

  it("should throw ForbiddenError with the given message when IDs do not match", () => {
    expect(() => ensureOwner("user-1", "user-2", "Custom forbidden message")).toThrow(
      ForbiddenError,
    );
  });
});
