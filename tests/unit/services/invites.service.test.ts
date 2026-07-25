import { ConflictError } from "../../../src/errors";
import { Role } from "../../../src/generated/prisma/client";
import {
  buildInvite,
  invitesRepositoryMock,
  loggerMock,
  usersRepositoryMock,
} from "../../mocks";

jest.mock("../../../src/modules/users/invites.repository", () => ({
  invitesRepository: invitesRepositoryMock,
}));

jest.mock("../../../src/modules/users/users.repository", () => ({
  usersRepository: usersRepositoryMock,
}));

jest.mock("../../../src/shared/email.service", () => ({
  emailService: { sendInvite: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../../src/config", () => ({
  env: { APP_URL: "http://localhost:5173" },
  logger: loggerMock,
}));

import { emailService } from "../../../src/shared/email.service";
import { invitesService } from "../../../src/modules/users/invites.service";

const sendInviteMock = emailService.sendInvite as jest.MockedFunction<typeof emailService.sendInvite>;

describe("invitesService.invite", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should throw ConflictError when the email is already registered", async () => {
    usersRepositoryMock.findConflicts.mockResolvedValue({ email: true, userName: false });

    await expect(
      invitesService.invite({ email: "existing@example.com", role: "TECHNICIAN" }),
    ).rejects.toThrow(ConflictError);
  });

  it("should not create an invite or send an email when the email conflicts", async () => {
    usersRepositoryMock.findConflicts.mockResolvedValue({ email: true, userName: false });

    await expect(
      invitesService.invite({ email: "existing@example.com", role: "TECHNICIAN" }),
    ).rejects.toThrow();

    expect(invitesRepositoryMock.create).not.toHaveBeenCalled();
    expect(sendInviteMock).not.toHaveBeenCalled();
  });

  it("should create an invite with expiresAt ~48 hours from now", async () => {
    usersRepositoryMock.findConflicts.mockResolvedValue({ email: false, userName: false });
    const invite = buildInvite();
    invitesRepositoryMock.create.mockResolvedValue(invite);

    const before = new Date();
    await invitesService.invite({ email: "jane@example.com", role: "TECHNICIAN" });
    const after = new Date();

    const [{ expiresAt }] = invitesRepositoryMock.create.mock.calls[0];
    const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before.getTime() + 47 * 60 * 60 * 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after.getTime() + 49 * 60 * 60 * 1000);
    expect(hoursUntilExpiry).toBeCloseTo(48, 0);
  });

  it("should call emailService.sendInvite with the invite URL containing the token", async () => {
    usersRepositoryMock.findConflicts.mockResolvedValue({ email: false, userName: false });
    const invite = buildInvite({ token: "test-token-uuid" });
    invitesRepositoryMock.create.mockResolvedValue(invite);

    await invitesService.invite({ email: "jane@example.com", role: "TECHNICIAN" });

    expect(sendInviteMock).toHaveBeenCalledWith(
      "jane@example.com",
      "http://localhost:5173/auth/accept-invite?token=test-token-uuid",
      "TECHNICIAN",
    );
  });

  it("should return invite data without the token", async () => {
    usersRepositoryMock.findConflicts.mockResolvedValue({ email: false, userName: false });
    const invite = buildInvite({ id: "inv-1", email: "jane@example.com", role: "MANAGER" });
    invitesRepositoryMock.create.mockResolvedValue(invite);

    const result = await invitesService.invite({ email: "jane@example.com", role: "MANAGER" });

    expect(result).toEqual({
      id: "inv-1",
      email: "jane@example.com",
      role: "MANAGER",
      expiresAt: invite.expiresAt,
    });
    expect(result).not.toHaveProperty("token");
  });
});

describe("invitesService.getPendingInvites", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return an empty array when there are no pending invites", async () => {
    invitesRepositoryMock.findPending.mockResolvedValue([]);

    const result = await invitesService.getPendingInvites();

    expect(result).toEqual([]);
  });

  it("should add isExpired: false for an invite that has not yet expired", async () => {
    const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const invite = buildInvite({ expiresAt: futureExpiry });
    invitesRepositoryMock.findPending.mockResolvedValue([
      { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt, createdAt: invite.createdAt },
    ]);

    const result = await invitesService.getPendingInvites();

    expect(result[0].isExpired).toBe(false);
  });

  it("should add isExpired: true for an invite whose expiresAt is in the past", async () => {
    const pastExpiry = new Date(Date.now() - 1000);
    const invite = buildInvite({ expiresAt: pastExpiry });
    invitesRepositoryMock.findPending.mockResolvedValue([
      { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt, createdAt: invite.createdAt },
    ]);

    const result = await invitesService.getPendingInvites();

    expect(result[0].isExpired).toBe(true);
  });

  it("should preserve all fields from the repository row", async () => {
    const invite = buildInvite({ id: "inv-99", email: "test@example.com", role: Role.MANAGER });
    invitesRepositoryMock.findPending.mockResolvedValue([
      { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt, createdAt: invite.createdAt },
    ]);

    const result = await invitesService.getPendingInvites();

    expect(result[0]).toMatchObject({
      id: "inv-99",
      email: "test@example.com",
      role: "MANAGER",
    });
  });
});
