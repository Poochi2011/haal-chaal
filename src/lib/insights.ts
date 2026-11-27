// Turns the call history into what the family actually needs to see:
// alerts (act now) and trends (slow changes a rushed phone call would miss).

import type { CallRecord, FamilyAlert, Parent } from "./types";

export function computeAlerts(family: Parent, calls: CallRecord[]): FamilyAlert[] {
  const alerts: FamilyAlert[] = [];
  const recent = [...calls].sort((a, b) => b.date.localeCompare(a.date));
  const last = recent[0];
  if (!last) return alerts;

  if (last.status === "emergency" || last.summary?.emergency) {
    alerts.push({
      level: "red",
      title: `Serious symptom: ${last.summary?.emergencyReason ?? "needs attention"}`,
      detail: `${family.callName} mentioned this on the ${prettyDate(last.date)} call. Please call now, or ask a neighbour to check in person.`,
    });
  }

  // A missed call is retried every 10 minutes, up to 4 attempts. Only when
  // every attempt goes unanswered (or two days run unanswered) is it an alert.
  if (last.status === "no_answer") {
    const exhausted = (last.attempts ?? 1) >= 4;
    const twoInARow = recent[1]?.status === "no_answer";
    alerts.push(
      exhausted || twoInARow
        ? {
            level: "red",
            title: exhausted ? `No answer after ${last.attempts} calls today` : "No answer two days in a row",
            detail: `${family.callName} hasn't picked up. Please call yourself, or ask a neighbour to check.`,
          }
        : {
            level: "amber",
            title: "Missed today's call",
            detail: `${family.callName} didn't pick up. They might just be busy; Haal-Chaal tries again every 10 minutes, up to 3 more times.`,
          },
    );
  }

  // Same medicine missed on the last two calls with an answer.
  const answered = recent.filter((c) => c.summary).slice(0, 2);
  if (answered.length === 2) {
    for (const med of family.medicines) {
      if (answered.every((c) => c.summary!.meds[med.id] === "no")) {
        alerts.push({
          level: "red",
          title: `${med.name} missed two days in a row`,
          detail: "A reminder from you may help. Ask whether it has run out or is causing side effects.",
        });
      }
    }
  }

  if (last.summary?.ate === "no") {
    alerts.push({
      level: "amber",
      title: "Did not eat today",
      detail: `${family.callName} said they have not eaten. Worth a quick call.`,
    });
  }

  return alerts;
}

export function computeTrends(calls: CallRecord[]): string[] {
  const last4 = [...calls]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((c) => c.summary)
    .slice(0, 4);
  if (last4.length < 3) return [];
  const trends: string[] = [];
  const n = last4.length;

  const lowFood = last4.filter((c) => ["no", "partly"].includes(c.summary!.ate)).length;
  if (lowFood >= 3) trends.push(`Eating less on ${lowFood} of the last ${n} days.`);

  const lowMood = last4.filter((c) => c.summary!.mood === "low").length;
  if (lowMood >= 2) trends.push(`Sounded low on ${lowMood} of the last ${n} days.`);

  const badSleep = last4.filter((c) => c.summary!.slept === "no").length;
  if (badSleep >= 2) trends.push(`Slept badly on ${badSleep} of the last ${n} days.`);

  const counts = new Map<string, number>();
  for (const c of last4) for (const k of c.summary!.complaints) counts.set(k.toLowerCase(), (counts.get(k.toLowerCase()) ?? 0) + 1);
  for (const [k, v] of counts) if (v >= 3) trends.push(`Mentioned ${k} on ${v} of the last ${n} days.`);

  return trends;
}

export function prettyDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** A short memory of recent calls, handed to the AI so it can follow up. */
export function memoryNotes(calls: CallRecord[]): string {
  return [...calls]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((c) => c.summary)
    .slice(0, 3)
    .map((c) => `${prettyDate(c.date)}: ${c.summary!.summary}${c.summary!.highlight ? ` Highlight: ${c.summary!.highlight}` : ""}`)
    .join("\n");
}
