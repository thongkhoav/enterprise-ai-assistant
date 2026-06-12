# Frontend

Vite + React + TypeScript UI for the Enterprise AI Assistant API.

## Setup

```bash
cd /Users/rio/Documents/coding/enterprise-ai-assistant/frontend
npm install
cp .env.example .env
npm run dev
```

Then open http://localhost:5173.

The UI stores runtime settings in `localStorage` only:

- API base URL
- API bearer token
- session id

