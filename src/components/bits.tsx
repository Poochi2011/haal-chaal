"use client";

import Link from "next/link";
import { Check, CircleHelp, Minus, Plus, X } from "lucide-react";
import { setActiveId } from "@/lib/store";
import type { CallRecord, FamilyAlert, Household, Parent } from "@/lib/types";

export type Status = "well" | "attention" | "urgent" | "none";

export function overallStatus(alerts: FamilyAlert[], trends: string[], last?: CallRecord): Status {
  if (!last) return "none";
  if (alerts.some((a) => a.level === "red")) return "urgent";
  if (alerts.length || trends.length) return "attention";
  return "well";
}

const STATUS = {
  well: { label: "Doing well", cls: "bg-leaf-soft text-ink", dot: "bg-leaf", icon: Check },
  attention: { label: "Keep an eye", cls: "bg-peach-2 text-ink", dot: "bg-amber", icon: Minus },
  urgent: { label: "Needs you now", cls: "bg-alarm-soft text-alarm", dot: "bg-alarm", icon: X },
  none: { label: "No calls yet", cls: "bg-white text-muted", dot: "bg-muted", icon: CircleHelp },
};

export function StatusPill({ status, size = "lg" }: { status: Status; size?: "lg" | "sm" }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-2.5 rounded-full font-semibold ${s.cls} ${size === "lg" ? "px-4 py-2.5 text-[17px] sm:text-[20px]" : "px-3 py-1 text-sm"}`}>
      <span className={`grid place-items-center rounded-full text-white ${s.dot} ${size === "lg" ? "h-7 w-7" : "h-5 w-5"}`}>
        <Icon className={size === "lg" ? "h-4 w-4" : "h-3 w-3"} strokeWidth={3} />
      </span>
      {s.label}
    </span>
  );
}

/** Tick / cross / question badge for yes-no facts. */
export function Mark({ v, size = 28 }: { v: string | undefined; size?: number }) {
  const good = v === "yes" || v === "good";
  const mid = v === "partly" || v === "okay";
  const bad = v === "no" || v === "low";
  const cls = good ? "bg-leaf-soft text-leaf" : bad ? "bg-alarm-soft text-alarm" : mid ? "bg-peach-2 text-amber" : "bg-cream-2 text-muted";
  const Icon = good ? Check : bad ? X : mid ? Minus : CircleHelp;
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-full ${cls}`} style={{ width: size, height: size }} title={v ?? "no data"}>
      <Icon style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={3} />
    </span>
  );
}

export function medsStatus(family: Parent, rec?: CallRecord): string | undefined {
  if (!rec?.summary) return undefined;
  const vals = family.medicines.map((m) => rec.summary!.meds[m.id]);
  if (!vals.length) return "yes";
  if (vals.every((v) => v === "yes")) return "yes";
  if (vals.some((v) => v === "no")) return "no";
  return "unclear";
}

const AVATAR_TINTS = ["bg-peach-2 text-amber", "bg-lav-2 text-iris", "bg-leaf-soft text-leaf", "bg-alarm-soft text-alarm"];

/** Parent photo, or their initials on a soft tint. */
export function Avatar({ parent, className = "", textClass = "text-xl" }: { parent: Parent; className?: string; textClass?: string }) {
  if (parent.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={parent.photo} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />;
  }
  const initials = (parent.callName || parent.name || "?").replace(/-ji$/i, "").trim().slice(0, 2).toUpperCase();
  const tint = AVATAR_TINTS[[...parent.id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length];
  return <span className={`grid shrink-0 place-items-center rounded-full font-bold ${tint} ${textClass} ${className}`}>{initials}</span>;
}

/** Pills to switch between parents, plus "add parent". */
export function ParentSwitcher({ household, active }: { household: Household; active: Parent }) {
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Choose parent">
      {household.parents.map((p) => {
        const on = p.id === active.id;
        return (
          <button
            key={p.id}
            role="tab"
            aria-selected={on}
            onClick={() => setActiveId(p.id)}
            className={`flex shrink-0 items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 text-[15px] font-semibold transition ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-lav-2"}`}
          >
            <Avatar parent={p} className="h-8 w-8" textClass="text-[12px]" />
            {p.callName || p.name}
          </button>
        );
      })}
      <Link href="/family?new=1" className="flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-muted/40 px-4 py-2 text-[14px] font-medium text-muted hover:text-ink">
        <Plus className="h-4 w-4" /> Add parent
      </Link>
    </div>
  );
}

/** Sunrise-over-hills backdrop (generated in ChatGPT, see README). */
export function SunriseHills({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/hero.jpg" alt="" aria-hidden className={`object-cover object-[70%_60%] ${className}`} />
  );
}
