import { Resend } from "resend";

export class RejectionEmailSendError extends Error {}

export async function sendRejectionEmail(
  email: string,
  name: string,
  reason: string | null,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    throw new RejectionEmailSendError("RESEND_API_KEY is not set");
  }
  if (!from) {
    throw new RejectionEmailSendError("RESEND_FROM_EMAIL is not set");
  }

  const resend = new Resend(apiKey);

  const reasonLine = reason
    ? `Reason: ${reason}`
    : "Please contact us if you'd like more details.";

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Update on your EvidMed AI application",
    text: `Hi ${name},\n\nAfter reviewing your registration and certificate, we're unable to approve your EvidMed AI application at this time.\n\n${reasonLine}\n\nIf you believe this is a mistake or your details have changed, you're welcome to reach out or reapply.`,
  });

  if (error) {
    throw new RejectionEmailSendError(`Failed to send rejection email: ${error.message}`);
  }
}
