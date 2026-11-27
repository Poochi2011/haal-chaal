"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRight, CalendarDays, ChevronRight, Moon, Pause, Phone, PhoneCall,
  Pill, Play, Send, Smile, Sparkles, TrendingDown, Utensils,
} from "lucide-react";
import { Avatar, Mark, medsStatus, overallStatus, ParentSwitcher, StatusPill, SunriseHills } from "@/components/bits";
import { computeAlerts, computeTrends, prettyDate } from "@/lib/insights";
import { speak, stopSpeaking } from "@/lib/speech";
import { saveParent } from "@/lib/store";
import { isoDay } from "@/lib/seed";
import { useFamily } from "@/lib/useFamily";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function HomePage() {
  const { household, parent, calls } = useFamily();
  const [playing, setPlaying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }));
  }, []);
  useEffect(() => { setMsg(null); stopSpeaking(); setPlaying(false); }, [parent?.id]);
  if (!household || !parent) return <div className="h-[60vh]" />;

  const sorted = [...calls].sort((a, b) => b.date.localeCompare(a.date));
  const last = sorted[0];
  const isToday = last?.date === isoDay(0);
  const alerts = computeAlerts(parent, calls);
  const trends = computeTrends(calls);
  const status = overallStatus(alerts, trends, last);
  const s = last?.summary;
  const message = msg ?? parent.message;

  const listen = async () => {
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    if (!s) return;
    setPlaying(true);
    await speak(`${s.summary} ${s.highlight}`, "en-IN", 1);
    setPlaying(false);
  };

  const checks = [
    { label: "Medicines", icon: Pill, v: medsStatus(parent, last) },
    { label: "Meals", icon: Utensils, v: s?.ate },
    { label: "Sleep", icon: Moon, v: s?.slept },
    { label: "Mood", icon: Smile, v: s?.mood },
  ];

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Greeting */}
      <section className="rise flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="hidden text-[13px] font-semibold uppercase tracking-[0.18em] text-muted sm:block">AI care companion for your parents</p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[40px]">
            {greeting()}, {household.childName || "there"}
          </h1>
          <p className="mt-1 text-[17px] text-ink-2 sm:text-[19px]">Here&apos;s how {household.parents.length > 1 ? "your parents are" : `${parent.callName} is`} doing.</p>
        </div>
        {today && (
          <div className="hidden items-center gap-2.5 rounded-full border border-line bg-white px-5 py-3 text-[15px] font-medium text-ink sm:flex">
            <CalendarDays className="h-5 w-5" /> {today}
          </div>
        )}
      </section>

      <div className="rise"><ParentSwitcher household={household} active={parent} /></div>

      {/* Hero */}
      <section className="rise rise-1 relative overflow-hidden rounded-[26px] border border-line shadow-[var(--shadow-card)]">
        <SunriseHills className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#fbf3ea]/85 via-[#fbf3ea]/35 to-transparent" />
        <div className="relative flex items-center gap-4 p-4 sm:gap-8 sm:p-7">
          <div className="relative shrink-0">
            <Avatar parent={parent} className="h-24 w-24 border-4 border-white/85 shadow-md sm:h-40 sm:w-40" textClass="text-3xl sm:text-5xl" />
            {status !== "none" && (
              <span className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-[3px] border-white sm:bottom-3 sm:right-3 sm:h-6 sm:w-6 ${status === "urgent" ? "bg-alarm" : status === "attention" ? "bg-amber" : "bg-leaf"}`} />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[38px]">{parent.callName}</h2>
            <p className="mb-3 truncate text-[14px] text-ink-2 sm:text-[16px]">{[parent.name, parent.city].filter(Boolean).join(" · ")}</p>
            <StatusPill status={status} />
          </div>
        </div>
      </section>

      {alerts.length > 0 && (
        <section className="rise rise-2 space-y-3">
          {alerts.map((a) => (
            <div key={a.title} className={`flex items-start gap-3.5 rounded-[22px] border p-4 sm:gap-4 sm:p-5 ${a.level === "red" ? "border-alarm/25 bg-alarm-soft" : "border-amber/20 bg-peach"}`}>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full sm:h-12 sm:w-12 ${a.level === "red" ? "bg-white text-alarm" : "bg-peach-2 text-amber"}`}>
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold text-ink sm:text-[17px]">{a.title}</p>
                <p className="mt-0.5 text-[15px] leading-relaxed text-ink-2">{a.detail}</p>
                {a.level === "red" && parent.phone && (
                  <a href={`tel:${parent.phone}`} className="mt-3 inline-flex items-center gap-2 rounded-full bg-alarm px-4 py-2.5 text-sm font-semibold text-white">
                    <Phone className="h-4 w-4" /> Call {parent.callName} yourself
                  </a>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr] lg:gap-6">
        <section className="rise rise-2 min-w-0 rounded-[22px] border border-lav-2 bg-lav p-5 shadow-[var(--shadow-card)] sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <h3 className="flex items-center gap-3 text-[20px] font-bold text-ink sm:text-[24px]">
              <Sparkles className="h-6 w-6 shrink-0 text-iris" />
              {isToday ? "Today's summary" : last ? `Latest summary · ${prettyDate(last.date)}` : "No calls yet"}
            </h3>
            <span className="hidden shrink-0 rounded-full bg-lav-2 px-3 py-1 text-[13px] font-semibold text-iris sm:inline">AI summary</span>
          </div>
          {s ? (
            <>
              <p className="mt-3 text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">{s.summary}</p>
              {s.highlight && <p className="mt-3 rounded-2xl bg-white/60 px-4 py-3 text-[15px] italic text-ink-2">“{s.highlight}”</p>}
              <button onClick={listen} className="mt-5 flex w-full items-center gap-4 rounded-full bg-white/70 py-2 pl-2 pr-5 text-left transition hover:bg-white" aria-label={playing ? "Stop reading summary" : "Listen to summary"}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lav-2 text-ink">
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-px" fill="currentColor" />}
                </span>
                <span className="flex h-6 min-w-0 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
                  {Array.from({ length: 42 }).map((_, i) => (
                    <span key={i} className={`w-[3px] shrink-0 rounded-full bg-iris/50 ${playing ? "wave-bar" : ""}`} style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${(i % 7) * 0.08}s` }} />
                  ))}
                </span>
                <span className="shrink-0 text-[14px] font-medium text-muted">{playing ? "Stop" : "Listen"}</span>
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-[17px] text-ink-2">After {parent.callName}&apos;s first call, a short summary appears here.</p>
              <Link href="/call" className="mt-5 inline-flex items-center gap-2 rounded-full bg-leaf px-5 py-3 text-[15px] font-semibold text-white shadow-sm">
                <PhoneCall className="h-4 w-4" /> Start {parent.callName}&apos;s first call
              </Link>
            </>
          )}
        </section>

        <section className="rise rise-3 grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-1 lg:content-start lg:gap-0 lg:rounded-[22px] lg:border lg:border-line lg:bg-[#fffdfb] lg:p-3 lg:shadow-[var(--shadow-card)]">
          {checks.map(({ label, icon: Icon, v }) => (
            <div key={label} className="card flex min-w-0 items-center gap-2.5 p-3.5 sm:gap-3 sm:p-4 lg:rounded-none lg:border-0 lg:border-b lg:border-line lg:bg-transparent lg:shadow-none lg:last:border-0">
              <Icon className="h-5 w-5 shrink-0 text-ink sm:h-6 sm:w-6" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink sm:text-[17px]">{label}</span>
              <Mark v={v} />
            </div>
          ))}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <section className="rise rise-3 flex min-w-0 flex-wrap items-center gap-4 rounded-[22px] border border-lav-2 bg-[#f7f4fd] p-4 shadow-[var(--shadow-card)] sm:flex-nowrap sm:p-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-lav-2 text-ink"><Phone className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-bold text-ink">{isToday ? "Today's call" : "Today's call is due"}</p>
            <p className="text-[15px] text-muted">
              {isToday && last
                ? `${Math.max(1, Math.round(last.durationSec / 60))} min · ${last.status === "completed" ? "completed" : last.status === "no_answer" ? "no answer" : "emergency"}`
                : `Scheduled for ${parent.callTime}`}
            </p>
          </div>
          {isToday ? (
            <Link href="/calls" className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-[14px] font-semibold text-ink">
              Details <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link href="/call" className="flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-leaf px-4 py-3 text-[15px] font-semibold text-white shadow-sm sm:w-auto sm:py-2.5 sm:text-[14px]">
              <PhoneCall className="h-4 w-4" /> Start the call now
            </Link>
          )}
        </section>

        <Link href="/health" className="rise rise-3 flex min-w-0 items-center gap-4 rounded-[22px] border border-line bg-[#fffdfb] p-4 shadow-[var(--shadow-card)] sm:p-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-peach text-amber"><TrendingDown className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-bold text-ink">This week</p>
            <p className="text-[15px] text-muted">{trends[0] ?? "No worrying changes this week."}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
        </Link>
      </div>

      <section className="rise rise-4 card p-5 sm:p-6">
        <p className="text-[18px] font-bold text-ink">Message for {parent.callName}&apos;s next call</p>
        <p className="mt-0.5 text-[15px] text-muted">Read out near the end of the call, in their language.</p>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => { e.preventDefault(); saveParent({ ...parent, message: message.trim() }); setMsg(null); }}
        >
          <input
            value={message}
            onChange={(e) => setMsg(e.target.value)}
            placeholder={`e.g. ${household.childName || "I"} will visit on Sunday`}
            aria-label="Message for the next call"
            className="min-w-0 flex-1 rounded-2xl border border-line bg-cream px-4 py-3.5 text-[16px] text-ink outline-none focus:border-iris"
          />
          <button className="flex items-center justify-center gap-2 rounded-2xl bg-navy px-6 py-3.5 text-[15px] font-semibold text-white disabled:opacity-50" disabled={msg === null || msg === parent.message}>
            <Send className="h-4 w-4" /> {msg === null || msg === parent.message ? "Saved" : "Save message"}
          </button>
        </form>
      </section>
    </div>
  );
}
