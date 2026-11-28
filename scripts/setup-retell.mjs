#!/usr/bin/env node
// One-time setup for real phone calls. Creates a Retell LLM + one agent per
// call language, all driven by per-call dynamic variables ({{instructions}},
// {{greeting}}) that the app fills in. Prints the RETELL_AGENTS value to add
// to .env.local and to Vercel.
//
// Usage: RETELL_API_KEY=... node scripts/setup-retell.mjs

import { AGENT_FAILSAFES, LLM_SETTINGS } from "./retell-settings.mjs";

const KEY = process.env.RETELL_API_KEY;
if (!KEY) {
  console.error("Set RETELL_API_KEY first.");
  process.exit(1);
}
const BASE = "https://api.retellai.com";

async function api(path, body, method) {
  const r = await fetch(BASE + path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

// Languages we want, and the Retell locale for each.
const LANGS = { hi: "hi-IN", en: "en-IN", bn: "bn-IN", mr: "mr-IN", ta: "ta-IN", te: "te-IN", gu: "gu-IN", kn: "kn-IN", ml: "ml-IN", pa: "pa-IN" };

const voices = await api("/list-voices");
const female = voices.filter((v) => v.gender === "female");
const indian = female.filter((v) => /india|hindi/i.test(`${v.accent ?? ""} ${v.voice_name ?? ""}`));
const pick = (indian.find((v) => v.provider === "elevenlabs") ?? indian[0] ?? female.find((v) => v.provider === "elevenlabs") ?? female[0]);
if (!pick) throw new Error("No female voice found in this Retell account.");
console.error(`Voice: ${pick.voice_name} (${pick.voice_id}, ${pick.provider}, accent: ${pick.accent ?? "n/a"})`);

const llm = await api("/create-retell-llm", {
  ...LLM_SETTINGS,
  default_dynamic_variables: { instructions: "You are Haal-Chaal, a warm check-in caller. Speak Hindi.", greeting: "नमस्ते, मैं हाल-चाल से बोल रही हूँ।" },
});
console.error(`LLM: ${llm.llm_id}`);

const agents = {};
for (const [code, locale] of Object.entries(LANGS)) {
  try {
    const a = await api("/create-agent", {
      agent_name: `Haal-Chaal (${code})`,
      response_engine: { type: "retell-llm", llm_id: llm.llm_id },
      voice_id: pick.voice_id,
      language: locale,
      voice_speed: 0.95,
      responsiveness: 0.8,
      enable_backchannel: true,
      ...AGENT_FAILSAFES,
    });
    agents[code] = a.agent_id;
    console.error(`Agent ${code} (${locale}): ${a.agent_id}`);
  } catch (e) {
    console.error(`Skipped ${code} (${locale}): ${e.message.slice(0, 160)}`);
  }
}

console.log(`RETELL_AGENTS=${JSON.stringify(agents)}`);
