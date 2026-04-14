# SlideForge AI

SlideForge AI is an AI-powered Social Media Studio that turns a rough idea into a polished 5-slide Instagram-style carousel.  
It includes a premium dark SaaS UI, dynamic canvas-based slide designs, theme switching, layout variations, and export options (PNG + ZIP).

---

## Features

- AI-generated 5-slide carousel from a single idea prompt
- Premium dark UI with glassmorphism and gradient accents
- Canvas-generated slide visuals (no external image APIs)
- Multiple design themes: `Minimal`, `Gradient`, `Dark`
- Multiple slide layouts: centered, split, highlight, quote
- Regenerate individual slides
- Download single slide as PNG
- Download full carousel as ZIP
- Copy all generated text content

---

## Tech Stack

### Frontend
- React + Vite + TypeScript
- Tailwind CSS
- JSZip + FileSaver for export

### Backend
- Node.js + Express
- OpenRouter (via OpenAI-compatible SDK)
- CORS + dotenv

---

## Project Structure

```text
slideforge-ai/
  frontend/   # React app
  backend/    # Express API
```

---

## How It Works

1. User enters an idea in the frontend.
2. Frontend sends request to backend `POST /generate`.
3. Backend calls OpenRouter LLM and returns structured slide data.
4. Frontend renders each slide as a styled 1:1 Canvas image.
5. User can regenerate, copy content, and download slides.

---

## Environment Variables

## Backend (`backend/.env`)

Create `.env` in `backend`:

```env
PORT=4000
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-4o-mini
```

## Frontend (`frontend/.env`) (optional for local)

Create `.env` in `frontend`:

```env
VITE_API_URL=http://localhost:4000
```

---

## Local Development

### 1) Install dependencies

```bash
cd frontend
npm install
cd ../backend
npm install
```

### 2) Start backend

```bash
cd backend
npm run dev
```

Backend runs on `http://localhost:4000`.

### 3) Start frontend

```bash
cd frontend
npm run dev
```

Frontend runs on Vite default (`http://localhost:5173`).

### 4) Build frontend (production check)

```bash
cd frontend
npm run build
```

---

## API Reference

### `POST /generate`

Generates a 5-slide carousel.

### Request body

```json
{
  "idea": "Explain spaced repetition for students",
  "format": "Post"
}
```

### Response body

```json
[
  {
    "title": "Why You Forget Math Fast",
    "content": "Your brain removes unused information quickly..."
  }
]
```

> The backend normalizes to exactly 5 slides.

### `GET /health`

Health check endpoint.

Response:

```json
{ "ok": true }
```

---

## Deployment Guide

## Backend Deployment on Render

1. Push repo to GitHub.
2. In Render, create a **Web Service** from the repo.
3. Configure:
   - **Root directory**: `backend`
   - **Environment**: `Node`
   - **Build command**: `npm install`
   - **Start command**: `npm start`
4. Add environment variables in Render:
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL` (optional, default is `openai/gpt-4o-mini`)
5. Deploy and verify:
   - `https://your-service.onrender.com/health`

## Frontend Deployment on Vercel

1. Create a new Vercel project from the same GitHub repo.
2. Configure:
   - **Root directory**: `frontend`
   - **Framework**: Vite
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
3. Add environment variable in Vercel:
   - `VITE_API_URL=https://your-backend.onrender.com`
4. Redeploy frontend.

---

## Troubleshooting

- **Frontend cannot call backend**
  - Ensure `VITE_API_URL` points to deployed Render URL.
  - Confirm backend `/health` endpoint works.

- **500 from `/generate`**
  - Check `OPENROUTER_API_KEY` is set correctly in Render.
  - Check backend logs for model/API errors.

- **Slow first request on Render**
  - Expected on free tier due to cold starts.

- **Download ZIP not working**
  - Check browser permissions/extensions blocking downloads.

---

## Scripts

### Frontend (`frontend/package.json`)
- `npm run dev` - Start frontend dev server
- `npm run build` - Build production bundle
- `npm run preview` - Preview production build locally

### Backend (`backend/package.json`)
- `npm run dev` - Run backend with watch mode
- `npm start` - Run backend in production mode

---

## Security Notes

- Keep API keys only in backend environment variables.
- Do not commit `.env` files to GitHub.
- Rotate keys if accidentally exposed.

---

## Future Improvements

- Add authentication and user projects
- Save carousels to database
- One-click publish to social platforms
- Brand kits (fonts, logo, colors)
