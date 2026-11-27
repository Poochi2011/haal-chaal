"use client";

import { useState } from "react";
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
  const update = (id: string, patch: Partial<Medicine>) => onChange(value.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const toggleTime = (m: Medicine, t: DoseTime) => {
    const has = m.times.includes(t);
    const times = has ? m.times.filter((x) => x !== t) : [...m.times, t];
    update(m.id, { times: TIMES.map((x) => x.t).filter((x) => times.includes(x)) });
  };
  const used = new Set(value.map((m) => m.name.toLowerCase()));

  return (
    <div>
      <div className="space-y-3">
        {value.map((m) => (
          <div key={m.id} className="rounded-2xl border border-line bg-cream/70 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <input
                value={m.name}
                onChange={(e) => update(m.id, { name: e.target.value })}
                placeholder="Medicine name, as your parent says it"
                aria-label="Medicine name"
                className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 py-3 text-[16px] font-semibold text-ink outline-none focus:border-iris"
              />
              <button type="button" aria-label={`Remove ${m.name || "medicine"}`} onClick={() => onChange(value.filter((x) => x.id !== m.id))} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-muted hover:bg-alarm-soft hover:text-alarm">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {TIMES.map(({ t, label, icon: Icon }) => {
                const on = m.times.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTime(m, t)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[14px] font-semibold transition ${on ? "border-iris bg-iris text-white" : "border-line bg-white text-ink-2 hover:border-iris/40"}`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                );
              })}
              {!noteOpen[m.id] && !m.note ? (
                <button type="button" onClick={() => setNoteOpen({ ...noteOpen, [m.id]: true })} className="px-2 py-2 text-[14px] font-medium text-iris">
                  + Note
                </button>
              ) : null}
            </div>
            {(noteOpen[m.id] || m.note) && (
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  autoFocus={noteOpen[m.id] && !m.note}
                  value={m.note ?? ""}
                  onChange={(e) => update(m.id, { note: e.target.value })}
                  placeholder="e.g. after food, half tablet"
                  aria-label="Note"
                  className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-iris"
                />
                <button type="button" aria-label="Remove note" onClick={() => { update(m.id, { note: "" }); setNoteOpen({ ...noteOpen, [m.id]: false }); }} className="grid h-10 w-10 place-items-center rounded-xl text-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {m.times.length === 0 && <p className="mt-2 text-[13px] text-amber">Pick at least one time, so the call knows when to ask.</p>}
          </div>
        ))}
      </div>

      <p className="mb-2 mt-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">Quick add</p>
      <div className="flex flex-wrap gap-2">
        {QUICK.filter((q) => !used.has(q.name.toLowerCase())).map((q) => (
          <button key={q.name} type="button" onClick={() => onChange([...value, { ...q, id: newId() }])} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-[14px] font-medium text-ink hover:border-iris/50">
            <Plus className="h-3.5 w-3.5" /> {q.name}
          </button>
        ))}
        <button type="button" onClick={() => onChange([...value, { id: newId(), name: "", times: ["morning"] }])} className="flex items-center gap-1.5 rounded-full border border-dashed border-iris/50 bg-lav px-3.5 py-2 text-[14px] font-semibold text-iris">
          <Plus className="h-3.5 w-3.5" /> Other medicine
        </button>
      </div>
    </div>
  );
}

/** Drops empty rows and rows with no time before saving. */
export function cleanMedicines(m: Medicine[]): Medicine[] {
  return m.filter((x) => x.name.trim()).map((x) => ({ ...x, name: x.name.trim(), times: x.times.length ? x.times : ["morning"], note: x.note?.trim() || undefined }));
}
