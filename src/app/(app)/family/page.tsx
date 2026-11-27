"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, RotateCcw, Save, UserMinus } from "lucide-react";
import { ParentSwitcher } from "@/components/bits";
import { PhotoPicker } from "@/components/PhotoPicker";
import { cleanMedicines, MedicineEditor } from "@/components/MedicineEditor";
import { LANGUAGES } from "@/lib/languages";
import { toE164 } from "@/lib/phone";
import { loadHousehold, removeParent, resetAll, resetDemo, saveHousehold, saveParent, setActiveId } from "@/lib/store";
import { getPin, setPin as storePin } from "@/lib/alert";
import { blankParent } from "@/lib/seed";
import type { Parent } from "@/lib/types";
import { useFamily } from "@/lib/useFamily";

const field = "w-full rounded-2xl border border-line bg-cream px-4 py-3.5 text-[16px] text-ink outline-none focus:border-iris";

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 block text-[15px] font-semibold text-ink">
      {children}
      {hint && <span className="mt-0.5 block text-[13px] font-normal text-muted sm:ml-2 sm:mt-0 sm:inline">{hint}</span>}
    </span>
  );
}

export default function FamilyPage() {
  return <Suspense><FamilyEditor /></Suspense>;
}

function FamilyEditor() {
  const router = useRouter();
  const wantsNew = useSearchParams().get("new") === "1";
  const { household, parent } = useFamily();
  const [f, setF] = useState<Parent | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [childName, setChildName] = useState("");
  const [childPhone, setChildPhone] = useState<string | null>(null);
  const [pin, setPinState] = useState("");
  const [pinRequired, setPinRequired] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    setPinState(getPin());
    fetch("/api/phone/config").then((r) => r.json()).then((c) => setPinRequired(Boolean(c.enabled && c.pinRequired))).catch(() => {});
  }, []);
  const [saved, setSaved] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!household || !parent) return;
    if (wantsNew && !isNew) { setF(blankParent()); setIsNew(true); setSaved(false); }
    else if (!wantsNew && (!f || isNew || f.id !== parent.id)) { setF(parent); setIsNew(false); setSaved(false); }
    setChildName((c) => c || household.childName);
    setChildPhone((c) => (c === null ? household.childPhone ?? "" : c));
  }, [household, parent, f, isNew, wantsNew]);

  if (!f || !household) return null;

  const set = <K extends keyof Parent>(k: K, v: Parent[K]) => { setF({ ...f, [k]: v }); setSaved(false); };
  const phoneOk = !f.phone.trim() || toE164(f.phone) !== null;
  const childPhoneOk = !(childPhone ?? "").trim() || toE164(childPhone ?? "") !== null;
  const canSave = f.name.trim() && phoneOk && childPhoneOk;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    const clean: Parent = {
      ...f,
      name: f.name.trim(),
      callName: f.callName.trim() || f.name.trim(),
      phone: f.phone.trim() ? toE164(f.phone)! : "",
      medicines: cleanMedicines(f.medicines),
    };
    saveParent(clean);
    const cp = (childPhone ?? "").trim() ? toE164(childPhone ?? "")! : "";
    if (childName.trim() !== household.childName || cp !== (household.childPhone ?? "")) {
      saveHousehold({ ...loadHousehold(), childName: childName.trim(), childPhone: cp });
      setChildPhone(cp);
    }
    setActiveId(clean.id);
    setF(clean);
    setSaved(true);
    if (isNew) router.replace("/family");
  };

  return (
    <form className="space-y-5" onSubmit={save}>
      <header className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight text-ink sm:text-[38px]">{isNew ? "Add a parent" : "Family setup"}</h1>
          <p className="mt-1 text-[17px] text-ink-2">{isNew ? "Each parent gets their own call, language and medicines." : `Who Haal-Chaal calls, and what it asks ${f.callName || "them"}.`}</p>
        </div>
        <button type="button" onClick={() => { resetDemo(); window.location.href = "/"; }} className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-[14px] font-medium text-ink">
          <RotateCcw className="h-4 w-4" /> Reset sample family
        </button>
      </header>

      {!isNew && <ParentSwitcher household={household} active={parent ?? f} />}

      <section className="rise rise-1 card grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2"><PhotoPicker parent={f} onChange={(photo) => set("photo", photo)} /></div>
        <label><Label>Parent&apos;s name</Label><input required className={field} placeholder="e.g. Kamla Devi" value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label><Label hint="the call greets them this way">You call them</Label><input className={field} placeholder="e.g. Mummy-ji or Papa" value={f.callName} onChange={(e) => set("callName", e.target.value)} /></label>
        <label>
          <Label hint="the real phone call rings this number">Their phone number</Label>
          <input type="tel" inputMode="tel" autoComplete="off" className={`${field} ${phoneOk ? "" : "border-alarm"}`} placeholder="e.g. 98765 43210" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
          {!phoneOk && <span className="mt-1 block text-[13px] text-alarm">Enter a 10-digit Indian mobile number, or include the country code.</span>}
        </label>
        <label><Label>Their city</Label><input className={field} placeholder="e.g. Lucknow" value={f.city} onChange={(e) => set("city", e.target.value)} /></label>
        <label>
          <Label>Language</Label>
          <select className={field} value={f.language} onChange={(e) => set("language", e.target.value as Parent["language"])}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native} · {l.name}</option>)}
          </select>
        </label>
        <label><Label>Daily call time</Label><input type="time" className={field} value={f.callTime} onChange={(e) => set("callTime", e.target.value)} /></label>
        <label className="sm:col-span-2">
          <Label hint="optional, the first thing they hear each day. Type it any way, e.g. in Hinglish">Custom greeting</Label>
          <input className={field} placeholder={`e.g. Namaste ${f.callName || "Mummy-ji"}!`} value={f.greeting} onChange={(e) => set("greeting", e.target.value)} />
        </label>
      </section>

      <section className="rise rise-2 card p-5 sm:p-6">
        <Label hint="use the words your parent uses">Medicines</Label>
        <MedicineEditor value={f.medicines} onChange={(m) => set("medicines", m)} />
      </section>

      <section className="rise rise-3 card grid gap-4 p-5 sm:p-6">
        <label><Label hint="private, helps the call follow up">Health notes</Label><textarea rows={3} className={field} placeholder="e.g. knee pain, diabetes" value={f.healthNotes} onChange={(e) => set("healthNotes", e.target.value)} /></label>
        <label><Label hint="read out once, in their language">Message for the next call</Label><input className={field} value={f.message} onChange={(e) => set("message", e.target.value)} /></label>
        <label><Label hint="shown on your dashboard">Your name</Label><input className={field} value={childName} onChange={(e) => { setChildName(e.target.value); setSaved(false); }} /></label>
        <label>
          <Label hint="if a call turns up an emergency, we ring you right away">Your phone number</Label>
          <input type="tel" inputMode="tel" autoComplete="off" className={`${field} ${childPhoneOk ? "" : "border-alarm"}`} placeholder="e.g. 98765 43210" value={childPhone ?? ""} onChange={(e) => { setChildPhone(e.target.value); setSaved(false); }} />
          {!childPhoneOk && <span className="mt-1 block text-[13px] text-alarm">Enter a 10-digit Indian mobile number, or include the country code.</span>}
        </label>
        {pinRequired && (
          <label>
            <Label hint="real phone calls on this demo need it; saved on this device">Demo PIN</Label>
            <input inputMode="numeric" autoComplete="off" className={field} placeholder="PIN" value={pin} onChange={(e) => { setPinState(e.target.value); storePin(e.target.value); }} />
          </label>
        )}
      </section>

      <div className="sticky bottom-[84px] z-10 -mx-5 bg-gradient-to-t from-cream via-cream/95 to-cream/0 px-5 pb-3 pt-6 sm:mx-0 sm:px-0 lg:bottom-0 lg:pb-6">
        <button disabled={!canSave} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-navy px-6 py-4 text-[16px] font-semibold text-white shadow-lg disabled:opacity-50 sm:w-auto">
          {saved ? <Check className="h-5 w-5" /> : <Save className="h-5 w-5" />} {saved ? "Saved" : isNew ? "Add parent" : "Save changes"}
        </button>
      </div>

        {!isNew && household.parents.length > 1 && (
          <button
            type="button"
            onClick={() => {
              if (!confirmRemove) { setConfirmRemove(true); return; }
              removeParent(f.id); setF(null); setConfirmRemove(false);
            }}
            onBlur={() => setConfirmRemove(false)}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-[15px] font-semibold sm:w-auto ${confirmRemove ? "border-alarm bg-alarm text-white" : "border-line bg-white text-alarm"}`}
          >
            <UserMinus className="h-4.5 w-4.5" /> {confirmRemove ? `Tap again to remove ${f.callName || "parent"} and their calls` : `Remove ${f.callName || "parent"}`}
          </button>
        )}

      <section className="card mt-4 p-5 sm:p-6">
        <p className="text-[17px] font-bold text-ink">Start over</p>
        <p className="mt-0.5 text-[15px] text-muted">Deletes every parent, call and setting saved on this device, then opens the welcome screen.</p>
        <button
          type="button"
          onClick={() => { if (!confirmReset) { setConfirmReset(true); return; } resetAll(); window.location.href = "/welcome"; }}
          onBlur={() => setConfirmReset(false)}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-[15px] font-semibold sm:w-auto ${confirmReset ? "border-alarm bg-alarm text-white" : "border-alarm/40 bg-white text-alarm"}`}
        >
          <RotateCcw className="h-4.5 w-4.5" /> {confirmReset ? "Tap again to erase everything" : "Reset account"}
        </button>
      </section>
    </form>
  );
}
