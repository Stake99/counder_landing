import { NextResponse } from "next/server";

/**
 * Chatbot route handler — placeholder. The network concierge will stream
 * responses from the latest Claude model (e.g. `claude-opus-4-8`) via the
 * Anthropic SDK, grounded in the member's network context.
 *
 * TODO: implement streaming + auth (Supabase session) + rate limiting.
 */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Not implemented", todo: "wire Anthropic streaming" },
    { status: 501 },
  );
}
