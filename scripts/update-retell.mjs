#!/usr/bin/env node
// Applies the shared call failsafes (retell-settings.mjs) to the EXISTING
// Haal-Chaal agents and their LLM. Safe to run again.
//
// Usage: RETELL_API_KEY=... RETELL_AGENTS='{"hi":"agent_..."}' node scripts/update-retell.mjs

import { AGENT_FAILSAFES, LLM_SETTINGS } from "./retell-settings.mjs";

const KEY = process.env.RETELL_API_KEY;
const agents = JSON.parse(process.env.RETELL_AGENTS || "{}");
if (!KEY || !Object.keys(agents).length) {
  console.error("Set RETELL_API_KEY and RETELL_AGENTS first.");
  process.exit(1);
}

async function api(path, body, method) {
  const r = await fetch("https://api.retellai.com" + path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

const llms = new Set();
for (const [code, id] of Object.entries(agents)) {
  const a = await api(`/update-agent/${id}`, AGENT_FAILSAFES, "PATCH");
  llms.add(a.response_engine?.llm_id);
  console.log(`agent ${code}: updated`);
}
for (const id of llms) {
  if (!id) continue;
  await api(`/update-retell-llm/${id}`, LLM_SETTINGS, "PATCH");
  console.log(`llm ${id}: updated`);
}
