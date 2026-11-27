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
      durationSec: c.start_timestamp && c.end_timestamp ? Math.round((c.end_timestamp - c.start_timestamp) / 1000) : 0,
      transcript,
    });
  } catch (err) {
    console.error("[phone/status]", err);
    return Response.json({ error: "status failed" }, { status: 502 });
  }
}
