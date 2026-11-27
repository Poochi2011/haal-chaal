// After the call: turn the transcript into structured facts for the family.

import { getClient, structured } from "@/lib/ai";
import { demoExtract } from "@/lib/demo";
import { detectEmergency } from "@/lib/safety";
import type { CallSummary, Parent, Turn } from "@/lib/types";
import { doseText } from "@/lib/types";

interface Body {
  parent: Parent;
  transcript: Turn[];
}

export async function POST(req: Request) {
  const { parent: family, transcript } = (await req.json()) as Body;
  const client = getClient();
  const fallback = () => ({ summary: demoExtract(family, transcript), mode: "demo" as const });
  if (!client) return Response.json(fallback());

  const medList = family.medicines.map((m) => `"${m.id}": ${m.name} (${doseText(m)})`).join(", ");
  const convo = transcript
    .map((t) => `${t.role === "ai" ? "HAAL-CHAAL" : family.callName.toUpperCase()}: ${t.text}`)
    .join("\n");

  const prompt = `Below is a check-in phone call with ${family.name} ("${family.callName}"), an elderly parent. It may be in Hindi, another Indian language or a mix. Extract facts for their children. Only record what the parent actually said; if an answer is missing, silent or ambiguous use "unclear". Never guess.

Medicines (id: name): ${medList || "none"}

CALL:
${convo}

Fill the respond tool with:
{
  "meds": { ${family.medicines.map((m) => `"${m.id}": "yes|no|unclear"`).join(", ")} }  (a medicine taken twice a day is "yes" only if both doses were taken; "no" if any dose was missed),
  "ate": "yes|partly|no|unclear",
  "slept": "yes|no|unclear",
  "mood": "good|okay|low|unclear",
  "complaints": ["short English phrases, e.g. knee pain, feeling lonely"],
  "emergency": true|false,
  "emergencyReason": "2-4 word label like Chest pain, or empty",
  "highlight": "one warm English line about something personal they shared, or empty",
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
          emergencyReason: { type: "string", description: "2-4 word English label, e.g. 'Chest pain', 'A fall'. Empty if no emergency." },
          highlight: { type: "string", description: "One warm English line about something personal they shared. Empty string if they shared nothing personal." },
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
      s.emergencyReason = rule;
    }
    if (s.emergencyReason && s.emergencyReason.split(/\s+/).length > 5) s.emergencyReason = "Serious symptom";
    if (/^\W*(unclear|none|n\/a)?\W*$/i.test(s.highlight ?? "")) s.highlight = "";
    for (const m of family.medicines) if (!s.meds?.[m.id]) (s.meds ??= {})[m.id] = "unclear";
    s.complaints ??= [];
    return Response.json({ summary: s, mode: "ai" });
  } catch (err) {
    console.error("[extract] AI failed, using rules:", err);
    return Response.json(fallback());
  }
}
