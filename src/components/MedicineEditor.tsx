"use client";

import { useRef, useState } from "react";
import { Moon, Plus, Sun, Sunrise, Trash2, X } from "lucide-react";
import type { DoseTime, Medicine } from "@/lib/types";

const TIMES: { t: DoseTime; label: string; icon: typeof Sun }[] = [
  { t: "morning", label: "Morning", icon: Sunrise },
  { t: "afternoon", label: "Afternoon", icon: Sun },
  { t: "night", label: "Night", icon: Moon },
];

/** One tap adds a common medicine with sensible timings; everything stays editable. */
const QUICK: Omit<Medicine, "id">[] = [
  { name: "BP ki goli", times: ["morning"] },
  { name: "Sugar ki goli", times: ["morning", "night"], note: "after food" },
  { name: "Thyroid ki goli", times: ["morning"], note: "empty stomach" },
  { name: "Dil ki dawai", times: ["night"] },
  { name: "Cholesterol ki goli", times: ["night"] },
  { name: "Calcium / Vitamin", times: ["afternoon"] },
  { name: "Insulin", times: ["morning", "night"] },
];

const newId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function MedicineEditor({ value, onChange }: { value: Medicine[]; onChange: (m: Medicine[]) => void }) {
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const update = (id: string, patch: Partial<Medicine>) => onChange(value.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const toggleTime = (m: Medicine, t: DoseTime) => {
    const times = m.times.includes(t) ? m.times.filter((x) => x !== t) : [...m.times, t];
    update(m.id, { times: TIMES.map((x) => x.t).filter((x) => times.includes(x)) });
  };
  const addCustom = () => {
    const id = newId();
    onChange([...value, { id, name: "", times: ["morning"] }]);
    setFocusId(id);
    setTimeout(() => listEnd.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };
  const used = new Set(value.map((m) => m.name.toLowerCase()));
  const quick = QUICK.filter((q) => !used.has(q.name.toLowerCase()));

  return (
    <div>
      {value.length === 0 && (
        <p className="mb-3 rounded-2xl border border-dashed border-line bg-cream/60 px-4 py-3 text-[15px] text-muted">No medicines yet. Add one below.</p>
      )}

      <div className="space-y-3">
        {value.map((m, i) => (
          <div key={m.id} className="rounded-2xl border border-line bg-cream/70 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-lav-2 text-[13px] font-bold text-iris">{i + 1}</span>
              <input
                autoFocus={focusId === m.id}
                value={m.name}
                onChange={(e) => update(m.id, { name: e.target.value })}
                placeholder="e.g. BP ki goli"
                aria-label="Medicine name"
                className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 py-3 text-[16px] font-semibold text-ink outline-none focus:border-iris"
              />
              <button type="button" aria-label={`Remove ${m.name || "medicine"}`} onClick={() => onChange(value.filter((x) => x.id !== m.id))} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-alarm-soft hover:text-alarm">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-1.5" role="group" aria-label="When to take it">
              {TIMES.map(({ t, label, icon: Icon }) => {
                const on = m.times.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTime(m, t)}
                    className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-1 py-2.5 text-[13px] font-semibold transition sm:text-[14px] ${on ? "border-iris bg-iris text-white" : "border-line bg-white text-ink-2 hover:border-iris/40"}`}
                  >
                    <Icon className="hidden h-4 w-4 shrink-0 sm:block" /> <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {noteOpen[m.id] || m.note ? (
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  autoFocus={noteOpen[m.id] && !m.note}
                  value={m.note ?? ""}
                  onChange={(e) => update(m.id, { note: e.target.value })}
                  placeholder="e.g. after food"
                  aria-label="Note"
                  className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-iris"
                />
                <button type="button" aria-label="Remove note" onClick={() => { update(m.id, { note: "" }); setNoteOpen({ ...noteOpen, [m.id]: false }); }} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setNoteOpen({ ...noteOpen, [m.id]: true })} className="mt-2 px-1 py-1 text-[14px] font-medium text-iris">
                + Add a note (e.g. after food)
              </button>
            )}
            {m.times.length === 0 && <p className="mt-2 text-[13px] text-amber">Pick at least one time, so the call knows when to ask.</p>}
          </div>
        ))}
        <div ref={listEnd} />
      </div>

      <button
        type="button"
        onClick={addCustom}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-iris/60 bg-lav px-4 py-4 text-[16px] font-semibold text-iris transition hover:bg-lav-2"
      >
        <Plus className="h-5 w-5" /> Add a medicine
      </button>

      {quick.length > 0 && (
        <>
          <p className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">Or tap a common one</p>
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <button key={q.name} type="button" onClick={() => onChange([...value, { ...q, id: newId() }])} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-[14px] font-medium text-ink hover:border-iris/50">
                <Plus className="h-3.5 w-3.5" /> {q.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Drops empty rows and rows with no time before saving. */
export function cleanMedicines(m: Medicine[]): Medicine[] {
  return m.filter((x) => x.name.trim()).map((x) => ({ ...x, name: x.name.trim(), times: x.times.length ? x.times : ["morning"], note: x.note?.trim() || undefined }));
}
