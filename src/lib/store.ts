"use client";

// Prototype storage: everything lives in the browser (localStorage), seeded
// with a sample family. Each judge or tester gets their own copy, and the app
// needs no database to run. A real launch would move this to a server DB.

import { SAMPLE_FAMILY, sampleHistory } from "./seed";
import type { CallRecord, Family } from "./types";

const FAMILY_KEY = "haalchaal.family.v1";
const CALLS_KEY = "haalchaal.calls.v1";
const ONBOARDED_KEY = "haalchaal.onboarded.v1";

export function isOnboarded(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(ONBOARDED_KEY) === "1";
}

export function markOnboarded() {
  window.localStorage.setItem(ONBOARDED_KEY, "1");
}

export function saveCalls(calls: CallRecord[]) {
  write(CALLS_KEY, calls);
}

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("haalchaal:change"));
}

export function loadFamily(): Family {
  const f = read<Family>(FAMILY_KEY);
  if (f) return f;
  write(FAMILY_KEY, SAMPLE_FAMILY);
  return SAMPLE_FAMILY;
}

export function saveFamily(f: Family) {
  write(FAMILY_KEY, f);
}

export function loadCalls(): CallRecord[] {
  const c = read<CallRecord[]>(CALLS_KEY);
  if (c) return c;
  const seeded = sampleHistory();
  write(CALLS_KEY, seeded);
  return seeded;
}

/** Saves a call. One record per day: a new call today replaces today's. */
export function saveCall(rec: CallRecord) {
  const calls = loadCalls().filter((c) => c.date !== rec.date);
  calls.push(rec);
  calls.sort((a, b) => a.date.localeCompare(b.date));
  write(CALLS_KEY, calls);
}

export function resetDemo() {
  write(FAMILY_KEY, SAMPLE_FAMILY);
  write(CALLS_KEY, sampleHistory());
}
