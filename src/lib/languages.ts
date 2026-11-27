// Languages a parent can be called in. `speech` is the BCP-47 locale used for
// both speech recognition and the speaking voice in the browser.
export type LangCode =
  | "hi" | "en" | "bn" | "mr" | "ta" | "te" | "gu" | "kn" | "ml" | "pa";

export interface Language {
  code: LangCode;
  name: string;      // English name
  native: string;    // name in its own script
  speech: string;    // browser speech locale
  demo: boolean;     // has a scripted demo conversation (works with no API key)
}

export const LANGUAGES: Language[] = [
  { code: "hi", name: "Hindi", native: "हिन्दी", speech: "hi-IN", demo: true },
  { code: "en", name: "English (India)", native: "English", speech: "en-IN", demo: true },
  { code: "bn", name: "Bengali", native: "বাংলা", speech: "bn-IN", demo: false },
  { code: "mr", name: "Marathi", native: "मराठी", speech: "mr-IN", demo: false },
  { code: "ta", name: "Tamil", native: "தமிழ்", speech: "ta-IN", demo: false },
  { code: "te", name: "Telugu", native: "తెలుగు", speech: "te-IN", demo: false },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", speech: "gu-IN", demo: false },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", speech: "kn-IN", demo: false },
  { code: "ml", name: "Malayalam", native: "മലയാളം", speech: "ml-IN", demo: false },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", speech: "pa-IN", demo: false },
];

export function getLanguage(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
