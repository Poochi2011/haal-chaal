import type { CallRecord, Family, Turn } from "./types";

export const SAMPLE_FAMILY: Family = {
  parentName: "Kamla Devi",
  callName: "Mummy-ji",
  city: "Lucknow",
  language: "hi",
  callTime: "19:00",
  medicines: [
    { id: "bp", name: "BP ki goli", time: "morning" },
    { id: "sugar", name: "Sugar ki goli", time: "night" },
  ],
  healthNotes: "Knee pain (left). Type 2 diabetes. Lives alone since 2023.",
  childName: "Riya",
  message: "Riya Sunday ko ghar aa rahi hai.",
};

export function isoDay(offset: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const t = (role: Turn["role"], text: string): Turn => ({ role, text, at: 0 });

/** Six past days of calls so the dashboard looks lived-in on first open. */
export function sampleHistory(): CallRecord[] {
  const days: Omit<CallRecord, "id" | "date">[] = [
    {
      status: "completed", durationSec: 182,
      transcript: [t("ai", "Namaste Mummy-ji, aaj din kaisa raha?"), t("parent", "Accha tha beta, mandir gayi thi.")],
      summary: {
        meds: { bp: "yes", sugar: "yes" }, ate: "yes", slept: "yes", mood: "good",
        complaints: [], emergency: false,
        highlight: "Went to the temple in the morning and met old friends.",
        summary: "Took both medicines. Ate well and slept well. In a cheerful mood.",
      },
    },
    {
      status: "completed", durationSec: 205,
      transcript: [t("ai", "Namaste Mummy-ji, aaj din kaisa raha?"), t("parent", "Theek tha, thoda ghutna dukh raha tha.")],
      summary: {
        meds: { bp: "yes", sugar: "yes" }, ate: "yes", slept: "yes", mood: "okay",
        complaints: ["knee pain"], emergency: false,
        highlight: "Watched a serial with the neighbour, Sharma aunty.",
        summary: "Took both medicines. Mild pain in the left knee. Ate and slept normally.",
      },
    },
    {
      status: "completed", durationSec: 166,
      transcript: [t("ai", "Namaste Mummy-ji, khana khaya?"), t("parent", "Thoda sa khaya, bhookh nahi thi.")],
      summary: {
        meds: { bp: "yes", sugar: "yes" }, ate: "partly", slept: "yes", mood: "okay",
        complaints: ["knee pain"], emergency: false,
        highlight: "Said the weather has turned cold.",
        summary: "Took both medicines. Ate only a little, said she was not hungry. Knee still hurts.",
      },
    },
    {
      status: "completed", durationSec: 141,
      transcript: [t("ai", "Namaste Mummy-ji, aaj din kaisa raha?"), t("parent", "Bas aise hi, akele mann nahi lagta.")],
      summary: {
        meds: { bp: "yes", sugar: "no" }, ate: "partly", slept: "unclear", mood: "low",
        complaints: ["knee pain", "feeling lonely"], emergency: false,
        highlight: "Said she misses the grandchildren.",
        summary: "Took the BP tablet but forgot the sugar tablet. Ate a little. Sounded low and lonely.",
      },
    },
    {
      status: "completed", durationSec: 198,
      transcript: [t("ai", "Namaste Mummy-ji, kal aapne kaha mann nahi lag raha tha. Aaj kaisa hai?"), t("parent", "Aaj thoda accha hai, Sharma ji ki beti ki shaadi ki baat chal rahi thi.")],
      summary: {
        meds: { bp: "yes", sugar: "yes" }, ate: "yes", slept: "yes", mood: "good",
        complaints: ["knee pain"], emergency: false,
        highlight: "Talked happily about the neighbour's daughter's wedding.",
        summary: "Took both medicines. Ate properly. Mood better than yesterday.",
      },
    },
    {
      status: "completed", durationSec: 173,
      transcript: [t("ai", "Namaste Mummy-ji, subah ki BP ki goli li thi?"), t("parent", "Arre, aaj bhool gayi beta.")],
      summary: {
        meds: { bp: "no", sugar: "yes" }, ate: "partly", slept: "yes", mood: "okay",
        complaints: ["knee pain"], emergency: false,
        highlight: "Spent the afternoon knitting a sweater for Riya.",
        summary: "Forgot the morning BP tablet. Took the sugar tablet. Ate a little less than usual.",
      },
    },
  ];
  return days.map((d, i) => ({ ...d, id: `seed-${i}`, date: isoDay(i - days.length) }));
}
