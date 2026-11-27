// Rule-based emergency detection. Runs on every parent sentence, in the
// browser and on the server, so a serious symptom raises an alert even if the
// AI model is down or misses it. Deliberately over-sensitive: a false alarm
// costs a phone call, a missed one can cost much more.

const EMERGENCY_PATTERNS: { reason: string; patterns: RegExp[] }[] = [
  {
    reason: "Chest pain",
    patterns: [
      /chest\s*pain/i, /seene\s*(me|mein|mai)\s*dard/i, /सीने\s*में\s*दर्द/,
      /छाती\s*में\s*दर्द/, /chhati\s*(me|mein)\s*dard/i, /বুকে\s*ব্যথা/,
      /நெஞ்சு\s*வலி/, /ఛాతీ\s*నొప్పి/, /छातीत\s*दुख/,
    ],
  },
  {
    reason: "Breathing trouble",
    patterns: [
      /can'?t\s*breathe/i, /breathless/i, /saans\s*(nahi|nahin|nhi|phool)/i,
      /सांस\s*(नहीं|फूल)/, /साँस\s*(नहीं|फूल)/, /শ্বাস\s*কষ্ট/, /மூச்சு\s*விட/,
    ],
  },
  {
    reason: "A fall",
    patterns: [
      /\bi\s*fell\b/i, /fell\s*down/i, /gir\s*(gayi|gaya|gai|padi|pada)/i,
      /गिर\s*(गई|गया|गयी|पड़ी|पड़ा)/, /পড়ে\s*গেছি/, /கீழே\s*விழுந்/,
    ],
  },
  {
    reason: "Dizziness or fainting",
    patterns: [
      /dizzy/i, /faint/i, /chakkar\s*(aa|aya|aaya|aate)/i, /चक्कर\s*(आ|आया|आते)/,
      /बेहोश/, /behosh/i, /মাথা\s*ঘুর/, /தலை\s*சுற்ற/,
    ],
  },
];

export function detectEmergency(text: string): string | null {
  for (const { reason, patterns } of EMERGENCY_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return reason;
  }
  return null;
}
