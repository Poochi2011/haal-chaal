"use client";

import { Moon, Pill, Smile, TrendingDown, Utensils } from "lucide-react";
import { Mark, ParentSwitcher } from "@/components/bits";
import { computeTrends } from "@/lib/insights";
import { isoDay } from "@/lib/seed";
import { useFamily } from "@/lib/useFamily";

export default function HealthPage() {
  const { household, parent: family, calls } = useFamily();
  if (!family || !household) return null;
  const days = Array.from({ length: 7 }, (_, i) => isoDay(i - 6));
  const byDate = new Map(calls.map((c) => [c.date, c]));
  const trends = computeTrends(calls);

  const rows: { label: string; icon: typeof Pill; get: (d: string) => string | undefined }[] = [
    ...family.medicines.map((m) => ({ label: m.name, icon: Pill, get: (d: string) => byDate.get(d)?.summary?.meds[m.id] })),
    { label: "Meals", icon: Utensils, get: (d) => byDate.get(d)?.summary?.ate },
    { label: "Sleep", icon: Moon, get: (d) => byDate.get(d)?.summary?.slept },
    { label: "Mood", icon: Smile, get: (d) => byDate.get(d)?.summary?.mood },
  ];

  const taken = [...calls].sort((a, b) => a.date.localeCompare(b.date)).slice(-7).flatMap((c) => Object.values(c.summary?.meds ?? {}));
  const pct = taken.length ? Math.round((taken.filter((v) => v === "yes").length / taken.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <header className="rise">
        <h1 className="text-[30px] font-bold tracking-tight text-ink sm:text-[38px]">Health this week</h1>
        <p className="mt-1 text-[17px] text-ink-2">Slow changes that a quick phone call can miss.</p>
      </header>
      <ParentSwitcher household={household} active={family} />

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rise rise-1 card p-5">
          <p className="text-[15px] text-muted">Medicines taken, last 7 calls</p>
          <p className="mt-1 text-[44px] font-bold leading-none tracking-tight text-ink">{taken.length ? `${pct}%` : "–"}</p>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-cream-2"><div className="h-full rounded-full bg-leaf" style={{ width: `${pct}%` }} /></div>
        </section>
        <section className="rise rise-2 rounded-[22px] border border-amber/20 bg-peach p-5">
          <p className="flex items-center gap-2 text-[17px] font-bold text-ink"><TrendingDown className="h-5 w-5 text-amber" /> Changes we noticed</p>
          {trends.length ? (
            <ul className="mt-2 space-y-1.5 text-[16px] text-ink-2">{trends.map((t) => <li key={t}>• {t}</li>)}</ul>
          ) : (
            <p className="mt-2 text-[16px] text-ink-2">Nothing worrying this week.</p>
          )}
        </section>
      </div>

      <section className="rise rise-3 card overflow-x-auto p-4 sm:p-6">
        <table className="w-full min-w-[560px] border-separate border-spacing-y-2 text-left">
          <thead>
            <tr className="text-[13px] font-semibold text-muted">
              <th className="w-44 pb-1 font-semibold">Last 7 days</th>
              {days.map((d) => (
                <th key={d} className="pb-1 text-center font-semibold">
                  {new Date(d + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short" })}
                  <span className="block text-[12px] font-normal">{Number(d.slice(8))}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, icon: Icon, get }) => (
              <tr key={label}>
                <td className="flex items-center gap-2 py-1 text-[15px] font-semibold text-ink"><Icon className="h-4.5 w-4.5" /> {label}</td>
                {days.map((d) => (
                  <td key={d} className="text-center">
                    {byDate.get(d)?.status === "no_answer" ? <span className="text-[12px] text-alarm">missed</span> : byDate.has(d) ? <Mark v={get(d)} size={26} /> : <span className="text-muted">·</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
