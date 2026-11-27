"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Heart, PhoneCall, UserPlus } from "lucide-react";
import { Avatar, SunriseHills } from "@/components/bits";
import { cleanMedicines, MedicineEditor } from "@/components/MedicineEditor";
import { LANGUAGES } from "@/lib/languages";
import { toE164 } from "@/lib/phone";
import { blankParent } from "@/lib/seed";
import { markOnboarded, resetDemo, saveCalls, saveHousehold, setActiveId } from "@/lib/store";
import type { Parent } from "@/lib/types";

const field = "w-full rounded-2xl border border-line bg-white px-4 py-4 text-[17px] text-ink outline-none focus:border-iris";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] font-semibold text-ink">{label}{hint && <span className="mt-0.5 block text-[13px] font-normal text-muted">{hint}</span>}</span>
      {children}
    </label>
  );
}

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);           // 0 intro · 1 you · 2 parent · 3 language · 4 medicines · 5 done
  const [childName, setChildName] = useState("");
  const [parents, setParents] = useState<Parent[]>([]);
  const [p, setP] = useState<Parent>(blankParent());
  const set = <K extends keyof Parent>(k: K, v: Parent[K]) => setP({ ...p, [k]: v });

  const phoneOk = !p.phone.trim() || toE164(p.phone) !== null;
  const canNext: Record<number, boolean> = {
    1: childName.trim().length > 0,
    2: p.name.trim().length > 0 && phoneOk,
    3: true,
    4: true,
  };

  const useSample = () => { resetDemo(); markOnboarded(); router.push("/"); };

  const commitParent = () => {
    const clean: Parent = {
      ...p,
      name: p.name.trim(),
      callName: p.callName.trim() || p.name.trim(),
      phone: p.phone.trim() ? toE164(p.phone)! : "",
      medicines: cleanMedicines(p.medicines),
    };
    setParents((list) => [...list.filter((x) => x.id !== clean.id), clean]);
    setStep(5);
  };

  const addAnother = () => { setP(blankParent()); setStep(2); };

  const finish = (dest: string) => {
    saveHousehold({ childName: childName.trim(), parents });
    saveCalls([]);
    setActiveId(parents[0].id);
    markOnboarded();
    router.push(dest);
  };

  const progress = Math.min(step, 4);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="relative h-40 overflow-hidden sm:h-56">
        <SunriseHills className="absolute inset-0 h-full w-full" />
        <div className="relative flex items-center gap-2.5 px-6 pt-6 text-ink">
          <Heart className="h-7 w-7" strokeWidth={2.2} /><span className="text-[22px] font-bold">Haal Chaal</span>
        </div>
      </div>

      <div className="mx-auto -mt-14 w-full max-w-xl flex-1 px-4 pb-10 sm:px-5">
        <div className="card rise p-5 sm:p-8">
          {step > 0 && step < 5 && (
            <div className="mb-6 flex gap-1.5" aria-label={`Step ${progress} of 4`}>
              {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= progress ? "bg-iris" : "bg-cream-2"}`} />)}
            </div>
          )}

          {step === 0 && (
            <>
              <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[36px]">A daily call for your parents, in their language.</h1>
              <p className="mt-3 text-[17px] leading-relaxed text-ink-2">
                Every evening Haal-Chaal rings your mother or father on their own phone, asks about medicines, food and mood, and remembers yesterday. You get a short summary, and an alert if something is wrong.
              </p>
              <p className="mt-3 text-[15px] text-muted">They don&apos;t install anything. They just pick up and talk.</p>
              <div className="mt-7 flex flex-col gap-3">
                <button onClick={() => setStep(1)} className="flex items-center justify-center gap-2 rounded-2xl bg-navy px-6 py-4 text-[17px] font-semibold text-white">
                  Set up my parents <ArrowRight className="h-5 w-5" />
                </button>
                <button onClick={useSample} className="rounded-2xl border border-line bg-white px-6 py-4 text-[16px] font-semibold text-ink">
                  Explore with a sample family
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-[26px] font-bold text-ink">First, what&apos;s your name?</h2>
              <p className="-mt-2 text-[15px] text-muted">You&apos;ll see the summaries and alerts. We never call you, only your parents.</p>
              <Field label="Your name"><input autoFocus className={field} placeholder="e.g. Riya" value={childName} onChange={(e) => setChildName(e.target.value)} /></Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-[26px] font-bold text-ink">{parents.length ? "Who else should we call?" : "Who should we call?"}</h2>
              <Field label="Parent's name"><input autoFocus className={field} placeholder={parents.length ? "e.g. Ramesh Chandra" : "e.g. Kamla Devi"} value={p.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="What do you call them?" hint="The call greets them this way">
                <input className={field} placeholder="e.g. Mummy-ji, Papa, Amma, Baba" value={p.callName} onChange={(e) => set("callName", e.target.value)} />
              </Field>
              <Field label="Their phone number" hint="Haal-Chaal rings this phone every day. You can add it later.">
                <input type="tel" inputMode="tel" autoComplete="off" className={`${field} ${phoneOk ? "" : "border-alarm"}`} placeholder="e.g. 98765 43210" value={p.phone} onChange={(e) => set("phone", e.target.value)} />
                {!phoneOk && <span className="mt-1 block text-[13px] text-alarm">Enter a 10-digit Indian mobile number, or include the country code.</span>}
              </Field>
              <Field label="Their city"><input className={field} placeholder="e.g. Lucknow" value={p.city} onChange={(e) => set("city", e.target.value)} /></Field>
            </div>
          )}

          {step === 3 && (
            <>
              <h2 className="text-[26px] font-bold text-ink">Which language does {p.callName || p.name || "they"} speak?</h2>
              <p className="mt-1 text-[15px] text-muted">The call speaks and listens in this language. Mixing in English words is fine.</p>
              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
                {LANGUAGES.map((l) => (
                  <button key={l.code} type="button" aria-pressed={p.language === l.code} onClick={() => set("language", l.code)} className={`relative rounded-2xl border-2 px-4 py-3.5 text-left transition ${p.language === l.code ? "border-iris bg-lav" : "border-line bg-white hover:border-lav-2"}`}>
                    <span className="block text-[21px] font-semibold text-ink">{l.native}</span>
                    <span className="text-[14px] text-muted">{l.name}</span>
                    {p.language === l.code && <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-iris text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>}
                  </button>
                ))}
              </div>
              <div className="mt-5 space-y-4">
                <Field label="Daily call time"><input type="time" className={field} value={p.callTime} onChange={(e) => set("callTime", e.target.value)} /></Field>
                <Field label="Custom greeting" hint="Optional. The first thing they hear each day.">
                  <input className={field} placeholder={`e.g. Namaste ${p.callName || "Mummy-ji"}, ${childName || "Riya"} ki taraf se pranaam!`} value={p.greeting} onChange={(e) => set("greeting", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-[26px] font-bold text-ink">Which medicines should we ask about?</h2>
              <p className="mb-4 mt-1 text-[15px] text-muted">Tap to add, then pick when. Use the words {p.callName || "your parent"} uses. You can skip this.</p>
              <MedicineEditor value={p.medicines} onChange={(m) => set("medicines", m)} />
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="text-[26px] font-bold text-ink">All set, {childName}.</h2>
              <p className="mt-1 text-[15px] text-muted">Each parent gets their own call, in their own language.</p>
              <ul className="mt-5 space-y-2.5">
                {parents.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 rounded-2xl border border-line bg-cream/60 p-3">
                    <Avatar parent={x} className="h-12 w-12" textClass="text-base" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[17px] font-semibold text-ink">{x.callName}</p>
                      <p className="truncate text-[14px] text-muted">
                        {LANGUAGES.find((l) => l.code === x.language)?.name} · {x.callTime} · {x.medicines.length} medicine{x.medicines.length === 1 ? "" : "s"}{x.phone ? "" : " · no phone yet"}
                      </p>
                    </div>
                    <Check className="h-5 w-5 shrink-0 text-leaf" />
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-3">
                <button onClick={() => finish("/call")} className="flex items-center justify-center gap-2 rounded-2xl bg-leaf px-6 py-4 text-[17px] font-semibold text-white">
                  <PhoneCall className="h-5 w-5" /> Try {parents[0]?.callName}&apos;s first call
                </button>
                {parents.length < 4 && (
                  <button onClick={addAnother} className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-6 py-4 text-[16px] font-semibold text-ink">
                    <UserPlus className="h-5 w-5" /> Add {parents.length === 1 ? "your other parent" : "another person"}
                  </button>
                )}
                <button onClick={() => finish("/")} className="py-2 text-[15px] font-medium text-muted">Go to my dashboard</button>
              </div>
            </>
          )}

          {step > 0 && step < 5 && (
            <div className="mt-8 flex gap-3">
              <button type="button" onClick={() => setStep(step === 2 && parents.length ? 5 : step - 1)} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-line bg-white text-ink" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
              <button
                type="button"
                disabled={!canNext[step]}
                onClick={() => (step === 4 ? commitParent() : setStep(step + 1))}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-navy px-6 py-4 text-[17px] font-semibold text-white disabled:opacity-40"
              >
                {step === 4 ? "Save parent" : "Next"} <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
