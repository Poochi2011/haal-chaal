"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Heart, Plus, Trash2 } from "lucide-react";
import { SunriseHills } from "@/components/bits";
import { LANGUAGES } from "@/lib/languages";
import { markOnboarded, resetDemo, saveCalls, saveFamily } from "@/lib/store";
import type { Family } from "@/lib/types";

const field = "w-full rounded-2xl border border-line bg-white px-4 py-4 text-[17px] text-ink outline-none focus:border-iris";

const BLANK: Family = {
  parentName: "", callName: "", city: "", language: "hi", callTime: "19:00",
  medicines: [{ id: "m1", name: "", time: "morning" }],
  healthNotes: "", childName: "", message: "",
};

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Family>(BLANK);
  const set = <K extends keyof Family>(k: K, v: Family[K]) => setF({ ...f, [k]: v });

  const useSample = () => { resetDemo(); markOnboarded(); router.push("/"); };
  const finish = () => {
    saveFamily({ ...f, callName: f.callName || f.parentName, medicines: f.medicines.filter((m) => m.name.trim()) });
    saveCalls([]);
    markOnboarded();
    router.push("/call");
  };

  const canNext = [true, f.parentName.trim() && f.childName.trim(), true, true][step];
  const steps = ["Welcome", "Your parent", "Language", "Medicines"];

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="relative h-44 overflow-hidden sm:h-56">
        <SunriseHills className="absolute inset-0 h-full w-full" />
        <div className="relative flex items-center gap-2.5 px-6 pt-6 text-ink">
          <Heart className="h-7 w-7" strokeWidth={2.2} /><span className="text-[22px] font-bold">Haal Chaal</span>
        </div>
      </div>

      <div className="mx-auto -mt-16 w-full max-w-xl flex-1 px-5 pb-10">
        <div className="card rise p-6 sm:p-8">
          {step > 0 && (
            <div className="mb-6 flex gap-1.5">
              {steps.slice(1).map((s, i) => <span key={s} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-iris" : "bg-cream-2"}`} />)}
            </div>
          )}

          {step === 0 && (
            <>
              <h1 className="text-[30px] font-bold leading-tight tracking-tight text-ink sm:text-[36px]">A daily call for your parent, in their language.</h1>
              <p className="mt-3 text-[17px] leading-relaxed text-ink-2">
                Every evening Haal-Chaal calls your mother or father on their normal phone, asks about medicines, food and mood, and remembers yesterday. You get a short summary, and an alert if something is wrong.
              </p>
              <p className="mt-3 text-[15px] text-muted">They don&apos;t install anything. They just answer and talk.</p>
              <div className="mt-7 flex flex-col gap-3">
                <button onClick={() => setStep(1)} className="flex items-center justify-center gap-2 rounded-2xl bg-navy px-6 py-4 text-[17px] font-semibold text-white">
                  Set up my parent <ArrowRight className="h-5 w-5" />
                </button>
                <button onClick={useSample} className="rounded-2xl border border-line bg-white px-6 py-4 text-[16px] font-semibold text-ink">
                  Explore with a sample family
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-[26px] font-bold text-ink">Who should we call?</h2>
              <label className="block"><span className="mb-1.5 block text-[15px] font-semibold text-ink">Parent&apos;s name</span>
                <input autoFocus className={field} placeholder="e.g. Kamla Devi" value={f.parentName} onChange={(e) => set("parentName", e.target.value)} /></label>
              <label className="block"><span className="mb-1.5 block text-[15px] font-semibold text-ink">What do you call them? <span className="font-normal text-muted">The call greets them this way</span></span>
                <input className={field} placeholder="e.g. Mummy-ji, Papa, Amma, Baba" value={f.callName} onChange={(e) => set("callName", e.target.value)} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-1.5 block text-[15px] font-semibold text-ink">Their city</span>
                  <input className={field} placeholder="e.g. Lucknow" value={f.city} onChange={(e) => set("city", e.target.value)} /></label>
                <label className="block"><span className="mb-1.5 block text-[15px] font-semibold text-ink">Your name</span>
                  <input className={field} placeholder="e.g. Riya" value={f.childName} onChange={(e) => set("childName", e.target.value)} /></label>
              </div>
            </div>
          )}

          {step === 2 && (
            <>
              <h2 className="text-[26px] font-bold text-ink">Which language do they speak?</h2>
              <p className="mt-1 text-[15px] text-muted">The call speaks and listens in this language. Mixing in English words is fine.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {LANGUAGES.map((l) => (
                  <button key={l.code} onClick={() => set("language", l.code)} className={`relative rounded-2xl border-2 px-4 py-4 text-left transition ${f.language === l.code ? "border-iris bg-lav" : "border-line bg-white hover:border-lav-2"}`}>
                    <span className="block text-[22px] font-semibold text-ink">{l.native}</span>
                    <span className="text-[14px] text-muted">{l.name}</span>
                    {f.language === l.code && <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-iris text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>}
                  </button>
                ))}
              </div>
              <label className="mt-5 block"><span className="mb-1.5 block text-[15px] font-semibold text-ink">Daily call time</span>
                <input type="time" className={field} value={f.callTime} onChange={(e) => set("callTime", e.target.value)} /></label>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-[26px] font-bold text-ink">Which medicines should we ask about?</h2>
              <p className="mt-1 text-[15px] text-muted">Use the words your parent uses, like &quot;BP ki goli&quot;. You can skip this.</p>
              <div className="mt-5 space-y-2.5">
                {f.medicines.map((m, i) => (
                  <div key={m.id} className="flex gap-2">
                    <input className={field} placeholder="Medicine" value={m.name} onChange={(e) => set("medicines", f.medicines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <select className={`${field} w-32 shrink-0 px-3`} value={m.time} onChange={(e) => set("medicines", f.medicines.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))}>
                      <option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="night">Night</option>
                    </select>
                    {f.medicines.length > 1 && (
                      <button aria-label="Remove" onClick={() => set("medicines", f.medicines.filter((_, j) => j !== i))} className="grid w-12 shrink-0 place-items-center rounded-2xl border border-line text-muted"><Trash2 className="h-4.5 w-4.5" /></button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => set("medicines", [...f.medicines, { id: `m${Date.now()}`, name: "", time: "night" }])} className="mt-3 flex items-center gap-2 text-[15px] font-semibold text-iris"><Plus className="h-4 w-4" /> Add another</button>
              <label className="mt-5 block"><span className="mb-1.5 block text-[15px] font-semibold text-ink">Anything we should know? <span className="font-normal text-muted">Optional</span></span>
                <input className={field} placeholder="e.g. knee pain, diabetes" value={f.healthNotes} onChange={(e) => set("healthNotes", e.target.value)} /></label>
            </>
          )}

          {step > 0 && (
            <div className="mt-8 flex gap-3">
              <button onClick={() => setStep(step - 1)} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-line bg-white text-ink" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
              <button
                disabled={!canNext}
                onClick={() => (step === 3 ? finish() : setStep(step + 1))}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-navy px-6 py-4 text-[17px] font-semibold text-white disabled:opacity-40"
              >
                {step === 3 ? "Hear the first call" : "Next"} <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
