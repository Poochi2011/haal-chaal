"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Heart, Keyboard, Mic, Monitor, Phone, PhoneOff, Send, Smartphone, Sparkles } from "lucide-react";
import { Avatar } from "@/components/bits";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { memoryNotes } from "@/lib/insights";
import { detectEmergency } from "@/lib/safety";
import { isoDay } from "@/lib/seed";
import { hasVoiceFor, listenOnce, speak, speechSupported, stopSpeaking, type ListenResult } from "@/lib/speech";
import { getActiveId, loadCalls, loadHousehold, saveCall, saveParent, setActiveId } from "@/lib/store";
import { callFamilyAboutEmergency, getPin, setPin as storePin } from "@/lib/alert";
import type { CallRecord, CallSummary, Household, Parent, Turn, TurnReply } from "@/lib/types";

type Phase = "ringing" | "thinking" | "speaking" | "listening" | "dialing" | "live" | "saving" | "done";
type Mode = "browser" | "phone";

const PHASE_LABEL: Record<Phase, string> = {
  ringing: "Incoming call",
  thinking: "…",
  speaking: "Haal-Chaal is speaking",
  listening: "Listening…",
  dialing: "Ringing their phone…",
  live: "On the call",
  saving: "Writing the summary…",
  done: "Call ended",
};

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `${url} ${r.status}`);
  return data as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function CallPage() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [mode, setMode] = useState<Mode>("browser");
  const [phoneReady, setPhoneReady] = useState<boolean | null>(null);
  const [phoneLangs, setPhoneLangs] = useState<string[]>([]);
  const [pinRequired, setPinRequired] = useState(false);
  const [pin, setPin] = useState("");
  const [phase, setPhase] = useState<Phase>("ringing");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [live, setLive] = useState("");
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [aiMode, setAiMode] = useState<"ai" | "demo" | null>(null);
  const [noVoice, setNoVoice] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<CallRecord | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const alerted = useRef(false);

  const transcript = useRef<Turn[]>([]);
  const ended = useRef(false);
  const typedResolve = useRef<((r: ListenResult) => void) | null>(null);
  const answerResolve = useRef<((r: ListenResult) => void) | null>(null);
  const cancelListen = useRef<(() => void) | null>(null);
  const typingRef = useRef(false);
  const startedAt = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPin(getPin());
    ended.current = false; // React dev mode mounts twice; the first cleanup must not end the real call
    const h = loadHousehold();
    setHousehold(h);
    setParent(h.parents.find((p) => p.id === getActiveId()) ?? h.parents[0]);
    if (!speechSupported().listen) { typingRef.current = true; setTyping(true); }
    fetch("/api/phone/config").then((r) => r.json()).then((c) => { setPhoneReady(Boolean(c.enabled)); setPhoneLangs(c.languages ?? []); setPinRequired(Boolean(c.pinRequired)); }).catch(() => setPhoneReady(false));
    return () => { ended.current = true; stopSpeaking(); cancelListen.current?.(); };
  }, []);

  useEffect(() => {
    if (phase === "ringing" || phase === "done") return;
    const id = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => { scroller.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [turns, live]);

  if (!parent || !household) return <div className="min-h-screen bg-navy" />;
  const lang = getLanguage(parent.language);
  const langOnPhone = phoneLangs.includes(parent.language);
  const phoneAllowed = phoneReady === true && Boolean(parent.phone) && langOnPhone;

  const choose = (p: Parent) => { setParent(p); setActiveId(p.id); if (!(phoneReady && p.phone && phoneLangs.includes(p.language))) setMode("browser"); };
  const push = (t: Turn) => { transcript.current = [...transcript.current, t]; setTurns(transcript.current); };
  const context = () => {
    const calls = loadCalls().filter((c) => c.parentId === parent.id);
    const lastSummary = [...calls].sort((a, b) => b.date.localeCompare(a.date)).find((c) => c.summary)?.summary;
    return { memory: memoryNotes(calls), lastComplaint: lastSummary?.complaints.find((c) => c !== "feeling lonely") ?? null };
  };

  /** Ring the family member at once when a serious symptom comes up (only once per call). */
  const escalate = (reason: string, said?: string) => {
    if (alerted.current) return;
    alerted.current = true;
    void callFamilyAboutEmergency(household, parent, reason, said).then(setAlertMsg);
  };

  // ---------- in-browser call ----------
  const startMic = () => {
    if (!speechSupported().listen || !answerResolve.current) return;
    const l = listenOnce(lang.speech, setLive);
    cancelListen.current = l.cancel;
    l.promise.then((r) => answerResolve.current?.(r));
  };
  const getAnswer = (): Promise<ListenResult> =>
    new Promise((resolve) => {
      answerResolve.current = (r) => { answerResolve.current = null; cancelListen.current?.(); resolve(r); };
      typedResolve.current = answerResolve.current;
      if (!typingRef.current) startMic();
    });
  const toggleTyping = () => {
    const next = !typingRef.current;
    typingRef.current = next;
    setTyping(next);
    if (next) { cancelListen.current?.(); setLive(""); } else startMic();
  };

  const runBrowserCall = async () => {
    startedAt.current = Date.now();
    const { memory, lastComplaint } = context();
    const voiceOk = await hasVoiceFor(lang.speech);
    setNoVoice(!voiceOk);
    let emergency = false;

    while (!ended.current) {
      setPhase("thinking");
      let reply: TurnReply;
      try {
        reply = await post<TurnReply>("/api/turn", { parent, transcript: transcript.current, memory, lastComplaint });
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
        break;
      }
      if (ended.current) return;
      setAiMode(reply.mode);
      push({ role: "ai", text: reply.say, at: Date.now() });
      setPhase("speaking");
      if (voiceOk) await speak(reply.say, lang.speech);
      else await sleep(1200 + reply.say.length * 45);
      if (reply.emergency && !emergency) {
        const said = [...transcript.current].reverse().find((x) => x.role === "parent")?.text;
        escalate(said ? detectEmergency(said) ?? "A serious symptom" : "A serious symptom", said);
      }
      emergency ||= reply.emergency;
      if (reply.end || ended.current) break;

      setPhase("listening");
      setLive("");
      let ans = await getAnswer();
      if (ended.current) return;
      if (ans.micError) {
        setMicNote(ans.micError === "not-allowed" ? "Microphone is blocked. Allow it in the address bar, or type the answers." : `Voice input isn't available here (${ans.micError}), so please type the answers.`);
        typingRef.current = true;
        setTyping(true);
        ans = await new Promise<ListenResult>((resolve) => { typedResolve.current = resolve; });
      }
      typedResolve.current = null;
      let text = ans.text.trim();
      if (!text) text = "[silence]";
      else if (ans.confidence > 0 && ans.confidence < 0.45) text = `[unclear] ${text}`;
      setLive("");
      push({ role: "parent", text, at: Date.now() });
      const rule = detectEmergency(text);
      if (rule) { emergency = true; escalate(rule, text); }
    }
    await finish({ emergency, via: "browser" });
  };

  // ---------- real phone call (Retell) ----------
  const runPhoneCall = async () => {
    startedAt.current = Date.now();
    setPhase("dialing");
    let callId: string;
    try {
      callId = (await post<{ callId: string }>("/api/phone/start", { parent, memory: context().memory, pin })).callId;
    } catch (e) {
      setError((e as Error).message);
      setPhase("ringing");
      return;
    }
    for (let i = 0; i < 240 && !ended.current; i++) { // up to ~10 minutes
      await sleep(2500);
      try {
        const st = await fetch(`/api/phone/status?id=${encodeURIComponent(callId)}`).then((r) => r.json());
        if (st.status === "ongoing") setPhase("live");
        if (st.transcript?.length) { transcript.current = st.transcript; setTurns(st.transcript); }
        if (st.done && st.failed) {
          // The call never went through: tell the user why, and don't log a "missed call".
          ended.current = true;
          setError(`Couldn't place the call: ${st.failMessage ?? st.reason}`);
          transcript.current = [];
          setTurns([]);
          setPhase("ringing");
          return;
        }
        if (st.done) {
          await finish({ emergency: false, via: "phone", answered: Boolean(st.answered), durationSec: st.durationSec });
          return;
        }
      } catch { /* keep polling */ }
    }
  };

  const finish = async (o: { emergency: boolean; via: "browser" | "phone"; declined?: boolean; answered?: boolean; durationSec?: number }) => {
    ended.current = true;
    stopSpeaking();
    cancelListen.current?.();
    setPhase("saving");
    const t = transcript.current;
    const answered = !o.declined && (o.answered ?? t.some((x) => x.role === "parent" && x.text !== "[silence]"));
    let summary: CallSummary | undefined;
    if (answered) {
      try { summary = (await post<{ summary: CallSummary }>("/api/extract", { parent, transcript: t })).summary; } catch { /* saved without summary */ }
    }
    const emergency = o.emergency || Boolean(summary?.emergency) || t.some((x) => x.role === "parent" && detectEmergency(x.text));
    const rec: CallRecord = {
      id: `call-${Date.now()}`,
      parentId: parent.id,
      date: isoDay(0),
      status: emergency ? "emergency" : answered ? "completed" : "no_answer",
      via: o.via,
      durationSec: o.durationSec ?? Math.max(0, Math.round((Date.now() - (startedAt.current || Date.now())) / 1000)),
      transcript: t,
      summary,
      messageDelivered: answered && parent.message ? parent.message : undefined,
    };
    saveCall(rec);
    if (emergency) {
      const said = t.find((x) => x.role === "parent" && detectEmergency(x.text))?.text;
      escalate(summary?.emergencyReason || (said && detectEmergency(said)) || "A serious symptom", said);
    }
    if (rec.messageDelivered) saveParent({ ...parent, message: "" });
    setResult(rec);
    setPhase("done");
  };

  const start = () => { setError(null); ended.current = false; if (mode === "phone") void runPhoneCall(); else void runBrowserCall(); };
  const hangUp = () => {
    if (phase === "ringing") { void finish({ emergency: false, via: "browser", declined: true }); return; }
    if (mode === "phone") { ended.current = true; setResult(null); setPhase("done"); return; }
    void finish({ emergency: false, via: "browser" });
  };
  const sendTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim() || !typedResolve.current) return;
    typedResolve.current({ text: typed.trim(), confidence: 1 });
    setTyped("");
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const inCall = phase !== "ringing" && phase !== "done" && phase !== "saving";
  const big = phase === "ringing";
  const maskedPhone = parent.phone ? `${parent.phone.slice(0, -4).replace(/\d/g, "•")}${parent.phone.slice(-4)}` : "";

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-gradient-to-b from-[#1b2242] via-navy to-[#2b2a4f] text-white">
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <Link href="/" className="flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-sm font-medium text-white/85 hover:bg-white/15">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        {aiMode && mode === "browser" && (
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${aiMode === "ai" ? "bg-iris/30 text-[#d9d4ff]" : "bg-amber/25 text-[#ffd9b3]"}`}>
            <Sparkles className="h-3.5 w-3.5" /> {aiMode === "ai" ? "Live AI" : "Demo mode"}
          </span>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 sm:px-5">
        <div className={`flex flex-col items-center text-center transition-all duration-500 ${big ? "mt-6 sm:mt-[6vh]" : "mt-4"}`}>
          <div className="relative">
            {(big || phase === "speaking" || phase === "dialing") && (
              <>
                <span className="pulse-ring absolute inset-0 rounded-full bg-leaf/40" />
                <span className="pulse-ring delay absolute inset-0 rounded-full bg-leaf/30" />
              </>
            )}
            {mode === "phone" ? (
              <Avatar parent={parent} className={`relative border-4 border-white/15 transition-all ${big ? "h-28 w-28 sm:h-32 sm:w-32" : "h-[72px] w-[72px]"}`} textClass="text-3xl" />
            ) : (
              <span className={`relative grid place-items-center rounded-full bg-white text-navy transition-all ${big ? "h-28 w-28 sm:h-32 sm:w-32" : "h-[72px] w-[72px]"}`}>
                <Heart className={big ? "h-14 w-14" : "h-8 w-8"} strokeWidth={2.2} />
              </span>
            )}
          </div>
          <p className={`mt-4 font-semibold ${big ? "text-[26px] sm:text-[30px]" : "text-[20px]"}`}>{mode === "phone" ? parent.callName : "Haal-Chaal"}</p>
          <p className="mt-0.5 text-[15px] text-white/65">
            {big
              ? mode === "phone" ? `We'll ring ${parent.callName}'s phone · ${lang.native}` : `Calling ${parent.callName} · ${lang.native}`
              : phase === "done" ? "Call ended" : `${mm}:${ss} · ${PHASE_LABEL[phase]}`}
          </p>
        </div>

        {phase === "ringing" && (
          <div className="mt-auto pb-8 pt-6">
            {household.parents.length > 1 && (
              <div className="mb-4 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Who to call">
                {household.parents.map((p) => (
                  <button key={p.id} role="tab" aria-selected={p.id === parent.id} onClick={() => choose(p)} className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-[14px] font-semibold ${p.id === parent.id ? "bg-white text-navy" : "bg-white/10 text-white/80"}`}>
                    <Avatar parent={p} className="h-7 w-7" textClass="text-[11px]" /> {p.callName}
                  </button>
                ))}
              </div>
            )}

            <div className="mx-auto mb-3 grid max-w-sm grid-cols-2 gap-1 rounded-2xl bg-white/10 p-1" role="tablist" aria-label="Call type">
              <button role="tab" aria-selected={mode === "browser"} onClick={() => setMode("browser")} className={`flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-[14px] font-semibold ${mode === "browser" ? "bg-white text-navy" : "text-white/75"}`}>
                <Monitor className="h-4 w-4 shrink-0" /> In browser
              </button>
              <button role="tab" aria-selected={mode === "phone"} onClick={() => phoneAllowed && setMode("phone")} disabled={!phoneAllowed} className={`flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-[14px] font-semibold disabled:opacity-45 ${mode === "phone" ? "bg-white text-navy" : "text-white/75"}`}>
                <Smartphone className="h-4 w-4 shrink-0" /> Ring their phone
              </button>
            </div>
            <p className="mx-auto mb-6 max-w-sm text-center text-[13px] leading-relaxed text-white/55">
              {mode === "phone"
                ? `A real call to ${parent.callName}'s phone (${maskedPhone}). You can watch it from here.`
                : phoneReady === false
                  ? "You play the parent: answer and talk back out loud. (Real phone calls aren't switched on for this server.)"
                  : phoneReady && !langOnPhone
                    ? `You play the parent: answer and talk back out loud. (Real phone calls don't support ${lang.name} yet: Hindi, English, Marathi, Tamil and Kannada do.)`
                  : !parent.phone
                    ? <>You play the parent: answer and talk back out loud. <Link href="/family" className="underline">Add {parent.callName}&apos;s number</Link> to ring their real phone.</>
                    : "You play the parent: answer and talk back out loud."}
            </p>

            {mode === "phone" && pinRequired && (
              <label className="mx-auto mb-6 flex max-w-xs flex-col gap-1.5 text-center text-[13px] text-white/60">
                Demo PIN (real calls cost money, so they&apos;re protected)
                <input value={pin} onChange={(e) => { setPin(e.target.value); storePin(e.target.value); }} inputMode="numeric" autoComplete="off" placeholder="PIN" aria-label="Demo PIN" className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-[18px] tracking-[0.3em] text-white outline-none placeholder:tracking-normal placeholder:text-white/40" />
              </label>
            )}

            {mode === "browser" && (
              <label className="mx-auto mb-7 flex max-w-xs flex-col gap-1.5 text-center text-[13px] text-white/60">
                Call language
                <select
                  value={parent.language}
                  onChange={(e) => { const p = { ...parent, language: e.target.value as Parent["language"] }; setParent(p); saveParent(p); }}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-[16px] text-white outline-none"
                >
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code} className="text-ink">{l.native} · {l.name}</option>)}
                </select>
              </label>
            )}

            {error && <p className="mx-auto mb-5 max-w-sm rounded-2xl bg-alarm/25 px-4 py-3 text-center text-[14px] text-[#ffd0c9]">{error}</p>}

            <div className="flex items-start justify-around">
              {mode === "browser" && (
                <button onClick={hangUp} className="flex flex-col items-center gap-2 text-sm text-white/75">
                  <span className="grid h-[68px] w-[68px] place-items-center rounded-full bg-alarm shadow-lg"><PhoneOff className="h-7 w-7" /></span>
                  Don&apos;t answer
                </button>
              )}
              <button onClick={start} className="flex flex-col items-center gap-2 text-sm font-semibold">
                <span className="grid h-[68px] w-[68px] place-items-center rounded-full bg-leaf shadow-lg"><Phone className="h-7 w-7" /></span>
                {mode === "phone" ? `Call ${parent.callName}` : "Answer"}
              </button>
            </div>
          </div>
        )}

        {(inCall || phase === "saving") && (
          <>
            <div ref={scroller} className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pb-4" style={{ maxHeight: "calc(100dvh - 320px)" }}>
              {mode === "phone" && turns.length === 0 && (
                <p className="rounded-2xl bg-white/10 px-4 py-3 text-center text-[14px] text-white/70">
                  {phase === "dialing" ? `Ringing ${parent.callName}… the conversation appears here when the call ends.` : "On the call now. The transcript appears when it ends."}
                </p>
              )}
              {turns.map((t, i) => (
                <div key={i} className={`flex ${t.role === "ai" ? "justify-start" : "justify-end"}`}>
                  <p className={`max-w-[85%] rounded-3xl px-4 py-3 text-[18px] leading-snug sm:px-5 sm:py-3.5 sm:text-[19px] ${t.role === "ai" ? "rounded-bl-md bg-white text-ink" : "rounded-br-md bg-leaf/90 text-white"}`}>
                    {t.text === "[silence]" ? <em className="opacity-70">(no answer)</em> : t.text.replace(/^\[unclear\]\s*/, "")}
                  </p>
                </div>
              ))}
              {live && <div className="flex justify-end"><p className="max-w-[85%] rounded-3xl rounded-br-md bg-leaf/40 px-5 py-3.5 text-[18px] italic text-white/90">{live}</p></div>}
              {phase === "thinking" && (
                <div className="flex gap-1.5 px-2 py-3">{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 animate-pulse rounded-full bg-white/60" style={{ animationDelay: `${i * 0.2}s` }} />)}</div>
              )}
              {phase === "saving" && <p className="py-3 text-center text-[15px] text-white/70">Writing the summary for {household.childName || "the family"}…</p>}
            </div>
            {alertMsg && inCall && <p className={`mb-2 rounded-2xl px-4 py-2 text-center text-[13px] font-semibold ${alertMsg.ok ? "bg-alarm text-white" : "bg-amber/25 text-[#ffdcb8]"}`}>📞 {alertMsg.message}</p>}
            {micNote && <p className="mb-2 rounded-2xl bg-white/10 px-4 py-2 text-center text-[13px] text-white/80">{micNote}</p>}
            {noVoice && <p className="mb-2 rounded-2xl bg-amber/20 px-4 py-2 text-center text-[13px] text-[#ffdcb8]">This browser has no {lang.name} voice, so replies show as captions.</p>}
            {error && <p className="mb-2 rounded-2xl bg-alarm/25 px-4 py-2 text-center text-[13px] text-[#ffd0c9]">{error}</p>}

            {inCall && (
              <div className="sticky bottom-0 pb-[max(env(safe-area-inset-bottom),18px)] pt-2">
                {mode === "browser" && typing && (
                  <form onSubmit={sendTyped} className="mb-4 flex gap-2">
                    <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} disabled={phase !== "listening"} placeholder={phase === "listening" ? "Type the answer…" : "Wait for the question…"} aria-label="Typed answer" className="min-w-0 flex-1 rounded-2xl bg-white/10 px-4 py-3.5 text-[16px] text-white outline-none placeholder:text-white/40" />
                    <button className="grid w-14 place-items-center rounded-2xl bg-leaf disabled:opacity-40" disabled={phase !== "listening"} aria-label="Send"><Send className="h-5 w-5" /></button>
                  </form>
                )}
                <div className="flex items-center justify-around">
                  {mode === "browser" ? (
                    <button onClick={toggleTyping} className="flex w-16 flex-col items-center gap-1.5 text-xs text-white/70">
                      <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10">{typing ? <Mic className="h-6 w-6" /> : <Keyboard className="h-6 w-6" />}</span>
                      {typing ? "Speak" : "Type"}
                    </button>
                  ) : <span className="w-16" />}
                  <button onClick={hangUp} className="flex flex-col items-center gap-1.5 text-xs text-white/70">
                    <span className="grid h-[66px] w-[66px] place-items-center rounded-full bg-alarm shadow-lg"><PhoneOff className="h-7 w-7" /></span>
                    {mode === "phone" ? "Stop watching" : "End call"}
                  </button>
                  {mode === "browser" ? (
                    <div className="flex w-16 flex-col items-center gap-1.5 text-xs text-white/70">
                      <span className={`grid h-14 w-14 place-items-center rounded-full ${phase === "listening" ? "bg-leaf" : "bg-white/10"}`}>
                        <Mic className={`h-6 w-6 ${phase === "listening" ? "animate-pulse" : "opacity-50"}`} />
                      </span>
                      {phase === "listening" ? "Your turn" : "Wait"}
                    </div>
                  ) : <span className="w-16" />}
                </div>
              </div>
            )}
          </>
        )}

        {phase === "done" && (
          <div className="mb-8 mt-8 rounded-[26px] bg-white p-5 text-ink-2 shadow-2xl sm:p-6">
            {result ? (
              <>
                <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-muted">What {household.childName || "the family"} will see</p>
                {result.status === "no_answer" && <p className="mt-3 text-[18px] font-bold text-alarm">No answer. The family gets an alert.</p>}
                {result.status === "emergency" && <p className="mt-3 text-[18px] font-bold text-alarm">Emergency alert: {result.summary?.emergencyReason ?? "serious symptom"}.</p>}
                {alertMsg && (
                  <p className={`mt-2 rounded-2xl px-4 py-3 text-[15px] font-medium ${alertMsg.ok ? "bg-alarm-soft text-alarm" : "bg-peach text-ink-2"}`}>
                    📞 {alertMsg.message}
                  </p>
                )}
                {result.summary && (
                  <>
                    <p className="mt-3 text-[17px] leading-relaxed">{result.summary.summary}</p>
                    {result.summary.highlight && <p className="mt-3 rounded-2xl bg-lav px-4 py-3 text-[15px] italic">“{result.summary.highlight}”</p>}
                  </>
                )}
              </>
            ) : (
              <p className="text-[16px]">You stopped watching. The phone call itself carries on, but its summary won&apos;t be saved to this dashboard.</p>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/" className="flex-1 rounded-2xl bg-navy px-5 py-3.5 text-center text-[15px] font-semibold text-white">Open dashboard</Link>
              <button onClick={() => location.reload()} className="flex-1 rounded-2xl border border-line px-5 py-3.5 text-[15px] font-semibold text-ink">Call again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
