import { Resend } from "resend";

export class ApprovalEmailSendError extends Error {}

export async function sendApprovalEmail(email: string, name: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    throw new ApprovalEmailSendError("RESEND_API_KEY is not set");
  }
  if (!from) {
    throw new ApprovalEmailSendError("RESEND_FROM_EMAIL is not set");
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Your EvidMed AI application has been approved",
    text: `Hi ${name},\n\nYour registration and certificate have been reviewed and approved. You can now log in and start using EvidMed AI:\n\nhttps://evidmedai.com/login\n\nWelcome aboard.`,
  });

  if (error) {
    throw new ApprovalEmailSendError(`Failed to send approval email: ${error.message}`);
  }
}
