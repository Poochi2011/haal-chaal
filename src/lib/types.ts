import type { LangCode } from "./languages";

export type Tri = "yes" | "no" | "unclear";
export type Ate = "yes" | "partly" | "no" | "unclear";
export type Mood = "good" | "okay" | "low" | "unclear";
export type DoseTime = "morning" | "afternoon" | "night";

export interface Medicine {
  id: string;
  name: string;        // how the family says it, e.g. "BP ki goli"
  times: DoseTime[];   // one or more times a day
  note?: string;       // e.g. "after food", "half tablet"
}

/** One parent who receives the daily call. */
export interface Parent {
  id: string;
  name: string;        // "Kamla Devi"
  callName: string;    // "Mummy-ji"
  city: string;
  phone: string;       // E.164, e.g. +9198xxxxxxx (the PARENT's phone)
  language: LangCode;
  callTime: string;    // "19:00"
  greeting: string;    // optional custom first line of the call
  medicines: Medicine[];
  healthNotes: string;
  message: string;     // one-off message to pass on in the next call
  photo?: string;      // optional image url
}

export interface Household {
  childName: string;   // the person managing the app
  childPhone?: string; // E.164; rung automatically on an emergency
  parents: Parent[];
}

export interface Turn {
  role: "ai" | "parent";
  text: string;
  at: number;
}

export interface CallSummary {
  meds: Record<string, Tri>;   // medicine id -> taken?
  ate: Ate;
  slept: Tri;
  mood: Mood;
  complaints: string[];        // short English phrases, e.g. "knee pain"
  emergency: boolean;
  emergencyReason?: string;
  highlight: string;           // one warm line in English
  summary: string;             // 2–3 line English summary for the family
}

export type CallStatus = "completed" | "no_answer" | "emergency";

export interface CallRecord {
  id: string;
  parentId: string;
  date: string;          // YYYY-MM-DD
  status: CallStatus;
  via: "browser" | "phone";
  durationSec: number;
  transcript: Turn[];
  summary?: CallSummary;
  messageDelivered?: string;
  attempts?: number;     // how many times we rang before giving up (missed calls)
}

export type AlertLevel = "red" | "amber";

export interface FamilyAlert {
  level: AlertLevel;
  title: string;
  detail: string;
}

/** What the conversation endpoint returns for each assistant turn. */
export interface TurnReply {
  say: string;
  end: boolean;
  emergency: boolean;
  mode: "ai" | "demo";
}

export const DOSE_LABEL: Record<DoseTime, string> = { morning: "Morning", afternoon: "Afternoon", night: "Night" };
export const DOSE_HI: Record<DoseTime, string> = { morning: "सुबह", afternoon: "दोपहर", night: "रात" };

export function doseText(m: Medicine): string {
  return m.times.map((t) => DOSE_LABEL[t].toLowerCase()).join(" and ");
}
