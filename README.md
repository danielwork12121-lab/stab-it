# Stab It (忧忧)




AI-powered reflection app: pin a worry, talk it through with an LLM, and revisit it on a schedule.




**Top 350 of 14,022 participants (top 2%) — ByteDance TRAE AI Hackathon**

**Live demo:** https://stab-it.vercel.app




## What it does




Stab It turns a moment of stress into a small structured ritual. A user describes what's bothering them, talks it through with an AI companion, and "pins" it for a reflection window suggested by the AI (or overridden by the user). When that window is up, the app walks them through a short review — still bothering them, somewhat resolved, or ready to let go — and either reschedules the reflection or archives the entry with a short celebration.




## What I built




I designed and built this solo, end-to-end, for the hackathon: the full pin-chat-review state machine, the AI integration layer, and the frontend. Highlights:




- **Two-mode AI endpoint**: a single `/api/ai/chat` route handles both the initial "pinning" conversation (extracts a core issue, a suggested reflection window, and next steps) and the later "review" conversation (assesses whether the issue still affects the user and whether to reschedule or resolve it).
- **Lightweight memory/context retrieval**: before each pinning-mode reply, a local deterministic similarity lookup (no extra LLM call) surfaces up to two related past entries and folds them into the prompt as context, cached per user for the session.
- **Resilient AI calls**: request timeouts, an automatic fallback provider, and structured fallback responses (with request IDs) so a slow or failed AI call never leaves the UI stuck.
- **Automated tests** for AI reliability and the memory-retrieval logic (`tests/`).
- **Dual deployment**: production on Vercel, with a documented parallel path to Alibaba Cloud (BaoTa panel + PM2) for access in mainland China.




## Architecture & stack




- **Backend**: Node.js + Express (`server.mjs`), with API routes under `api/`
- **Frontend**: vanilla JavaScript (ES modules), no framework — split into focused modules (`auth`, `chat`, `scenes`, `audio`, `storage`, `memory`)
- **AI provider**: Doubao (Volcengine Ark) as the primary model, with automatic fallback to MiniMax
- **Storage**: client-side, per-user state in `localStorage` (no server-side database)
- **Deployment**: Vercel (production) and Alibaba Cloud / BaoTa + PM2 (secondary)




## Running locally




```bash
npm install
cp .env.example .env   # add your Doubao/MiniMax API keys
npm start               # starts the Express server (server.mjs)
```




Then visit `http://127.0.0.1:3001` (or the `HOST`/`PORT` set in `.env`).




---




Built for the ByteDance TRAE AI Hackathon, 2026.



