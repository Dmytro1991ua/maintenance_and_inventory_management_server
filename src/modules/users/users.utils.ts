import { Role, TaskStatus } from "../../generated/prisma/client";

type ActiveTask = { status: TaskStatus };

export type UserRaw = {
  id: string;
  userName: string;
  email: string;
  roles: Role[];
  status: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  tasks: ActiveTask[];
};

export type TechnicianAvailability = "AVAILABLE" | "RESERVED" | "BUSY";

const computeAvailability = (
  roles: Role[],
  activeTasks: ActiveTask[],
): TechnicianAvailability | null => {
  if (!roles.includes(Role.TECHNICIAN)) return null;

  if (activeTasks.length === 0) return "AVAILABLE";

  return activeTasks[0].status === TaskStatus.IN_PROGRESS ? "BUSY" : "RESERVED";
};

export const mapUserToResponse = (user: UserRaw) => {
  const { tasks, ...rest } = user;

  return { ...rest, availability: computeAvailability(rest.roles, tasks) };
};
