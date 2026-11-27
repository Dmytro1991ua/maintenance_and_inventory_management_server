import { AsyncLocalStorage } from "node:async_hooks";

export type CurrentUser = { id: string; userName: string };

const storage = new AsyncLocalStorage<CurrentUser>();

export const runAsUser = <T>(user: CurrentUser, fn: () => T): T => storage.run(user, fn);

export const currentUser = (): CurrentUser | undefined => storage.getStore();
