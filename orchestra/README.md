# 🎼 Orchestra

Orchestra deploys a panel of specialist AI agents to evaluate hackathon submissions across 5 dimensions, producing objective scores, a ranked leaderboard, and personalised feedback reports. It augments human judges — it does not replace them.

## Tech Stack
- **Backend:** Node.js, Express, better-sqlite3, OpenAI GPT-4o
- **Frontend:** React 18, Vite, Tailwind CSS

## Prerequisites
- Node.js 20+
- OpenAI API Key

## Setup & Running

1. **Environment Config**
   Edit `backend/.env` with your API keys:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   GITHUB_TOKEN=your_github_pat_token  # Optional but highly recommended to bypass GH API rate limits
   PORT=8000
   ```

2. **Start the Backend**
   ```bash
   cd backend
   npm install
   node server.js
   ```

3. **Start the Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Workflow Architecture
1. **Parser Pipeline:** Ingests PDF/PPTX and recursively loops GitHub repos via API.
2. **Specialist Judges:** Innovation, Technical, Business, Presentation, Clarity analyze concurrently (`Promise.allSettled`).
3. **Bias Auditor:** Sequentially reviews all 5 standard outputs for anomalies.
4. **Chief Judge:** Calculates final score out of 100, assigns a High/Medium/Low confidence tier based on Auditor notes and fallback triggers.
5. **Feedback Engine:** Synthesizes structured markdown reports.
