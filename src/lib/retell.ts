// Real phone calls through Retell AI (telephony + Indian-language speech +
// natural neural voices). Our app supplies the instructions and memory per
// call as dynamic variables, then reads the transcript back when it ends.
//
// Env:
//   RETELL_API_KEY      Retell API key
//   RETELL_FROM_NUMBER  a number in the Retell account (E.164) to call from
//   RETELL_AGENTS       JSON map language -> agent id, written by scripts/setup-retell.mjs
//                       e.g. {"hi":"agent_123","en":"agent_456"}

const BASE = "https://api.retellai.com";

export interface RetellConfig {
  key: string;
  from: string;
  agents: Record<string, string>;
}

export function retellConfig(): RetellConfig | null {
  const key = process.env.RETELL_API_KEY?.trim();
  const from = process.env.RETELL_FROM_NUMBER?.trim();
  let agents: Record<string, string> = {};
  try {
    agents = JSON.parse(process.env.RETELL_AGENTS || "{}");
  } catch {
    agents = {};
  }
  if (!key || !from || !Object.keys(agents).length) return null;
  return { key, from, agents };
}

export async function retell<T>(cfg: RetellConfig, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(BASE + path, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Retell ${path} ${r.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export { toE164 } from "./phone";
