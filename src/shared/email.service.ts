import { Resend } from "resend";

import { env } from "../config";
import type { Role } from "../generated/prisma/client";

const getResend = (): Resend => {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(env.RESEND_API_KEY);
};

const roleLabel: Record<string, string> = {
  MANAGER: "Manager",
  TECHNICIAN: "Technician",
};

export const emailService = {
  sendInvite: async (to: string, inviteUrl: string, role: Role): Promise<void> => {
    const resend = getResend();

    await resend.emails.send({
      from: "Mainstay <onboarding@resend.dev>",
      to,
      subject: "You've been invited to Mainstay",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2>You've been invited to Mainstay</h2>
          <p>
            An administrator has invited you to join Mainstay as a
            <strong>${roleLabel[role] ?? role}</strong>.
          </p>
          <p>
            <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
              Accept Invite
            </a>
          </p>
          <p style="color:#6b7280;font-size:14px">
            This link expires in 48 hours. If you didn't expect this invitation,
            you can safely ignore this email.
          </p>
        </div>
      `,
    });
  },
};
