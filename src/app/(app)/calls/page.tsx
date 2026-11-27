"use client";

import { useState } from "react";
import { ChevronDown, Phone, PhoneMissed, Siren } from "lucide-react";
import { Mark, medsStatus, ParentSwitcher } from "@/components/bits";
import { prettyDate } from "@/lib/insights";
import { useFamily } from "@/lib/useFamily";

export default function CallsPage() {
  const { household, parent: family, calls } = useFamily();
  const [open, setOpen] = useState<string | null>(null);
  if (!family || !household) return null;
  const list = [...calls].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      <header className="rise">
        <h1 className="text-[30px] font-bold tracking-tight text-ink sm:text-[38px]">Call history</h1>
        <p className="mt-1 text-[17px] text-ink-2">Every evening call with {family.callName}, with what was said.</p>
      </header>
      <ParentSwitcher household={household} active={family} />

      <div className="space-y-3">
        {list.length === 0 && <p className="card p-6 text-[16px] text-ink-2">No calls with {family.callName} yet. Start one from the green Call button.</p>}
        {list.map((c, i) => {
          const isOpen = open === c.id;
          const Icon = c.status === "no_answer" ? PhoneMissed : c.status === "emergency" ? Siren : Phone;
          const tone = c.status === "completed" ? "bg-lav-2 text-ink" : "bg-alarm-soft text-alarm";
          return (
            <article key={c.id} className={`rise card overflow-hidden ${i < 4 ? `rise-${i + 1}` : ""}`}>
              <button onClick={() => setOpen(isOpen ? null : c.id)} className="flex w-full items-center gap-4 p-4 text-left sm:p-5">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${tone}`}><Icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[17px] font-bold text-ink">{prettyDate(c.date)}<span className="rounded-full bg-cream-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{c.via === "phone" ? "Phone" : "Browser"}</span></p>
                  <p className="truncate text-[15px] text-muted">
                    {c.status === "no_answer" ? "No answer" : c.summary?.summary ?? "Completed"}
                  </p>
                </div>
                <div className="hidden items-center gap-1.5 sm:flex">
                  <Mark v={medsStatus(family, c)} size={24} />
                  <Mark v={c.summary?.ate} size={24} />
                  <Mark v={c.summary?.mood} size={24} />
                </div>
                <ChevronDown className={`h-5 w-5 shrink-0 text-muted transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-line bg-cream/60 p-4 sm:p-6">
                  {c.summary && (
                    <div className="mb-4 grid gap-2 text-[15px] sm:grid-cols-2">
                      {family.medicines.map((m) => (
                        <p key={m.id} className="flex items-center gap-2"><Mark v={c.summary!.meds[m.id]} size={22} /> {m.name}</p>
                      ))}
                      <p className="flex items-center gap-2"><Mark v={c.summary.ate} size={22} /> Ate: {c.summary.ate}</p>
                      <p className="flex items-center gap-2"><Mark v={c.summary.slept} size={22} /> Slept well: {c.summary.slept}</p>
                      <p className="flex items-center gap-2"><Mark v={c.summary.mood} size={22} /> Mood: {c.summary.mood}</p>
                      {c.summary.complaints.length > 0 && <p className="sm:col-span-2">Mentioned: {c.summary.complaints.join(", ")}</p>}
                    </div>
                  )}
                  <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">Transcript</p>
                  <div className="space-y-2">
                    {c.transcript.map((t, j) => (
                      <p key={j} className={`text-[16px] leading-relaxed ${t.role === "ai" ? "text-ink-2" : "font-medium text-ink"}`}>
                        <span className="mr-2 text-[13px] font-semibold text-muted">{t.role === "ai" ? "Haal-Chaal" : family.callName}</span>
                        {t.text === "[silence]" ? "(no answer)" : t.text.replace(/^\[unclear\]\s*/, "")}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
