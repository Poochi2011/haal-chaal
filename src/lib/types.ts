import type { LangCode } from "./languages";

export type Tri = "yes" | "no" | "unclear";
export type Ate = "yes" | "partly" | "no" | "unclear";
export type Mood = "good" | "okay" | "low" | "unclear";

export interface Medicine {
  id: string;
  name: string;   // how the family says it, e.g. "BP ki goli"
  time: string;   // "morning" | "afternoon" | "night" or free text
}

export interface Family {
  parentName: string;  // "Kamla Devi"
  callName: string;    // "Mummy-ji"
  city: string;
  language: LangCode;
  callTime: string;    // "19:00"
  medicines: Medicine[];
  healthNotes: string;
  childName: string;
  message: string;     // one-off message to pass on in the next call
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
  date: string;          // YYYY-MM-DD
  status: CallStatus;
  durationSec: number;
  transcript: Turn[];
  summary?: CallSummary;
  messageDelivered?: string;
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
