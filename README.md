# Haal-Chaal

**A daily voice check-in call for elderly parents who live alone, in their own language.**

Every evening Haal-Chaal calls the parent. A warm voice asks about their day, their medicines (by the names the family uses), food and sleep. It remembers yesterday ("you mentioned knee pain, how is it today?") and passes on a message from the family. The parent installs nothing, reads nothing and types nothing. They just answer and talk.

Their children, usually in another city, get a short daily summary, a 7-day health view, and alerts when something is wrong: a medicine missed two days running, a serious symptom, or no answer.

Built for **Build for Bharat · India Runs on Voice** (Scaler × Wispr Flow), Round 2. Theme: **Healthcare access**.

## Run it

```bash
docker compose up --build
```

Open **http://localhost:3000** in Chrome. No keys are needed: without an API key the app runs in **demo mode**, with a scripted Hindi/English call and a rule-based summary.

For the live AI conversation in 10 languages, set a key first:

```bash
cp .env.example .env    # then put your Anthropic key in it
docker compose --env-file .env up --build
```

Local dev without Docker: `npm install && npm run dev`.

## Try it in 2 minutes

1. Open the app → **Explore with a sample family**: two parents, Mummy-ji (Lucknow) and Papa (Kanpur), each with their own language, medicines and 6 days of calls.
2. The dashboard shows each parent's latest summary, medicines, mood, alerts and the week's trends. Switch parents with the pills at the top.
3. Tap **Call** → **Answer** and talk back out loud, as the parent would. Allow the microphone. You can also tap **Type** to type the answers.
4. After the call, the summary, any alerts and the 7-day view update straight away.
5. Try saying *"seene mein dard ho raha hai"* (chest pain) to see the emergency path.

## How it works

```
Browser (Chrome)
 ├─ /welcome   onboarding: parent, language (10 Indian languages), medicines
 ├─ /call      the parent's call: speech-to-text → AI turn → text-to-speech, live captions
 ├─ /          family dashboard: summary, checks, alerts, message for the next call
 ├─ /calls     history with transcripts
 └─ /health    7-day grid + slow-change trends
        │
        ▼
Next.js server
 ├─ POST /api/turn     next line of the conversation (Claude Haiku 5.5, forced JSON via tool)
 └─ POST /api/extract  call → medicines / food / sleep / mood / complaints / emergency
        └─ no key or AI error → demo script + rule-based extraction (src/lib/demo.ts)
```

| Part | What we use | If it fails |
|---|---|---|
| Listening | Browser Web Speech API (hi-IN, ta-IN, bn-IN…) | Switches to typed answers |
| Conversation and summary | Claude Haiku 5.5 (`claude-haiku-5-5`) | Scripted call + rule-based summary |
| Speaking | Browser speech synthesis, Indian voices | Captions only, with a notice |
| Emergency detection | Rule-based patterns (`src/lib/safety.ts`) **and** the AI | The rules always run, even offline |
| Storage | Browser localStorage (prototype) | Not applicable |

### Safety rules
- It never guesses. A missing or unclear answer is stored as **unclear**.
- It never gives medical advice or changes doses.
- Chest pain, breathlessness, a fall or dizziness stops the routine, tells the parent their family is being informed, and raises a red alert. Rules can only *add* an emergency, never remove one.
- It asks again on low-confidence speech and gently re-asks after silence. Two silences end the call and alert the family.

## Code map
- `src/lib/speech.ts`: listening with pause tolerance for elderly speakers, voice selection
- `src/app/call/page.tsx`: the call loop
- `src/app/api/turn/route.ts`: conversation prompt, memory, language and script control
- `src/app/api/extract/route.ts`: structured extraction
- `src/lib/insights.ts`: alerts and trends
- `src/lib/demo.ts`: no-key demo mode

## Real phone calls (optional)

The call screen has an **In browser / Ring their phone** toggle. "Ring their phone" places a real call to the **parent's** number (from Family settings) through [Retell AI](https://retellai.com), which handles telephony, Indian-language speech recognition and a natural neural voice. Our server supplies the instructions, greeting and memory for each call, then reads the transcript back and builds the same summary.

```bash
# .env.local
RETELL_API_KEY=...
RETELL_FROM_NUMBER=+1...          # a number in your Retell account
node scripts/setup-retell.mjs     # prints RETELL_AGENTS=..., add it to .env.local
```

Without these, the toggle is disabled and everything else works as before.

## Emergency escalation
If a parent mentions chest pain, breathlessness, a fall or fainting (caught by both the AI and rule-based patterns in `src/lib/safety.ts`), Haal-Chaal immediately **rings the family member's own phone** with a short spoken alert (`/api/phone/alert`), at most once per parent every 10 minutes. The family member's number is set during onboarding or in Family settings.

## Demo PIN
Real phone calls cost money, so on the public demo they need a PIN (`PHONE_DEMO_PIN`). The in-browser call works for everyone without it.

## Images
The parent portraits (`public/parent.jpg`, `public/father.jpg`) and the sunrise banner (`public/hero.jpg`) were generated with ChatGPT image generation for this prototype. They are not real people.
