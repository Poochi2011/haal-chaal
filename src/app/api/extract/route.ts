// After the call: turn the transcript into structured facts for the family.

import { getClient, structured } from "@/lib/ai";
import { demoExtract } from "@/lib/demo";
import { detectEmergency } from "@/lib/safety";
import type { CallSummary, Family, Turn } from "@/lib/types";

interface Body {
  family: Family;
  transcript: Turn[];
}

export async function POST(req: Request) {
  const { family, transcript } = (await req.json()) as Body;
  const client = getClient();
  const fallback = () => ({ summary: demoExtract(family, transcript), mode: "demo" as const });
  if (!client) return Response.json(fallback());

  const medList = family.medicines.map((m) => `"${m.id}": ${m.name} (${m.time})`).join(", ");
  const convo = transcript
    .map((t) => `${t.role === "ai" ? "HAAL-CHAAL" : family.callName.toUpperCase()}: ${t.text}`)
    .join("\n");

  const prompt = `Below is a check-in phone call with ${family.parentName} ("${family.callName}"), an elderly parent. It may be in Hindi, another Indian language or a mix. Extract facts for their children. Only record what the parent actually said; if an answer is missing, silent or ambiguous use "unclear". Never guess.

Medicines (id: name): ${medList || "none"}

CALL:
${convo}

Fill the respond tool with:
{
  "meds": { ${family.medicines.map((m) => `"${m.id}": "yes|no|unclear"`).join(", ")} },
  "ate": "yes|partly|no|unclear",
  "slept": "yes|no|unclear",
  "mood": "good|okay|low|unclear",
  "complaints": ["short English phrases, e.g. knee pain, feeling lonely"],
  "emergency": true|false,
  "emergencyReason": "short reason or empty",
  "highlight": "one warm English line about something personal they shared",
  "summary": "2-3 short plain English sentences for the children: medicines, food, mood, anything new"
}`;

  try {
    const tri = { type: "string", enum: ["yes", "no", "unclear"] };
    const s = await structured<CallSummary>(client, {
      messages: [{ role: "user", content: prompt }],
      maxTokens: 800,
      schema: {
        type: "object",
        properties: {
          meds: { type: "object", properties: Object.fromEntries(family.medicines.map((m) => [m.id, tri])), required: family.medicines.map((m) => m.id) },
          ate: { type: "string", enum: ["yes", "partly", "no", "unclear"] },
          slept: tri,
          mood: { type: "string", enum: ["good", "okay", "low", "unclear"] },
          complaints: { type: "array", items: { type: "string" } },
          emergency: { type: "boolean" },
          emergencyReason: { type: "string" },
          highlight: { type: "string" },
          summary: { type: "string" },
        },
        required: ["meds", "ate", "slept", "mood", "complaints", "emergency", "highlight", "summary"],
      },
    });
    if (!s || !s.summary) throw new Error("bad extract");
    // Safety net: the rule-based check can only add an emergency, never remove one.
    const rule = detectEmergency(transcript.filter((t) => t.role === "parent").map((t) => t.text).join(" "));
    if (rule) {
      s.emergency = true;
      s.emergencyReason = s.emergencyReason || rule;
    }
    for (const m of family.medicines) if (!s.meds?.[m.id]) (s.meds ??= {})[m.id] = "unclear";
    s.complaints ??= [];
    return Response.json({ summary: s, mode: "ai" });
  } catch (err) {
    console.error("[extract] AI failed, using rules:", err);
    return Response.json(fallback());
  }
}
