// Places a real phone call to the PARENT's number (never the family member
// using the app) through Retell, with this parent's instructions and memory.

import { getClient, structured } from "@/lib/ai";
import { buildInstructions, defaultGreeting, fixHindiPronunciation, scriptName } from "@/lib/prompt";
import { retell, retellConfig, toE164 } from "@/lib/retell";
import { checkCallLimit, limitResponse } from "@/lib/ratelimit";
import type { Parent } from "@/lib/types";

interface Body {
  parent: Parent;
  memory: string;
  pin?: string;
}

async function greetingFor(p: Parent): Promise<string> {
  const custom = p.greeting.trim();
  const base = custom || defaultGreeting(p);
  const client = getClient();
  if (base && (p.language === "en" || !/[A-Za-z]{3,}/.test(base) || !client)) {
    return p.language === "hi" ? fixHindiPronunciation(base) : base;
  }
  if (!client) return base ?? `Namaste ${p.callName}`;
  const ask = base
    ? `Rewrite this greeting in ${scriptName(p.language)}, same words and meaning: "${base}"`
    : `Write a warm one-sentence phone greeting in ${scriptName(p.language)} from "Haal-Chaal", a caring caller, to an elderly parent called "${p.callName}", asking how their day was. Female speaker, respectful form.`;
  const r = await structured<{ text: string }>(client, {
    messages: [{ role: "user", content: ask }],
    maxTokens: 200,
    schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  });
  return r.text;
}

export async function POST(req: Request) {
  const cfg = retellConfig();
  if (!cfg) return Response.json({ error: "Real phone calls are not set up on this server." }, { status: 503 });
  const { parent, memory, pin } = (await req.json()) as Body;
  // On the public demo, real (paid) calls need a PIN so strangers can't run up the bill.
  const requiredPin = process.env.PHONE_DEMO_PIN?.trim();
  if (requiredPin && pin?.trim() !== requiredPin) {
    return Response.json({ error: "Enter the demo PIN to place a real phone call." }, { status: 403 });
  }

  const to = toE164(parent.phone || "");
  if (!to) return Response.json({ error: `Add ${parent.callName}'s phone number in Family settings first.` }, { status: 400 });
  const limit = await checkCallLimit(req, cfg, to);
  if (!limit.ok) return limitResponse(limit);
  const agent = cfg.agents[parent.language] ?? cfg.agents.hi ?? Object.values(cfg.agents)[0];

  try {
    const call = await retell<{ call_id: string }>(cfg, "/v2/create-phone-call", {
      body: {
        from_number: cfg.from,
        to_number: to,
        override_agent_id: agent,
        retell_llm_dynamic_variables: {
          instructions: buildInstructions(parent, memory),
          greeting: await greetingFor(parent),
        },
        metadata: { parentId: String(parent.id).slice(0, 40), app: "haal-chaal", client: limit.client },
      },
    });
    return Response.json({ callId: call.call_id, to: to.slice(0, -4).replace(/\d/g, "•") + to.slice(-4) });
  } catch (err) {
    console.error("[phone/start]", err);
    return Response.json({ error: "The phone call could not be placed. Check the number and the Retell setup." }, { status: 502 });
  }
}
