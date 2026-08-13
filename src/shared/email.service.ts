import { Resend } from "resend";

import { env } from "../config";
import type { Role } from "../generated/prisma/client";

type TaskAssignmentDetails = {
  id: string;
  title: string;
  dueDate: Date | null;
};

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
  sendPasswordReset: async (to: string, resetUrl: string): Promise<void> => {
    const resend = getResend();

    await resend.emails.send({
      from: "Mainstay <onboarding@resend.dev>",
      to,
      subject: "Reset your Mainstay password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2>Reset your password</h2>
          <p>
            We received a request to reset the password for your Mainstay account.
            Click the button below to choose a new password.
          </p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
              Reset Password
            </a>
          </p>
          <p style="color:#6b7280;font-size:14px">
            This link expires in 1 hour. If you didn't request a password reset,
            you can safely ignore this email — your password won't change.
          </p>
        </div>
      `,
    });
  },

  sendTaskAssignment: async (to: string, task: TaskAssignmentDetails): Promise<void> => {
    const resend = getResend();
    const taskUrl = `${env.APP_URL}/tasks/${task.id}`;
    const dueDateLine = task.dueDate
      ? `<p><strong>Due:</strong> ${task.dueDate.toLocaleDateString("en-US", { dateStyle: "long" })}</p>`
      : "";

    await resend.emails.send({
      from: "Mainstay <onboarding@resend.dev>",
      to,
      subject: `You've been assigned: ${task.title}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2>New task assigned to you</h2>
          <p>You've been assigned a task in Mainstay.</p>
          <p><strong>${task.title}</strong></p>
          ${dueDateLine}
          <p>
            <a href="${taskUrl}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
              View Task
            </a>
          </p>
        </div>
      `,
    });
  },

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
