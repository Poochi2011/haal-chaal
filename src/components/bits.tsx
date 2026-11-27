"use client";

import { Check, CircleHelp, Minus, X } from "lucide-react";
import type { CallRecord, Family, FamilyAlert } from "@/lib/types";

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

export function medsStatus(family: Family, rec?: CallRecord): string | undefined {
  if (!rec?.summary) return undefined;
  const vals = family.medicines.map((m) => rec.summary!.meds[m.id]);
  if (!vals.length) return "yes";
  if (vals.every((v) => v === "yes")) return "yes";
  if (vals.some((v) => v === "no")) return "no";
  return "unclear";
}

export function Portrait({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/parent.jpg" onError={(e) => ((e.currentTarget.src = "/parents.jpg"))} alt="" className={`rounded-full object-cover ${className}`} />
  );
}

/** Soft sunrise-over-hills backdrop drawn in SVG (no image download needed). */
export function SunriseHills({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 260" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fbeee3" />
          <stop offset="0.55" stopColor="#fbe3cf" />
          <stop offset="1" stopColor="#f8d2b0" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.4" stopColor="#fff1d6" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe2bd" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="260" fill="url(#sky)" />
      <circle cx="640" cy="130" r="90" fill="url(#sun)" />
      <circle cx="640" cy="130" r="20" fill="#fff7ea" />
      <path d="M260 190 C360 120 430 110 520 150 S680 100 800 135 V260 H260Z" fill="#cdb6b4" opacity="0.55" />
      <path d="M200 225 C320 170 430 185 540 200 S700 160 800 180 V260 H200Z" fill="#a8a28f" opacity="0.6" />
      <path d="M300 250 C420 215 520 228 620 236 S740 212 800 222 V260 H300Z" fill="#7f8a6a" opacity="0.7" />
    </svg>
  );
}
