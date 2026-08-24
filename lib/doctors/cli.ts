import { createAdminClient } from "@/lib/supabase/admin";
import {
  listPendingDoctors,
  approveDoctor,
  rejectDoctor,
  revokeDoctor,
  getDoctorCertificateSignedUrl,
} from "./review";

const SIGNED_URL_EXPIRES_SECONDS = 600; // 10 minutes

const USAGE =
  'Usage: npm run doctors:list | npm run doctors:approve -- --id=<uuid> | ' +
  'npm run doctors:reject -- --id=<uuid> [--reason="..."] | npm run doctors:cert-url -- --id=<uuid> | ' +
  'npm run doctors:revoke -- --id=<uuid> --reason="..."';

function parseFlags(argv: string[]) {
  const flags: Record<string, string> = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [key, ...rest] = arg.slice(2).split("=");
      flags[key] = rest.join("=");
    }
  }
  return flags;
}

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  // Validate subcommand/flags before touching credentials, so a bad-usage error is never masked
  // by "NEXT_PUBLIC_SUPABASE_URL is not set."
  if (subcommand === "approve" || subcommand === "reject" || subcommand === "cert-url") {
    requireId(flags);
  } else if (subcommand === "revoke") {
    requireId(flags);
    if (!flags.reason) {
      throw new Error('Missing --reason="..." — revoke requires an explicit reason.');
    }
  } else if (subcommand !== "list") {
    throw new Error(USAGE);
  }

  const admin = createAdminClient();

  switch (subcommand) {
    case "list": {
      const doctors = await listPendingDoctors(admin);
      if (doctors.length === 0) {
        console.log("No pending doctors.");
        return;
      }
      for (const d of doctors) {
        console.log(
          `${d.id}  ${d.name}  ${d.registration_council}/${d.registration_number}  ` +
            `contact: ${d.contact_phone ?? d.contact_email ?? "none"}  submitted: ${d.created_at}`,
        );
      }
      return;
    }

    case "approve": {
      requireId(flags);
      const result = await approveDoctor(admin, flags.id);
      console.log(`Approved doctor ${flags.id}.`);
      if (result.emailSent) {
        console.log("Approval email sent.");
      } else {
        console.warn(`Approval email NOT sent: ${result.emailError}`);
      }
      return;
    }

    case "reject": {
      requireId(flags);
      const result = await rejectDoctor(admin, flags.id, flags.reason);
      console.log(`Rejected doctor ${flags.id}${flags.reason ? ` (reason: ${flags.reason})` : ""}.`);
      if (result.emailSent) {
        console.log("Rejection email sent.");
      } else {
        console.warn(`Rejection email NOT sent: ${result.emailError}`);
      }
      return;
    }

    case "cert-url": {
      requireId(flags);
      const url = await getDoctorCertificateSignedUrl(admin, flags.id, SIGNED_URL_EXPIRES_SECONDS);
      console.log(`Signed URL (expires in ${SIGNED_URL_EXPIRES_SECONDS / 60} min):\n${url}`);
      return;
    }

    case "revoke": {
      requireId(flags);
      await revokeDoctor(admin, flags.id, flags.reason);
      console.log(`Revoked doctor ${flags.id} (reason: ${flags.reason}).`);
      return;
    }

    default:
      throw new Error(USAGE);
  }
}

function requireId(flags: Record<string, string>): asserts flags is Record<string, string> & { id: string } {
  if (!flags.id) {
    throw new Error("Missing --id=<uuid>.");
  }
}

main().catch((err) => {
  console.error(`[doctors] failed: ${(err as Error).message}`);
  process.exit(1);
});
