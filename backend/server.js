import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const nodeEnv = process.env.NODE_ENV || "development";
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser and server-to-server requests (no Origin header).
      if (!origin) return callback(null, true);
      if (corsOrigins.length === 0) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS blocked: origin is not allowed"));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

app.use((req, _res, next) => {
  req.requestStart = Date.now();
  next();
});

const promptTemplate = `You are a social media content expert.

You convert messy ideas into polished social media creatives.

Output format depends on selected format:

1) Carousel
- Slide 1: Hook (attention-grabbing, emotional)
- Slide 2: Problem (relatable)
- Slide 3: Insight (concept explanation)
- Slide 4: Solution (practical value)
- Slide 5: Takeaway (strong closing)

2) Post
- Return 1 slide only
- One impactful, concise message

3) Story
- Return 1-3 slides
- Short punchy lines for quick vertical consumption

Each slide must include:
- Title (short)
- Content (2-3 lines, simple language)
- topic (single short topic label such as Math, Physics, History, Kids, Chemistry)
- background_keywords (visual search keywords for image generation)
- design_style (must be one of: modern, educational, historical, playful)

Use simple conversational language. Keep it social-media friendly, not academic.
Make visuals context-aware:
- Chemistry -> lab, molecules, reactions
- Physics -> motion, space, diagrams
- Math -> equations, graphs, numbers
- History -> forts, warriors, ancient themes
- Kids -> playful, colorful visuals

Return ONLY JSON:
[
 {
   "title": "...",
   "content": "...",
   "topic": "...",
   "background_keywords": "...",
   "design_style": "modern"
 }
]`;

function normalizeSlides(rawSlides) {
  if (!Array.isArray(rawSlides)) {
    throw new Error("AI response is not a valid slide list.");
  }

  const slides = rawSlides.slice(0, 5).map((slide, index) => ({
    title: String(slide?.title || `Slide ${index + 1}`).trim(),
    content: String(slide?.content || "").trim(),
    topic: String(slide?.topic || "General").trim(),
    background_keywords: String(
      slide?.background_keywords || `${slide?.topic || "education"}, modern illustration`,
    ).trim(),
    design_style: ["modern", "educational", "historical", "playful"].includes(
      String(slide?.design_style || "").toLowerCase(),
    )
      ? String(slide?.design_style).toLowerCase()
      : "modern",
  }));

  return slides;
}

app.post("/generate", async (req, res) => {
  const { idea, format } = req.body ?? {};

  if (!idea || typeof idea !== "string" || !idea.trim()) {
    return res.status(400).json({ error: "Idea is required." });
  }

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is missing in environment variables");
    }

    const selectedFormat = ["Post", "Story", "Carousel"].includes(String(format))
      ? String(format)
      : "Carousel";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${promptTemplate}

Output schema:
{ "slides": [{ "title": "string", "content": "string", "topic": "string", "background_keywords": "string", "design_style": "modern|educational|historical|playful" }] }`,
          },
          {
            role: "user",
            content: `Idea: ${idea.trim()}
Format preference: ${selectedFormat}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter request failed (${response.status}): ${errorBody}`);
    }

    const completion = await response.json();
    const rawContent = completion?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(rawContent);
    let slides = normalizeSlides(parsed.slides);

    if (selectedFormat === "Carousel") {
      while (slides.length < 5) {
        slides.push({
          title: `Slide ${slides.length + 1}`,
          content: "Add your point here.",
          topic: "General",
          background_keywords: "creative social media background, modern gradient",
          design_style: "modern",
        });
      }
      slides = slides.slice(0, 5);
    } else if (selectedFormat === "Post") {
      slides = slides.slice(0, 1);
    } else {
      slides = slides.slice(0, 3);
    }

    return res.json(slides);
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Generation error:", {
      message: safeMessage,
      route: req.originalUrl,
      method: req.method,
      duration_ms: Date.now() - req.requestStart,
    });

    if (nodeEnv !== "production" && error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return res.status(500).json({ error: "Failed to generate slides. Please retry." });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, env: nodeEnv, uptime_s: Math.round(process.uptime()) });
});

app.listen(port, () => {
  console.log("API KEY:", process.env.OPENROUTER_API_KEY ? "Present" : "Missing");
  console.log(`SlideForge backend running on port ${port} (${nodeEnv})`);
  if (corsOrigins.length > 0) {
    console.log(`Allowed CORS origins: ${corsOrigins.join(", ")}`);
  } else {
    console.log("Allowed CORS origins: all (CORS_ORIGINS not set)");
  }
});
