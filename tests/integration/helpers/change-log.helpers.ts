import { prisma } from "../../../src/config";
import type { ChangeLogEntity } from "../../../src/generated/prisma/client";
import { authHeader, signTestAccessToken } from "./auth.helpers";

export const asUser = (user: Parameters<typeof signTestAccessToken>[0]) =>
  authHeader(signTestAccessToken(user));

export const onlyEntry = async (entityType: ChangeLogEntity) => {
  const entries = await prisma.changeLog.findMany({ where: { entityType } });

  expect(entries).toHaveLength(1);

  return entries[0];
};

export const statusChange = (oldValue: string, newValue: string) => [
  { field: "status", oldValue, newValue },
];
