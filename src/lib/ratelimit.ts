// Rate limits for REAL phone calls only (they cost money and ring real people).
//
// Two layers:
// 1. A fast in-memory window per server instance (catches bursts instantly).
// 2. A shared check against Retell's own call log, so the limits hold across
//    all serverless instances without needing a database. Each call we place
//    carries a hashed caller id in its metadata, which is what we count.
//
// The limits are generous on purpose: a judge or a family trying the demo a
// few times, plus the 4 missed-call retries, never gets near them.

import { createHash } from "node:crypto";
import { retell, type RetellConfig } from "./retell";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type Rule = { window: number; max: number; label: string };

export const LIMITS = {
  // per browser/IP that asks for calls
  client: [
    { window: 10 * MIN, max: 6, label: "6 calls in 10 minutes" },
    { window: DAY, max: 25, label: "25 calls a day" },
  ],
  // per phone number that gets rung
  number: [
    { window: 10 * MIN, max: 4, label: "4 calls to one number in 10 minutes" },
    { window: DAY, max: 15, label: "15 calls to one number a day" },
  ],
  // the whole app
  global: [
    { window: HOUR, max: 40, label: "40 calls an hour" },
    { window: DAY, max: 200, label: "200 calls a day" },
  ],
} satisfies Record<string, Rule[]>;

/** A stable, non-reversible id for whoever is asking (never the raw IP). */
export function clientId(req: Request): string {
  const h = req.headers;
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
  const salt = process.env.RETELL_API_KEY?.slice(-12) ?? "haal-chaal";
  return createHash("sha256").update(salt + ip).digest("hex").slice(0, 16);
}

// ---------- layer 1: in-memory ----------
const hits = new Map<string, number[]>();
function memoryCheck(key: string, rules: Rule[], now: number): Rule | null {
  const longest = Math.max(...rules.map((r) => r.window));
  const list = (hits.get(key) ?? []).filter((t) => now - t < longest);
  hits.set(key, list);
  return rules.find((r) => list.filter((t) => now - t < r.window).length >= r.max) ?? null;
}
function memoryRecord(keys: string[], now: number) {
  for (const k of keys) hits.set(k, [...(hits.get(k) ?? []), now]);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
}

// ---------- layer 2: Retell's call log ----------
interface LoggedCall { start_timestamp?: number; to_number?: string; metadata?: Record<string, unknown> }

async function recentCalls(cfg: RetellConfig): Promise<LoggedCall[] | null> {
  try {
    const r = await retell<{ items: LoggedCall[] }>(cfg, "/v3/list-calls", { body: { limit: 250, sort_order: "descending" } });
    return (r.items ?? []).filter((c) => c.metadata?.app === "haal-chaal");
  } catch (err) {
    console.error("[ratelimit] could not read the call log, using the in-memory limit only", err);
    return null;
  }
}

function count(calls: LoggedCall[], now: number, window: number, match: (c: LoggedCall) => boolean) {
  return calls.filter((c) => (c.start_timestamp ?? now) > now - window && match(c)).length;
}

export type LimitResult = { ok: true; client: string } | { ok: false; status: 429; error: string; retryAfter: number };

/** Call before placing a real phone call. On success, pass `client` into the call's metadata. */
export async function checkCallLimit(req: Request, cfg: RetellConfig, to: string): Promise<LimitResult> {
  const now = Date.now();
  const client = clientId(req);
  const keys = { client: `c:${client}`, number: `n:${to}`, global: "g" } as const;

  const deny = (scope: keyof typeof LIMITS, rule: Rule): LimitResult => {
    const who = scope === "number" ? "this phone number" : scope === "client" ? "you" : "the demo";
    const wait = Math.ceil(Math.min(rule.window, HOUR) / MIN);
    console.warn(`[ratelimit] blocked: ${scope} over ${rule.label}`);
    return { ok: false, status: 429, retryAfter: wait * 60, error: `Too many real phone calls for ${who} right now (limit: ${rule.label}). Please try again in about ${wait} minutes. Browser calls still work.` };
  };

  for (const scope of ["client", "number", "global"] as const) {
    const hit = memoryCheck(keys[scope], LIMITS[scope], now);
    if (hit) return deny(scope, hit);
  }

  const calls = await recentCalls(cfg);
  if (calls) {
    const match = {
      client: (c: LoggedCall) => c.metadata?.client === client,
      number: (c: LoggedCall) => c.to_number === to,
      global: () => true,
    };
    for (const scope of ["client", "number", "global"] as const) {
      const hit = LIMITS[scope].find((r) => count(calls, now, r.window, match[scope]) >= r.max);
      if (hit) return deny(scope, hit);
    }
  }

  memoryRecord(Object.values(keys), now);
  return { ok: true, client };
}

export function limitResponse(r: Extract<LimitResult, { ok: false }>) {
  return Response.json({ error: r.error }, { status: 429, headers: { "Retry-After": String(r.retryAfter) } });
}
