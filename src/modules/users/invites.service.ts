import { env } from "../../config";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors";
import { emailService } from "../../shared/email.service";
import { addDays } from "../../utils";
import { invitesRepository } from "./invites.repository";
import type { InviteUserInput } from "./invites.schemas";
import { usersRepository } from "./users.repository";

const INVITE_TTL_DAYS = 2;

export const invitesService = {
  invite: async (data: InviteUserInput) => {
    const conflicts = await usersRepository.findConflicts({ email: data.email });

    if (conflicts.email) {
      throw new ConflictError("A user with that email already exists");
    }

    const existing = await invitesRepository.findUnusedByEmail(data.email);

    if (existing) {
      if (existing.expiresAt > new Date()) {
        throw new ConflictError(
          "A pending invite already exists for this email. Cancel it before sending a new one.",
        );
      }
      // Expired unused invite — auto-remove so a fresh one can be created
      await invitesRepository.delete(existing.id);
    }

    const expiresAt = addDays(new Date(), INVITE_TTL_DAYS);

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

  cancelInvite: async (id: string) => {
    const invite = await invitesRepository.findById(id);

    if (!invite) throw new NotFoundError("Invite not found");
    if (invite.usedAt) throw new BadRequestError("This invite has already been accepted");

    await invitesRepository.delete(id);
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
