"use client";

// Prototype storage: everything lives in the browser (localStorage), seeded
// with a sample household. Each judge or tester gets their own copy, and the
// app needs no database to run. A real launch would move this to a server DB.

import { SAMPLE_HOUSEHOLD, sampleHistory } from "./seed";
import type { CallRecord, Household, Parent } from "./types";

const HOUSEHOLD_KEY = "haalchaal.household.v2";
const CALLS_KEY = "haalchaal.calls.v2";
const ACTIVE_KEY = "haalchaal.active.v2";
const ONBOARDED_KEY = "haalchaal.onboarded.v2";

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

export function isOnboarded(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(ONBOARDED_KEY) === "1";
}
export function markOnboarded() {
  window.localStorage.setItem(ONBOARDED_KEY, "1");
}

export function loadHousehold(): Household {
  const h = read<Household>(HOUSEHOLD_KEY);
  if (h && h.parents?.length) return h;
  write(HOUSEHOLD_KEY, SAMPLE_HOUSEHOLD);
  return SAMPLE_HOUSEHOLD;
}
export function saveHousehold(h: Household) {
  write(HOUSEHOLD_KEY, h);
}

export function saveParent(p: Parent) {
  const h = loadHousehold();
  const exists = h.parents.some((x) => x.id === p.id);
  saveHousehold({ ...h, parents: exists ? h.parents.map((x) => (x.id === p.id ? p : x)) : [...h.parents, p] });
}

export function removeParent(id: string) {
  const h = loadHousehold();
  if (h.parents.length <= 1) return;
  saveHousehold({ ...h, parents: h.parents.filter((p) => p.id !== id) });
  saveCalls(loadCalls().filter((c) => c.parentId !== id));
  if (window.localStorage.getItem(ACTIVE_KEY) === id) setActiveId(h.parents.find((p) => p.id !== id)!.id);
}

export function getActiveId(): string {
  const h = loadHousehold();
  const id = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_KEY) : null;
  return id && h.parents.some((p) => p.id === id) ? id : h.parents[0].id;
}
export function setActiveId(id: string) {
  window.localStorage.setItem(ACTIVE_KEY, id);
  window.dispatchEvent(new Event("haalchaal:change"));
}

export function loadCalls(): CallRecord[] {
  const c = read<CallRecord[]>(CALLS_KEY);
  if (c) return c;
  const seeded = sampleHistory();
  write(CALLS_KEY, seeded);
  return seeded;
}
export function saveCalls(calls: CallRecord[]) {
  write(CALLS_KEY, calls);
}

/** Saves a call. One record per parent per day: a new call replaces today's. */
export function saveCall(rec: CallRecord) {
  const calls = loadCalls().filter((c) => !(c.parentId === rec.parentId && c.date === rec.date));
  calls.push(rec);
  calls.sort((a, b) => a.date.localeCompare(b.date));
  write(CALLS_KEY, calls);
}

/** Wipes everything this app stored in the browser and starts fresh. */
export function resetAll() {
  for (const k of Object.keys(window.localStorage)) if (k.startsWith("haalchaal.")) window.localStorage.removeItem(k);
  window.dispatchEvent(new Event("haalchaal:change"));
}

export function resetDemo() {
  write(HOUSEHOLD_KEY, SAMPLE_HOUSEHOLD);
  write(CALLS_KEY, sampleHistory());
  setActiveId(SAMPLE_HOUSEHOLD.parents[0].id);
}
