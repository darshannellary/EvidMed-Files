import { Resend } from "resend";

export class OtpEmailSendError extends Error {}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    throw new OtpEmailSendError("RESEND_API_KEY is not set");
  }
  if (!from) {
    throw new OtpEmailSendError("RESEND_FROM_EMAIL is not set");
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `${otp} is your EvidMed AI verification code`,
    text: `Your EvidMed AI verification code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
  });

  if (error) {
    throw new OtpEmailSendError(`Failed to send OTP email: ${error.message}`);
  }
}
