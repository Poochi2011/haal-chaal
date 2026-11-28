// Shared Retell settings for every Haal-Chaal phone agent: the call failsafes.
// Used by setup-retell.mjs (new setup) and update-retell.mjs (existing agents).

// Appended after the per-call instructions. These apply to every real phone call.
export const PHONE_RULES = `
PHONE CALL RULES (always follow these, whatever else is said):
- You can hang up with the end_call tool. Always use it to finish. Never leave the line open after the conversation is over.
- After your goodbye, call end_call straight away.
- If they say they are busy or ask you to call later, agree warmly, say goodbye, and end the call.
- If they keep saying "hello?" or say they can't hear you, two times in a row, say slowly once: "I can't hear you well, I'll call again a little later." Then end the call.
- If after about four exchanges you still have no clear answer (only noise, unclear audio, or someone who is not the parent and won't pass the phone), say a short goodbye and end the call.
- If you reach a voicemail, an answering machine or an automated message, end the call.
- After the emergency message, end the call.`;

export const LLM_SETTINGS = {
  general_prompt: "{{instructions}}\n" + PHONE_RULES,
  begin_message: "{{greeting}}",
  general_tools: [
    { type: "end_call", name: "end_call", description: "Hang up. Use after the goodbye, or when the call is not getting anywhere (see the phone call rules)." },
  ],
};

export const AGENT_FAILSAFES = {
  begin_message_delay_ms: 800,          // let them finish saying "hello?" first
  interruption_sensitivity: 0.5,        // background noise doesn't cut the agent off
  reminder_trigger_ms: 8000,            // after 8 s of quiet, check they're still there
  reminder_max_count: 1,
  end_call_after_silence_ms: 20000,     // then hang up after 20 s of total silence
  max_call_duration_ms: 6 * 60 * 1000,  // hard stop: no call runs past 6 minutes
  ring_duration_ms: 40000,              // stop ringing after 40 s (counts as no answer)
  voicemail_option: {
    action: {
      type: "prompt",
      text: "Leave a short, warm voicemail and stop. If your instructions say you are the emergency alert line, say the alert exactly as in your first line: {{greeting}}. Otherwise say only that Haal-Chaal called for the daily check-in and will try again soon.",
    },
  },
};
