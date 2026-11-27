// Emergency escalation: rings the FAMILY MEMBER (not the parent) with a short
// spoken alert as soon as a serious symptom comes up on a parent's call.

import { retell, retellConfig, toE164 } from "@/lib/retell";

interface Body {
  childName: string;
  childPhone: string;
  parentName: string;   // how the child refers to them, e.g. "Mummy-ji"
  reason: string;       // e.g. "Chest pain"
  said?: string;        // what the parent actually said
  kind?: "symptom" | "missed";
  attempts?: number;
  pin?: string;
}

export async function POST(req: Request) {
  const cfg = retellConfig();
  if (!cfg) return Response.json({ error: "Phone calls are not set up on this server." }, { status: 503 });
  const b = (await req.json()) as Body;
  const requiredPin = process.env.PHONE_DEMO_PIN?.trim();
  if (requiredPin && b.pin?.trim() !== requiredPin) {
    return Response.json({ error: "Demo PIN needed for the emergency call." }, { status: 403 });
  }
  const to = toE164(b.childPhone || "");
  if (!to) return Response.json({ error: "Add your phone number in Family settings to get emergency calls." }, { status: 400 });

  const alert = b.kind === "missed"
    ? `This is an alert from Haal-Chaal. We called ${b.parentName} ${b.attempts ?? 4} times today, ten minutes apart, and nobody picked up. Please call ${b.parentName} yourself, or ask a neighbour to check on them.`
    : `This is an urgent alert from Haal-Chaal. During today's call, ${b.parentName} mentioned ${b.reason.toLowerCase()}${b.said ? `, saying: "${b.said.slice(0, 140)}"` : ""}. Please call ${b.parentName} right away, or ask a neighbour to check on them.`;
  const repeat = b.kind === "missed" ? `I'll repeat: ${b.parentName} has not answered today's calls. Please check on them.` : `I'll repeat: ${b.parentName} mentioned ${b.reason.toLowerCase()}. Please call them now.`;
  const instructions = `You are Haal-Chaal's emergency alert line, calling ${b.childName || "a family member"} about their parent ${b.parentName}. You have ALREADY said the alert in your first line. Now: if they ask questions, calmly repeat the key facts (what was said, the symptom) in one or two short sentences. Never give medical advice beyond "call them now or call emergency services (112)". Keep it under 30 seconds, then say goodbye and end the call. Speak English.`;

  try {
    const call = await retell<{ call_id: string }>(cfg, "/v2/create-phone-call", {
      body: {
        from_number: cfg.from,
        to_number: to,
        override_agent_id: cfg.agents.en ?? Object.values(cfg.agents)[0],
        retell_llm_dynamic_variables: { instructions, greeting: `${alert} ${repeat}` },
        metadata: { app: "haal-chaal", kind: "emergency-alert" },
      },
    });
    return Response.json({ callId: call.call_id });
  } catch (err) {
    console.error("[phone/alert]", err);
    return Response.json({ error: "The emergency call could not be placed." }, { status: 502 });
  }
}
