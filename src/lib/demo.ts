// DEMO MODE: a scripted conversation + rule-based extraction, used when no
// ANTHROPIC_API_KEY is set (e.g. judges running `docker compose up`), or if
// the AI call fails mid-call. The whole flow still works end to end.

import type { Ate, CallRecord, CallSummary, Family, Mood, Tri, Turn } from "./types";
import { detectEmergency } from "./safety";

type Lang = "hi" | "en";

const L = {
  hi: {
    greet: (n: string) => `Namaste ${n}, main Haal-Chaal se bol rahi hoon. Aaj aapka din kaisa raha?`,
    med: (m: string, t: string) => `Achha. Aapne ${t === "night" ? "raat" : t === "morning" ? "subah" : "aaj"} ki ${m} li?`,
    food: "Aaj khana theek se khaya?",
    sleep: "Aur kal raat neend theek aayi?",
    follow: (c: string) => `Pichhli baar aapne ${c} ki baat ki thi. Ab kaisa hai?`,
    free: "Aur kuch batana chahengi?",
    message: (m: string) => `Ek khushkhabri hai. ${m}`,
    bye: (n: string) => `Apna khayal rakhiye ${n}. Kal phir baat karenge. Namaste.`,
    repeat: "Maaf kijiye, phir se bolenge?",
    silence: "Kya aap mujhe sun pa rahi hain?",
    emergency: "Main abhi aapke bachchon ko bata rahi hoon. Kripya kisi padosi ko bulaiye.",
  },
  en: {
    greet: (n: string) => `Hello ${n}, this is Haal-Chaal calling. How was your day today?`,
    med: (m: string, t: string) => `Okay. Did you take your ${t} ${m}?`,
    food: "Did you eat properly today?",
    sleep: "And did you sleep well last night?",
    follow: (c: string) => `Last time you mentioned ${c}. How is it now?`,
    free: "Is there anything else you would like to tell me?",
    message: (m: string) => `I have a message for you. ${m}`,
    bye: (n: string) => `Please take care, ${n}. We will talk again tomorrow. Goodbye.`,
    repeat: "Sorry, could you say that again?",
    silence: "Can you hear me?",
    emergency: "I am telling your children right now. Please call a neighbour.",
  },
};

/** Builds the fixed list of questions for this family. */
export function demoScript(family: Family, lastComplaint: string | null): string[] {
  const s = L[family.language === "en" ? "en" : "hi"];
  const lines = [s.greet(family.callName)];
  for (const m of family.medicines) lines.push(s.med(m.name, m.time));
  lines.push(s.food, s.sleep);
  if (lastComplaint) lines.push(s.follow(lastComplaint));
  lines.push(s.free);
  return lines;
}

export function demoTurn(family: Family, transcript: Turn[], lastComplaint: string | null) {
  const lang: Lang = family.language === "en" ? "en" : "hi";
  const s = L[lang];
  const lastParent = [...transcript].reverse().find((t) => t.role === "parent");
  if (lastParent && detectEmergency(lastParent.text)) {
    return { say: s.emergency, end: true, emergency: true };
  }
  if (lastParent?.text === "[silence]") {
    const silences = transcript.filter((t) => t.text === "[silence]").length;
    if (silences >= 2) return { say: s.bye(family.callName), end: true, emergency: false };
    return { say: s.silence, end: false, emergency: false };
  }
  const script = demoScript(family, lastComplaint);
  const asked = transcript.filter((t) => t.role === "ai").length;
  if (asked < script.length) return { say: script[asked], end: false, emergency: false };
  const parts = [];
  if (family.message.trim()) parts.push(s.message(family.message.trim()));
  parts.push(s.bye(family.callName));
  return { say: parts.join(" "), end: true, emergency: false };
}

// ---------- rule-based extraction ----------

const YES = /\b(haan|haa|ha|ji|hanji|le li|li thi|kha liya|khaya|aayi|aai|yes|yeah|took|did|accha|achha|theek)\b|हाँ|हां|जी|ले ली|खाया|आई/i;
const NO = /\b(nahi|nahin|nhi|na|bhool|bhul|no|not|didn'?t|forgot)\b|नहीं|भूल/i;
const PARTLY = /\b(thoda|thodi|kam|little|less|bit)\b|थोड़ा|कम/i;
const LOW = /\b(udaas|akela|akeli|mann nahi|dukhi|sad|lonely|alone|low)\b|उदास|अकेल/i;
const GOOD = /\b(accha|achha|badhiya|khush|maza|happy|good|great|fine)\b|अच्छा|बढ़िया|खुश/i;

function tri(text: string | undefined): Tri {
  if (!text || text === "[silence]") return "unclear";
  if (NO.test(text)) return "no";
  if (YES.test(text)) return "yes";
  return "unclear";
}

const COMPLAINTS: [RegExp, string][] = [
  [/ghutn|घुटन|knee/i, "knee pain"],
  [/kamar|कमर|back pain/i, "back pain"],
  [/sar\s*dard|सर\s*दर्द|सिर|headache/i, "headache"],
  [/bukhar|बुखार|fever/i, "fever"],
  [/khansi|खांसी|cough/i, "cough"],
  [/neend nahi|नींद नहीं|can'?t sleep/i, "trouble sleeping"],
];

export function demoExtract(family: Family, transcript: Turn[], last?: CallRecord): CallSummary {
  // Pair each AI question with the parent reply that follows it.
  const answers: { q: string; a: string }[] = [];
  transcript.forEach((t, i) => {
    if (t.role === "ai" && transcript[i + 1]?.role === "parent") answers.push({ q: t.text, a: transcript[i + 1].text });
  });
  const find = (re: RegExp) => answers.find((x) => re.test(x.q))?.a;
  const all = transcript.filter((t) => t.role === "parent").map((t) => t.text).join(" ");

  const meds: Record<string, Tri> = {};
  for (const m of family.medicines) meds[m.id] = tri(find(new RegExp(m.name.split(" ")[0], "i")));

  const foodA = find(/khana|eat/i);
  let ate: Ate = tri(foodA) as Ate;
  if (foodA && PARTLY.test(foodA)) ate = "partly";

  const slept = tri(find(/neend|sleep/i));
  const firstA = answers[0]?.a ?? "";
  const mood: Mood = LOW.test(all) ? "low" : GOOD.test(firstA) ? "good" : firstA ? "okay" : "unclear";

  const complaints = COMPLAINTS.filter(([re]) => re.test(all)).map(([, c]) => c);
  if (LOW.test(all)) complaints.push("feeling lonely");
  const emergencyReason = detectEmergency(all);
  const missed = family.medicines.filter((m) => meds[m.id] === "no").map((m) => m.name);

  const bits = [
    missed.length ? `Missed: ${missed.join(", ")}.` : "Took all medicines that were asked about.",
    ate === "yes" ? "Ate properly." : ate === "partly" ? "Ate only a little." : ate === "no" ? "Has not eaten." : "",
    complaints.length ? `Mentioned ${complaints.join(", ")}.` : "",
  ].filter(Boolean);

  void last;
  return {
    meds, ate, slept, mood, complaints,
    emergency: Boolean(emergencyReason),
    emergencyReason: emergencyReason ?? undefined,
    highlight: firstA ? `Said: "${firstA.slice(0, 90)}"` : "Short call.",
    summary: bits.join(" "),
  };
}
