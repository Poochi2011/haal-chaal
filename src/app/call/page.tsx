"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Keyboard, Mic, Phone, PhoneOff, Send, Sparkles } from "lucide-react";
import { Portrait } from "@/components/bits";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { memoryNotes } from "@/lib/insights";
import { detectEmergency } from "@/lib/safety";
import { isoDay } from "@/lib/seed";
import { hasVoiceFor, listenOnce, speak, speechSupported, stopSpeaking, type ListenResult } from "@/lib/speech";
import { loadCalls, loadFamily, saveCall, saveFamily } from "@/lib/store";
import type { CallRecord, CallSummary, Family, Turn, TurnReply } from "@/lib/types";

type Phase = "ringing" | "thinking" | "speaking" | "listening" | "saving" | "done";

const PHASE_LABEL: Record<Phase, string> = {
  ringing: "Incoming call",
  thinking: "…",
  speaking: "Haal-Chaal is speaking",
  listening: "Listening…",
  saving: "Writing the summary for the family…",
  done: "Call ended",
};

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

export default function CallPage() {
  const [family, setFamily] = useState<Family | null>(null);
  const [phase, setPhase] = useState<Phase>("ringing");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [live, setLive] = useState("");
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [mode, setMode] = useState<"ai" | "demo" | null>(null);
  const [noVoice, setNoVoice] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<CallRecord | null>(null);

  const transcript = useRef<Turn[]>([]);
  const ended = useRef(false);
  const typedResolve = useRef<((r: ListenResult) => void) | null>(null);
  const cancelListen = useRef<(() => void) | null>(null);
  const startedAt = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const typingRef = useRef(false);
  const answerResolve = useRef<((r: ListenResult) => void) | null>(null);

  useEffect(() => {
    ended.current = false; // React dev mode mounts twice; the first cleanup must not end the real call
    setFamily(loadFamily());
    if (!speechSupported().listen) { typingRef.current = true; setTyping(true); }
    return () => { ended.current = true; stopSpeaking(); cancelListen.current?.(); };
  }, []);

  useEffect(() => {
    if (phase === "ringing" || phase === "done") return;
    const id = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => { scroller.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [turns, live]);

  if (!family) return <div className="min-h-screen bg-navy" />;
  const lang = getLanguage(family.language);

  const push = (t: Turn) => {
    transcript.current = [...transcript.current, t];
    setTurns(transcript.current);
  };

  const startMic = () => {
    if (!speechSupported().listen || !answerResolve.current) return;
    const l = listenOnce(lang.speech, setLive);
    cancelListen.current = l.cancel;
    l.promise.then((r) => answerResolve.current?.(r));
  };

  /** Waits for the parent's answer: by voice, or typed if they switch to typing. */
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
    if (next) { cancelListen.current?.(); setLive(""); }
    else startMic();
  };

  const runCall = async () => {
    startedAt.current = Date.now();
    const calls = loadCalls();
    const lastSummary = [...calls].reverse().find((c) => c.summary)?.summary;
    const lastComplaint = lastSummary?.complaints.find((c) => c !== "feeling lonely") ?? null;
    const memory = memoryNotes(calls);
    const voiceOk = await hasVoiceFor(lang.speech);
    setNoVoice(!voiceOk);
    let emergency = false;

    while (!ended.current) {
      setPhase("thinking");
      let reply: TurnReply;
      try {
        reply = await post<TurnReply>("/api/turn", { family, transcript: transcript.current, memory, lastComplaint });
      } catch {
        reply = { say: "…", end: true, emergency: false, mode: "demo" };
      }
      if (ended.current) return;
      setMode(reply.mode);
      push({ role: "ai", text: reply.say, at: Date.now() });
      setPhase("speaking");
      if (voiceOk) await speak(reply.say, lang.speech);
      else await new Promise((r) => setTimeout(r, 1200 + reply.say.length * 45));
      emergency ||= reply.emergency;
      if (reply.end || ended.current) break;

      setPhase("listening");
      setLive("");
      let ans = await getAnswer();
      if (ans.micError) {
        // Mic blocked or unsupported for this language: keep the call going by typing.
        setMicNote(ans.micError === "not-allowed" ? "Microphone is blocked. Allow it in the address bar, or type the answers." : `Voice input isn't available here (${ans.micError}), so type the answers.`);
        typingRef.current = true;
        setTyping(true);
        ans = await new Promise<ListenResult>((resolve) => { typedResolve.current = resolve; });
      }
      typedResolve.current = null;
      if (ended.current) return;
      let text = ans.text.trim();
      if (!text) text = "[silence]";
      else if (ans.confidence > 0 && ans.confidence < 0.45) text = `[unclear] ${text}`;
      setLive("");
      push({ role: "parent", text, at: Date.now() });
      if (detectEmergency(text)) emergency = true;
    }
    await finish(emergency);
  };

  const finish = async (emergency: boolean, declined = false) => {
    ended.current = true;
    stopSpeaking();
    cancelListen.current?.();
    setPhase("saving");
    const t = transcript.current;
    const answered = t.some((x) => x.role === "parent" && x.text !== "[silence]");
    let summary: CallSummary | undefined;
    if (answered) {
      try {
        summary = (await post<{ summary: CallSummary }>("/api/extract", { family, transcript: t })).summary;
      } catch { /* saved without summary */ }
    }
    const rec: CallRecord = {
      id: `call-${Date.now()}`,
      date: isoDay(0),
      status: emergency || summary?.emergency ? "emergency" : !answered || declined ? "no_answer" : "completed",
      durationSec: Math.max(0, Math.round((Date.now() - (startedAt.current || Date.now())) / 1000)),
      transcript: t,
      summary,
      messageDelivered: answered && family.message ? family.message : undefined,
    };
    saveCall(rec);
    if (rec.messageDelivered) saveFamily({ ...loadFamily(), message: "" });
    setResult(rec);
    setPhase("done");
  };

  const answer = () => { void runCall(); };
  const hangUp = () => {
    if (phase === "ringing") { void finish(false, true); return; }
    void finish(false);
  };
  const sendTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim() || !typedResolve.current) return;
    typedResolve.current({ text: typed.trim(), confidence: 1 });
    setTyped("");
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-gradient-to-b from-[#1b2242] via-navy to-[#2b2a4f] text-white">
      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <Link href="/" className="flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-sm font-medium text-white/85 hover:bg-white/15">
          <ArrowLeft className="h-4 w-4" /> Family view
        </Link>
        {mode && (
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${mode === "ai" ? "bg-iris/30 text-[#d9d4ff]" : "bg-amber/25 text-[#ffd9b3]"}`}>
            <Sparkles className="h-3.5 w-3.5" /> {mode === "ai" ? "Live AI" : "Demo mode (no API key)"}
          </span>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5">
        {/* caller */}
        <div className={`flex flex-col items-center text-center transition-all duration-500 ${phase === "ringing" ? "mt-[10vh]" : "mt-5"}`}>
          <div className="relative">
            {(phase === "ringing" || phase === "speaking") && (
              <>
                <span className="pulse-ring absolute inset-0 rounded-full bg-leaf/40" />
                <span className="pulse-ring delay absolute inset-0 rounded-full bg-leaf/30" />
              </>
            )}
            <div className={`relative grid place-items-center rounded-full bg-white/10 ring-1 ring-white/15 transition-all ${phase === "ringing" ? "h-36 w-36" : "h-20 w-20"}`}>
              <Portrait className={`${phase === "ringing" ? "h-32 w-32" : "h-[72px] w-[72px]"} transition-all`} />
            </div>
          </div>
          <p className={`mt-4 font-semibold ${phase === "ringing" ? "text-[30px]" : "text-[20px]"}`}>Haal-Chaal</p>
          <p className="mt-0.5 text-[15px] text-white/65">
            {phase === "ringing" ? `Calling ${family.callName} · ${lang.native}` : phase === "done" ? "Call ended" : `${mm}:${ss} · ${PHASE_LABEL[phase]}`}
          </p>
        </div>

        {/* ringing controls */}
        {phase === "ringing" && (
          <div className="mt-auto pb-12">
            <label className="mx-auto mb-10 flex max-w-xs flex-col gap-2 text-center text-sm text-white/60">
              Call language
              <select
                value={family.language}
                onChange={(e) => { const f = { ...family, language: e.target.value as Family["language"] }; setFamily(f); saveFamily(f); }}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-[16px] text-white outline-none"
              >
                {LANGUAGES.map((l) => <option key={l.code} value={l.code} className="text-ink">{l.native} · {l.name}</option>)}
              </select>
            </label>
            <div className="flex items-start justify-around">
              <button onClick={hangUp} className="flex flex-col items-center gap-2 text-sm text-white/75">
                <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-alarm shadow-lg"><PhoneOff className="h-8 w-8" /></span>
                Don&apos;t answer
              </button>
              <button onClick={answer} className="flex flex-col items-center gap-2 text-sm font-semibold">
                <span className="grid h-[72px] w-[72px] animate-bounce place-items-center rounded-full bg-leaf shadow-lg"><Phone className="h-8 w-8" /></span>
                Answer
              </button>
            </div>
            <p className="mt-8 text-center text-[13px] leading-relaxed text-white/45">
              This is the call {family.callName} gets every evening. Answer and talk back out loud, the way a parent would.
            </p>
          </div>
        )}

        {/* live conversation */}
        {phase !== "ringing" && phase !== "done" && (
          <>
            <div ref={scroller} className="mt-5 flex-1 space-y-3 overflow-y-auto pb-4" style={{ maxHeight: "calc(100dvh - 330px)" }}>
              {turns.map((t, i) => (
                <div key={i} className={`flex ${t.role === "ai" ? "justify-start" : "justify-end"}`}>
                  <p className={`max-w-[85%] rounded-3xl px-5 py-3.5 text-[19px] leading-snug ${t.role === "ai" ? "rounded-bl-md bg-white text-ink" : "rounded-br-md bg-leaf/90 text-white"}`}>
                    {t.text === "[silence]" ? <em className="opacity-70">(no answer)</em> : t.text.replace(/^\[unclear\]\s*/, "")}
                  </p>
                </div>
              ))}
              {live && (
                <div className="flex justify-end"><p className="max-w-[85%] rounded-3xl rounded-br-md bg-leaf/40 px-5 py-3.5 text-[19px] italic text-white/90">{live}</p></div>
              )}
              {phase === "thinking" && (
                <div className="flex gap-1.5 px-2 py-3">{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 animate-pulse rounded-full bg-white/60" style={{ animationDelay: `${i * 0.2}s` }} />)}</div>
              )}
            </div>
            {micNote && <p className="mb-2 rounded-2xl bg-white/10 px-4 py-2 text-center text-[13px] text-white/80">{micNote}</p>}
            {noVoice && <p className="mb-2 rounded-2xl bg-amber/20 px-4 py-2 text-center text-[13px] text-[#ffdcb8]">This browser has no {lang.name} voice installed, so replies show as captions.</p>}

            <div className="sticky bottom-0 pb-[max(env(safe-area-inset-bottom),20px)] pt-2">
              {typing ? (
                <form onSubmit={sendTyped} className="mb-4 flex gap-2">
                  <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} disabled={phase !== "listening"} placeholder={phase === "listening" ? "Type the answer…" : "Wait for the question…"} className="min-w-0 flex-1 rounded-2xl bg-white/10 px-4 py-3.5 text-[16px] text-white outline-none placeholder:text-white/40" />
                  <button className="grid w-14 place-items-center rounded-2xl bg-leaf disabled:opacity-40" disabled={phase !== "listening"} aria-label="Send"><Send className="h-5 w-5" /></button>
                </form>
              ) : null}
              <div className="flex items-center justify-around">
                <button onClick={toggleTyping} className="flex flex-col items-center gap-1.5 text-xs text-white/70">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10">{typing ? <Mic className="h-6 w-6" /> : <Keyboard className="h-6 w-6" />}</span>
                  {typing ? "Speak" : "Type"}
                </button>
                <button onClick={hangUp} className="flex flex-col items-center gap-1.5 text-xs text-white/70">
                  <span className="grid h-[68px] w-[68px] place-items-center rounded-full bg-alarm shadow-lg"><PhoneOff className="h-7 w-7" /></span>
                  End call
                </button>
                <div className="flex flex-col items-center gap-1.5 text-xs text-white/70">
                  <span className={`grid h-14 w-14 place-items-center rounded-full ${phase === "listening" ? "bg-leaf" : "bg-white/10"}`}>
                    <Mic className={`h-6 w-6 ${phase === "listening" ? "animate-pulse" : "opacity-50"}`} />
                  </span>
                  {phase === "listening" ? "Your turn" : "Wait"}
                </div>
              </div>
            </div>
          </>
        )}

        {phase === "saving" && (
          <div className="mt-auto pb-16 text-center text-white/70">Writing the summary for the family…</div>
        )}

        {/* result */}
        {phase === "done" && result && (
          <div className="mt-8 rounded-[26px] bg-white p-6 text-ink-2 shadow-2xl">
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-muted">What {family.childName} will see</p>
            {result.status === "no_answer" && <p className="mt-3 text-[18px] font-bold text-alarm">No answer. The family gets an alert.</p>}
            {result.status === "emergency" && <p className="mt-3 text-[18px] font-bold text-alarm">Emergency alert sent: {result.summary?.emergencyReason ?? "serious symptom"}.</p>}
            {result.summary && (
              <>
                <p className="mt-3 text-[17px] leading-relaxed">{result.summary.summary}</p>
                <p className="mt-3 rounded-2xl bg-lav px-4 py-3 text-[15px] italic">“{result.summary.highlight}”</p>
              </>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/" className="flex-1 rounded-2xl bg-navy px-5 py-3.5 text-center text-[15px] font-semibold text-white">Open family dashboard</Link>
              <button onClick={() => location.reload()} className="flex-1 rounded-2xl border border-line px-5 py-3.5 text-[15px] font-semibold text-ink">Call again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
