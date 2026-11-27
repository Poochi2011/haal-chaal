"use client";

// Rings the family member when a call turns up an emergency. One alert call
// per parent per 10 minutes, so a single bad call can't ring someone repeatedly.

import type { Household, Parent } from "./types";

const PIN_KEY = "haalchaal.pin";
const LAST_KEY = "haalchaal.lastAlert.";

export function getPin(): string {
  return typeof window === "undefined" ? "" : window.localStorage.getItem(PIN_KEY) ?? "";
}
export function setPin(pin: string) {
  window.localStorage.setItem(PIN_KEY, pin.trim());
}

export type AlertResult = { ok: true; message: string } | { ok: false; message: string };

export async function callFamilyAboutEmergency(h: Household, p: Parent, reason: string, said?: string, missed?: { attempts: number }): Promise<AlertResult> {
  if (!h.childPhone) return { ok: false, message: "Add your phone number in Family settings to get an automatic emergency call." };
  const last = Number(window.localStorage.getItem(LAST_KEY + p.id) || 0);
  if (Date.now() - last < 10 * 60 * 1000) return { ok: true, message: "An emergency call to you was already placed in the last 10 minutes." };
  try {
    const r = await fetch("/api/phone/alert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childName: h.childName, childPhone: h.childPhone, parentName: p.callName || p.name, reason, said, kind: missed ? "missed" : "symptom", attempts: missed?.attempts, pin: getPin() }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, message: d.error ?? "The emergency call could not be placed." };
    window.localStorage.setItem(LAST_KEY + p.id, String(Date.now()));
    const masked = h.childPhone.slice(0, -4).replace(/\d/g, "•") + h.childPhone.slice(-4);
    return { ok: true, message: `Calling ${h.childName || "you"} now at ${masked} with ${missed ? "a missed-call alert" : "an urgent alert"}.` };
  } catch {
    return { ok: false, message: "The emergency call could not be placed (no connection)." };
  }
}
