import { Resend } from "resend";

export class PasswordResetEmailSendError extends Error {}

export async function sendPasswordResetOtpEmail(email: string, otp: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    throw new PasswordResetEmailSendError("RESEND_API_KEY is not set");
  }
  if (!from) {
    throw new PasswordResetEmailSendError("RESEND_FROM_EMAIL is not set");
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `${otp} is your EvidMed AI password reset code`,
    text: `Your EvidMed AI password reset code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
  });

  if (error) {
    throw new PasswordResetEmailSendError(`Failed to send password reset email: ${error.message}`);
  }
}
