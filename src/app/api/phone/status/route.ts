// Polled by the call screen while a real phone call is in progress.

import { retell, retellConfig } from "@/lib/retell";
import type { Turn } from "@/lib/types";

interface RetellCall {
  call_status: "registered" | "not_connected" | "ongoing" | "ended" | "error";
  transcript_object?: { role: string; content: string }[];
  disconnection_reason?: string;
  start_timestamp?: number;
  end_timestamp?: number;
}

// Reasons that mean the call could not be placed at all (not the parent's fault).
const SETUP_FAIL: Record<string, string> = {
  telephony_provider_permission_denied: "The phone provider blocked this call. Calls to this country aren't switched on in the Twilio account (Voice → Geo permissions).",
  invalid_destination: "That phone number doesn't look reachable. Check it in Family settings.",
  no_valid_payment: "The calling account has no valid payment method.",
  credit_exhausted: "The calling account is out of credit.",
  concurrency_limit_reached: "Too many calls at once. Try again in a minute.",
  telephony_provider_unavailable: "The phone provider is unavailable right now. Try again shortly.",
  sip_routing_error: "The call couldn't be routed. Check the phone number setup in Retell.",
  network_blocked: "The phone network blocked this call.",
  marked_as_spam: "The caller number is flagged as spam.",
};

const NO_ANSWER = ["dial_no_answer", "dial_busy", "dial_failed", "user_declined", "voicemail_reached", "invalid_destination", "error_user_not_joined"];

export async function GET(req: Request) {
  const cfg = retellConfig();
  const id = new URL(req.url).searchParams.get("id");
  if (!cfg || !id) return Response.json({ error: "not available" }, { status: 400 });
  try {
    const c = await retell<RetellCall>(cfg, `/v2/get-call/${encodeURIComponent(id)}`);
    const transcript: Turn[] = (c.transcript_object ?? [])
      .filter((u) => u.role === "agent" || u.role === "user")
      .map((u) => ({ role: u.role === "agent" ? "ai" : "parent", text: u.content, at: 0 }));
    const done = c.call_status === "ended" || c.call_status === "error" || c.call_status === "not_connected";
    return Response.json({
      status: c.call_status,
      done,
      answered: done ? !NO_ANSWER.includes(c.disconnection_reason ?? "") && transcript.some((t) => t.role === "parent") : null,
      reason: c.disconnection_reason ?? null,
      failed: done && (c.call_status === "error" || (c.disconnection_reason ?? "") in SETUP_FAIL || (c.disconnection_reason ?? "").startsWith("error_")),
      failMessage: SETUP_FAIL[c.disconnection_reason ?? ""] ?? (c.call_status === "error" || (c.disconnection_reason ?? "").startsWith("error_") ? "The call failed on the calling service. Try again." : null),
      durationSec: c.start_timestamp && c.end_timestamp ? Math.round((c.end_timestamp - c.start_timestamp) / 1000) : 0,
      transcript,
    });
  } catch (err) {
    console.error("[phone/status]", err);
    return Response.json({ error: "status failed" }, { status: 502 });
  }
}
