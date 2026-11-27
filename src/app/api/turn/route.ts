// One step of the in-browser check-in call: given the parent profile, recent
// memory and the call so far, returns what Haal-Chaal says next.

import { getClient, structured } from "@/lib/ai";
import { demoTurn } from "@/lib/demo";
import { getLanguage } from "@/lib/languages";
import { buildInstructions, defaultGreeting, fixHindiPronunciation, scriptName } from "@/lib/prompt";
import { detectEmergency } from "@/lib/safety";
import type { Parent, Turn, TurnReply } from "@/lib/types";
import type Anthropic from "@anthropic-ai/sdk";

interface Body {
  parent: Parent;
  transcript: Turn[];
  memory: string;
  lastComplaint: string | null;
}

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    say: { type: "string", description: "What Haal-Chaal says next, in the parent's language and script" },
    end: { type: "boolean", description: "true if the call should end after this line" },
    emergency: { type: "boolean" },
  },
  required: ["say", "end", "emergency"],
};

/** Puts a family-written greeting into the parent's script so the voice pronounces it well. */
async function nativeGreeting(client: Anthropic | null, p: Parent): Promise<string> {
  const g = p.greeting.trim();
  const needsScript = p.language !== "en" && /[A-Za-z]{3,}/.test(g);
  if (!client || !needsScript) return p.language === "hi" ? fixHindiPronunciation(g) : g;
  try {
    const r = await structured<{ text: string }>(client, {
      messages: [{ role: "user", content: `Rewrite this greeting in ${scriptName(p.language)}, keeping the same words and meaning (transliterate, don't translate English words people say in ${getLanguage(p.language).name}). Greeting: "${g}"` }],
      maxTokens: 200,
      schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    });
    return r.text || g;
  } catch {
    return g;
  }
}

export async function POST(req: Request) {
  const { parent, transcript, memory, lastComplaint } = (await req.json()) as Body;
  const client = getClient();

  // Opening line: the family's own greeting, or our default.
  if (transcript.length === 0) {
    if (parent.greeting.trim()) {
      return Response.json({ say: await nativeGreeting(client, parent), end: false, emergency: false, mode: client ? "ai" : "demo" } satisfies TurnReply);
    }
    const d = defaultGreeting(parent);
    if (d || !client) {
      const say = d ?? demoTurn(parent, transcript, lastComplaint).say;
      return Response.json({ say, end: false, emergency: false, mode: client ? "ai" : "demo" } satisfies TurnReply);
    }
  }

  const lastParent = [...transcript].reverse().find((t) => t.role === "parent");
  const ruleEmergency = lastParent ? detectEmergency(lastParent.text) : null;

  if (!client) {
    const r = demoTurn(parent, transcript, lastComplaint);
    return Response.json({ ...r, mode: "demo" } satisfies TurnReply);
  }

  // Anthropic needs the conversation to start with a user turn.
  const messages: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: "[call connected]" }];
  for (const t of transcript) {
    const role = t.role === "ai" ? "assistant" : "user";
    const prev = messages[messages.length - 1];
    if (prev.role === role) prev.content += "\n" + t.text;
    else messages.push({ role, content: t.text });
  }
  if (messages[messages.length - 1].role === "assistant") messages.push({ role: "user", content: "[silence]" });
  // Parents often answer in romanised Hinglish; without this nudge the model
  // mirrors that script, which Indian-language voices read badly.
  if (parent.language !== "en") {
    messages[messages.length - 1].content += `\n\n(Reply in ${getLanguage(parent.language).name}, written in ${scriptName(parent.language)}.)`;
  }

  try {
    const r = await structured<{ say: string; end: boolean; emergency: boolean }>(client, {
      system: buildInstructions(parent, memory, ruleEmergency) + "\n\nAnswer with the respond tool.",
      messages,
      maxTokens: 400,
      schema: REPLY_SCHEMA,
    });
    if (!r?.say) throw new Error("empty reply");
    const say = parent.language === "hi" ? fixHindiPronunciation(r.say) : r.say;
    return Response.json({
      say,
      end: Boolean(r.end) || Boolean(ruleEmergency),
      emergency: Boolean(r.emergency) || Boolean(ruleEmergency),
      mode: "ai",
    } satisfies TurnReply);
  } catch (err) {
    console.error("[turn] AI failed, using demo script:", err);
    const r = demoTurn(parent, transcript, lastComplaint);
    return Response.json({ ...r, mode: "demo" } satisfies TurnReply);
  }
}
