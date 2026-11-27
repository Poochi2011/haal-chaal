"use client";

// Browser speech: listening (Web Speech API recognition) and speaking
// (speechSynthesis). Free, no API key, and supports Indian locales in Chrome.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rec = any;

export function speechSupported(): { listen: boolean; speak: boolean } {
  if (typeof window === "undefined") return { listen: false, speak: false };
  const w = window as any;
  return {
    listen: Boolean(w.SpeechRecognition || w.webkitSpeechRecognition),
    speak: "speechSynthesis" in window,
  };
}

function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const v = speechSynthesis.getVoices();
    if (v.length) return resolve(v);
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

/** Best available voice for a locale: prefer Google / female-sounding voices. */
export async function pickVoice(locale: string): Promise<SpeechSynthesisVoice | null> {
  const voices = await voicesReady();
  const base = locale.split("-")[0];
  const exact = voices.filter((v) => v.lang.replace("_", "-") === locale);
  const sameLang = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  const pool = exact.length ? exact : sameLang;
  if (!pool.length) return null;
  // Google's network voices sound the most natural in Chrome; then Apple's
  // enhanced/premium voices; then any female Indian voice.
  const score = (v: SpeechSynthesisVoice) =>
    (/google/i.test(v.name) ? 6 : 0) + (/premium|enhanced|natural|neural/i.test(v.name) ? 4 : 0) +
    (/lekha|kalpana|veena|female|swara|neerja|vani|piya|geeta|soumya/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

export async function hasVoiceFor(locale: string): Promise<boolean> {
  return (await pickVoice(locale)) !== null;
}

let speakToken = 0;

/**
 * Speaks text sentence by sentence with short natural pauses (browser voices
 * sound far less robotic in short phrases). Resolves when finished, or at once
 * if the browser has no voice for this language.
 */
export async function speak(text: string, locale: string, rate = 0.95): Promise<void> {
  if (!speechSupported().speak) return;
  speechSynthesis.cancel();
  const voice = await pickVoice(locale);
  if (!voice) return;
  const token = ++speakToken;
  const parts = text.match(/[^.!?।|]+[.!?।|]*/g)?.map((x) => x.trim()).filter(Boolean) ?? [text];
  for (const [i, part] of parts.entries()) {
    if (token !== speakToken) return; // cancelled
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(part);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = rate;
      u.pitch = 1;
      // Chrome sometimes never fires onend; keep a timeout guard.
      const guard = setTimeout(resolve, 2000 + part.length * 130);
      u.onend = u.onerror = () => { clearTimeout(guard); resolve(); };
      speechSynthesis.speak(u);
    });
    if (i < parts.length - 1) await new Promise((r) => setTimeout(r, 180));
  }
}

export function stopSpeaking() {
  speakToken++;
  if (speechSupported().speak) speechSynthesis.cancel();
}

export interface ListenResult {
  text: string;          // "" means silence
  confidence: number;    // 0..1, 0 if unknown
  micError?: string;     // mic blocked / unavailable: caller should fall back to typing
}

/**
 * Listens for one answer. Elderly speakers pause mid-sentence, so instead of
 * stopping at the first pause we wait for `endPauseMs` of quiet after the last
 * words. Gives up after `silenceMs` with no speech at all.
 */
export function listenOnce(
  locale: string,
  onInterim: (text: string) => void,
  opts: { silenceMs?: number; endPauseMs?: number } = {},
): { promise: Promise<ListenResult>; cancel: () => void } {
  const { silenceMs = 8000, endPauseMs = 1700 } = opts;
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  const rec: Rec = new Ctor();
  rec.lang = locale;
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let finalText = "";
  let interim = "";
  let confSum = 0;
  let confN = 0;
  let settled = false;
  let micError: string | undefined;
  let pauseTimer: ReturnType<typeof setTimeout> | undefined;
  let resolveFn: (r: ListenResult) => void = () => {};

  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(pauseTimer);
    clearTimeout(silenceTimer);
    try { rec.stop(); } catch {}
    const text = (finalText + " " + interim).trim();
    resolveFn({ text, confidence: confN ? confSum / confN : 0, micError });
  };

  const silenceTimer = setTimeout(() => {
    if (!(finalText + interim).trim()) finish();
  }, silenceMs);

  rec.onresult = (e: any) => {
    interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        finalText += " " + r[0].transcript;
        if (r[0].confidence) { confSum += r[0].confidence; confN++; }
      } else {
        interim += r[0].transcript;
      }
    }
    onInterim((finalText + " " + interim).trim());
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(finish, endPauseMs);
  };
  rec.onerror = (e: any) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    console.warn("[speech]", e.error);
    if (["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported", "network"].includes(e.error)) {
      micError = e.error;
      finish();
    }
  };
  // Chrome ends recognition on its own after a while; restart if still waiting.
  rec.onend = () => {
    if (!settled) {
      try { rec.start(); } catch { finish(); }
    }
  };

  const promise = new Promise<ListenResult>((resolve) => {
    resolveFn = resolve;
    try { rec.start(); } catch { finish(); }
  });
  return {
    promise,
    cancel: () => {
      settled = true;
      clearTimeout(pauseTimer);
      clearTimeout(silenceTimer);
      try { rec.abort(); } catch {}
    },
  };
}
