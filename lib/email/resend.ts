import { Resend } from "resend";

/**
 * Resend client for transactional email (magic links, invites). Lazily created
 * so the module can be imported without `RESEND_API_KEY` set at build time.
 *
 * Foundation stub — see `lib/email/templates/invite.tsx` for the one placeholder
 * template. TODO: wire to the Supabase magic-link + invite flows.
 */
let _resend: Resend | undefined;

export function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Counder <hello@counder.com>";
