import type { CallRecord, CallSummary, Household, Parent, Turn } from "./types";

export function blankParent(): Parent {
  return {
    id: `p${Date.now().toString(36)}`, name: "", callName: "", city: "", phone: "", language: "hi",
    callTime: "19:00", greeting: "", medicines: [], healthNotes: "", message: "",
  };
}

export const SAMPLE_HOUSEHOLD: Household = {
  childName: "Riya",
  parents: [
    {
      id: "mummy",
      name: "Kamla Devi",
      callName: "Mummy-ji",
      city: "Lucknow",
      phone: "",
      language: "hi",
      callTime: "19:00",
      greeting: "",
      medicines: [
        { id: "bp", name: "BP ki goli", times: ["morning"] },
        { id: "sugar", name: "Sugar ki goli", times: ["morning", "night"], note: "after food" },
      ],
      healthNotes: "Knee pain (left). Type 2 diabetes. Lives alone since 2023.",
      message: "Riya Sunday ko ghar aa rahi hai.",
      photo: "/parent.jpg",
    },
    {
      id: "papa",
      name: "Ramesh Chandra",
      callName: "Papa",
      city: "Kanpur",
      phone: "",
      language: "hi",
      callTime: "18:30",
      greeting: "",
      medicines: [
        { id: "thyroid", name: "Thyroid ki goli", times: ["morning"], note: "empty stomach" },
        { id: "heart", name: "Dil ki dawai", times: ["night"] },
      ],
      healthNotes: "Had a mild heart attack in 2021. Walks every morning.",
      message: "",
      photo: "/father.jpg",
    },
  ],
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

type Day = { durationSec: number; opener: [string, string]; summary: CallSummary };

const MUMMY: Day[] = [
  { durationSec: 182, opener: ["नमस्ते मम्मी-जी, आज दिन कैसा रहा?", "Accha tha beta, mandir gayi thi."],
    summary: { meds: { bp: "yes", sugar: "yes" }, ate: "yes", slept: "yes", mood: "good", complaints: [], emergency: false,
      highlight: "Went to the temple in the morning and met old friends.", summary: "Took both medicines. Ate well and slept well. In a cheerful mood." } },
  { durationSec: 205, opener: ["नमस्ते मम्मी-जी, आज दिन कैसा रहा?", "Theek tha, thoda ghutna dukh raha tha."],
    summary: { meds: { bp: "yes", sugar: "yes" }, ate: "yes", slept: "yes", mood: "okay", complaints: ["knee pain"], emergency: false,
      highlight: "Watched a serial with the neighbour, Sharma aunty.", summary: "Took both medicines. Mild pain in the left knee. Ate and slept normally." } },
  { durationSec: 166, opener: ["नमस्ते मम्मी-जी, खाना खाया?", "Thoda sa khaya, bhookh nahi thi."],
    summary: { meds: { bp: "yes", sugar: "yes" }, ate: "partly", slept: "yes", mood: "okay", complaints: ["knee pain"], emergency: false,
      highlight: "Said the weather has turned cold.", summary: "Took both medicines. Ate only a little, said she was not hungry. Knee still hurts." } },
  { durationSec: 141, opener: ["नमस्ते मम्मी-जी, आज दिन कैसा रहा?", "Bas aise hi, akele mann nahi lagta."],
    summary: { meds: { bp: "yes", sugar: "no" }, ate: "partly", slept: "unclear", mood: "low", complaints: ["knee pain", "feeling lonely"], emergency: false,
      highlight: "Said she misses the grandchildren.", summary: "Took the BP tablet but forgot the sugar tablet. Ate a little. Sounded low and lonely." } },
  { durationSec: 198, opener: ["कल आपने कहा मन नहीं लग रहा था। आज कैसा है?", "Aaj thoda accha hai, Sharma ji ki beti ki shaadi ki baat chal rahi thi."],
    summary: { meds: { bp: "yes", sugar: "yes" }, ate: "yes", slept: "yes", mood: "good", complaints: ["knee pain"], emergency: false,
      highlight: "Talked happily about the neighbour's daughter's wedding.", summary: "Took both medicines. Ate properly. Mood better than yesterday." } },
  { durationSec: 173, opener: ["सुबह की BP की गोली ली थी?", "Arre, aaj bhool gayi beta."],
    summary: { meds: { bp: "no", sugar: "yes" }, ate: "partly", slept: "yes", mood: "okay", complaints: ["knee pain"], emergency: false,
      highlight: "Spent the afternoon knitting a sweater for Riya.", summary: "Forgot the morning BP tablet. Took the sugar tablet. Ate a little less than usual." } },
];

const PAPA: Day[] = [
  { durationSec: 150, opener: ["नमस्ते पापा, आज की सैर कैसी रही?", "Badhiya, do chakkar lagaye park ke."],
    summary: { meds: { thyroid: "yes", heart: "yes" }, ate: "yes", slept: "yes", mood: "good", complaints: [], emergency: false,
      highlight: "Walked two rounds of the park with his friend Verma ji.", summary: "Took both medicines. Ate and slept well. Cheerful." } },
  { durationSec: 132, opener: ["नमस्ते पापा, आज दिन कैसा रहा?", "Theek hai, cricket dekha."],
    summary: { meds: { thyroid: "yes", heart: "yes" }, ate: "yes", slept: "yes", mood: "good", complaints: [], emergency: false,
      highlight: "Watched the India match and was happy India won.", summary: "Took both medicines. Ate well. In a good mood." } },
  { durationSec: 171, opener: ["नमस्ते पापा, नींद ठीक आई?", "Raat ko do baar uthna pada."],
    summary: { meds: { thyroid: "yes", heart: "yes" }, ate: "yes", slept: "no", mood: "okay", complaints: [], emergency: false,
      highlight: "Read the newspaper with morning tea.", summary: "Took both medicines. Woke up twice at night, slept badly." } },
  { durationSec: 160, opener: ["नमस्ते पापा, आज की सैर हुई?", "Haan, par thoda thak gaya."],
    summary: { meds: { thyroid: "yes", heart: "yes" }, ate: "yes", slept: "yes", mood: "okay", complaints: ["tiredness"], emergency: false,
      highlight: "Fixed the kitchen tap himself.", summary: "Took both medicines. Felt a little tired after the walk." } },
  { durationSec: 145, opener: ["नमस्ते पापा, आज दिन कैसा रहा?", "Sab badhiya."],
    summary: { meds: { thyroid: "yes", heart: "yes" }, ate: "yes", slept: "yes", mood: "good", complaints: [], emergency: false,
      highlight: "Planned a visit to his brother in Agra next month.", summary: "Took both medicines. Ate and slept well. Good mood." } },
  { durationSec: 138, opener: ["नमस्ते पापा, रात की दवाई ली?", "Haan le li."],
    summary: { meds: { thyroid: "yes", heart: "yes" }, ate: "yes", slept: "yes", mood: "good", complaints: [], emergency: false,
      highlight: "Taught the neighbour's son some maths.", summary: "Took both medicines. Ate well. Doing fine." } },
];

/** Six past days of calls per parent so the dashboard looks lived-in. */
export function sampleHistory(): CallRecord[] {
  const build = (parentId: string, days: Day[]) =>
    days.map((d, i): CallRecord => ({
      id: `seed-${parentId}-${i}`,
      parentId,
      date: isoDay(i - days.length),
      status: "completed",
      via: "phone",
      durationSec: d.durationSec,
      transcript: [t("ai", d.opener[0]), t("parent", d.opener[1])],
      summary: d.summary,
    }));
  return [...build("mummy", MUMMY), ...build("papa", PAPA)];
}
