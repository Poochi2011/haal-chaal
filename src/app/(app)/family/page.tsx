"use client";

import { useEffect, useState } from "react";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { LANGUAGES } from "@/lib/languages";
import { resetDemo, saveFamily } from "@/lib/store";
import type { Family } from "@/lib/types";
import { useFamily } from "@/lib/useFamily";

const field = "w-full rounded-2xl border border-line bg-cream px-4 py-3.5 text-[16px] text-ink outline-none focus:border-iris";

export default function FamilyPage() {
  const { family } = useFamily();
  const [f, setF] = useState<Family | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (family && !f) setF(family); }, [family, f]);
  if (!f) return null;

  const set = <K extends keyof Family>(k: K, v: Family[K]) => { setF({ ...f, [k]: v }); setSaved(false); };
  const Label = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
    <span className="mb-1.5 block text-[15px] font-semibold text-ink">{children}{hint && <span className="ml-2 font-normal text-muted">{hint}</span>}</span>
  );

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => { e.preventDefault(); saveFamily({ ...f, medicines: f.medicines.filter((m) => m.name.trim()) }); setSaved(true); }}
    >
      <header className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight text-ink sm:text-[38px]">Family setup</h1>
          <p className="mt-1 text-[17px] text-ink-2">Tell Haal-Chaal who to call and what to ask about.</p>
        </div>
        <button type="button" onClick={() => { resetDemo(); location.reload(); }} className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-[14px] font-medium text-ink">
          <RotateCcw className="h-4 w-4" /> Reset sample family
        </button>
      </header>

      <section className="rise rise-1 card grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <label><Label>Parent&apos;s name</Label><input className={field} value={f.parentName} onChange={(e) => set("parentName", e.target.value)} /></label>
        <label><Label hint="how the call greets them">Call them</Label><input className={field} value={f.callName} onChange={(e) => set("callName", e.target.value)} /></label>
        <label><Label>City</Label><input className={field} value={f.city} onChange={(e) => set("city", e.target.value)} /></label>
        <label><Label>Your name</Label><input className={field} value={f.childName} onChange={(e) => set("childName", e.target.value)} /></label>
        <label>
          <Label>Language</Label>
          <select className={field} value={f.language} onChange={(e) => set("language", e.target.value as Family["language"])}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native} · {l.name}</option>)}
          </select>
        </label>
        <label><Label>Daily call time</Label><input type="time" className={field} value={f.callTime} onChange={(e) => set("callTime", e.target.value)} /></label>
      </section>

      <section className="rise rise-2 card p-5 sm:p-6">
        <Label hint="use the words your parent uses">Medicines</Label>
        <div className="space-y-2.5">
          {f.medicines.map((m, i) => (
            <div key={m.id} className="flex gap-2">
              <input className={field} placeholder="e.g. BP ki goli" value={m.name} onChange={(e) => set("medicines", f.medicines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <select className={`${field} w-36 shrink-0`} value={m.time} onChange={(e) => set("medicines", f.medicines.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))}>
                <option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="night">Night</option>
              </select>
              <button type="button" aria-label="Remove" onClick={() => set("medicines", f.medicines.filter((_, j) => j !== i))} className="grid w-12 shrink-0 place-items-center rounded-2xl border border-line text-muted hover:text-alarm"><Trash2 className="h-4.5 w-4.5" /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => set("medicines", [...f.medicines, { id: `m${Date.now()}`, name: "", time: "morning" }])} className="mt-3 flex items-center gap-2 text-[15px] font-semibold text-iris">
          <Plus className="h-4 w-4" /> Add medicine
        </button>
      </section>

      <section className="rise rise-3 card grid gap-4 p-5 sm:p-6">
        <label><Label hint="private, helps the call follow up">Health notes</Label><textarea rows={3} className={field} value={f.healthNotes} onChange={(e) => set("healthNotes", e.target.value)} /></label>
        <label><Label hint="read out once, in their language">Message for the next call</Label><input className={field} value={f.message} onChange={(e) => set("message", e.target.value)} /></label>
      </section>

      <div className="sticky bottom-24 z-10 lg:bottom-6">
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-navy px-6 py-4 text-[16px] font-semibold text-white shadow-lg sm:w-auto">
          <Save className="h-5 w-5" /> {saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
