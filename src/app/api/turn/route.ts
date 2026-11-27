// One step of the check-in call: given the family profile, recent memory and
// the call so far, returns what Haal-Chaal says next.

import { getClient, structured } from "@/lib/ai";
import { demoTurn } from "@/lib/demo";
import { getLanguage } from "@/lib/languages";
import { detectEmergency } from "@/lib/safety";
import type { Family, Turn, TurnReply } from "@/lib/types";

interface Body {
  family: Family;
  transcript: Turn[];
  memory: string;           // short notes from recent calls
  lastComplaint: string | null;
}

function systemPrompt(f: Family, memory: string, emergency: string | null): string {
  const lang = getLanguage(f.language);
  const meds = f.medicines.map((m) => `- ${m.name} (${m.time})`).join("\n");
  return `You are Haal-Chaal, a warm daily check-in caller for an elderly parent in India who lives alone. You speak like a respectful, patient grandchild. You are on a VOICE call: everything you say is read aloud by a text-to-speech voice.

PARENT: ${f.parentName}, address them as "${f.callName}". City: ${f.city}.
LANGUAGE: Speak ${lang.name}${f.language === "hi" ? " (simple everyday Hindi, Hinglish words like 'tablet' are fine)" : ""}, written in ${f.language === "en" ? "English" : f.language === "hi" ? "Devanagari script" : "its native script"}. The parent may mix languages; understand them, but always reply in ${lang.name}. Use the respectful form (aap / equivalent). You are a young woman: use feminine first-person forms (Hindi: "main bol rahi hoon", never "raha hoon"). Every line, including emergencies, must be in that script, because a ${lang.name} voice reads it aloud.
MEDICINES:
${meds || "- none listed"}
HEALTH NOTES: ${f.healthNotes || "none"}
FAMILY MESSAGE TO DELIVER (once, near the end): ${f.message.trim() || "none"}
FROM RECENT CALLS (use this to follow up naturally, e.g. ask how yesterday's problem is now):
${memory || "This is the first call."}

CALL PLAN, one short question at a time, in this order:
1. Greet by name, ask how the day was.
2. Ask about each medicine by its name.
3. Ask if they ate properly, then if they slept well.
4. If recent calls mention a problem, ask how it is today.
5. Ask "anything else you want to tell me?" and respond kindly to what they share.
6. Deliver the family message if there is one, then say a warm goodbye and end.

RULES:
- Max 2 short sentences per turn, slow and simple. No lists, no emojis, no markdown.
- If the parent's input is "[silence]", gently ask if they can hear you. After two silences in a row, say goodbye and end.
- If input starts with "[unclear]", say sorry and ask again more simply, as a yes/no question. Never guess an answer.
- If they go off topic, respond warmly in one line, then return to the next question.
- Never give medical advice or change doses. You only listen and tell the family.
- EMERGENCY (chest pain, breathing trouble, a fall, fainting, confusion): stop the routine, say you are informing their children right now and ask them to call a neighbour, set emergency true and end true.
${emergency ? `\nTHE PARENT JUST MENTIONED: ${emergency}. Follow the EMERGENCY rule now.` : ""}
Answer with the respond tool.`;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const { family, transcript, memory, lastComplaint } = body;
  const client = getClient();

  const lastParent = [...transcript].reverse().find((t) => t.role === "parent");
  const ruleEmergency = lastParent ? detectEmergency(lastParent.text) : null;

  if (!client) {
    const r = demoTurn(family, transcript, lastComplaint);
    return Response.json({ ...r, mode: "demo" } satisfies TurnReply);
  }

  // Anthropic needs the conversation to start with a user turn.
  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: "[call connected]" },
  ];
  for (const t of transcript) {
    const role = t.role === "ai" ? "assistant" : "user";
    const prev = messages[messages.length - 1];
    if (prev.role === role) prev.content += "\n" + t.text;
    else messages.push({ role, content: t.text });
  }
  if (messages[messages.length - 1].role === "assistant") {
    messages.push({ role: "user", content: "[silence]" });
  }
  // Parents often answer in romanised Hinglish; without this nudge the model
  // mirrors that script, which the Indian-language voices read badly.
  const lang = getLanguage(family.language);
  if (family.language !== "en") {
    messages[messages.length - 1].content += `\n\n(Reply in ${lang.name}, written in ${lang.native} script.)`;
  }

  try {
    const parsed = await structured<{ say: string; end: boolean; emergency: boolean }>(client, {
      system: systemPrompt(family, memory, ruleEmergency),
      messages,
      maxTokens: 400,
      schema: {
        type: "object",
        properties: {
          say: { type: "string", description: "What Haal-Chaal says next, in the parent's language and script" },
          end: { type: "boolean", description: "true if the call should end after this line" },
          emergency: { type: "boolean" },
        },
        required: ["say", "end", "emergency"],
      },
    });
    if (!parsed?.say) throw new Error("bad reply");
    return Response.json({
      say: parsed.say,
      end: Boolean(parsed.end) || Boolean(ruleEmergency),
      emergency: Boolean(parsed.emergency) || Boolean(ruleEmergency),
      mode: "ai",
    } satisfies TurnReply);
  } catch (err) {
    console.error("[turn] AI failed, using demo script:", err);
    const r = demoTurn(family, transcript, lastComplaint);
    return Response.json({ ...r, mode: "demo" } satisfies TurnReply);
  }
}
