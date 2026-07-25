import { env } from "../../config";
import { ConflictError } from "../../errors";
import { emailService } from "../../shared/email.service";
import { invitesRepository } from "./invites.repository";
import type { InviteUserInput } from "./invites.schemas";
import { usersRepository } from "./users.repository";

const INVITE_TTL_HOURS = 48;

export const invitesService = {
  invite: async (data: InviteUserInput) => {
    const conflicts = await usersRepository.findConflicts({ email: data.email });

    if (conflicts.email) {
      throw new ConflictError("A user with that email already exists");
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITE_TTL_HOURS);

    const invite = await invitesRepository.create({ ...data, expiresAt });
    const inviteUrl = `${env.APP_URL}/auth/accept-invite?token=${invite.token}`;

    await emailService.sendInvite(invite.email, inviteUrl, invite.role);

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    };
  },

  getPendingInvites: async () => {
    const invites = await invitesRepository.findPending();
    const now = new Date();

    return invites.map((invite) => ({
      ...invite,
      isExpired: invite.expiresAt < now,
    }));
  },
};
