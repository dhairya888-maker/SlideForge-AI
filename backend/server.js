import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const promptTemplate = `You are a social media content expert.

Convert the idea into a 5-slide Instagram carousel.

Structure:
- Slide 1: Hook (attention-grabbing)
- Slide 2-4: Explanation
- Slide 5: Key takeaway

Each slide must include:
- Title (short)
- Content (2-3 lines, simple language)
- Image keyword (single word or short phrase for visual theme)

Return ONLY JSON:
[
 { "title": "...", "content": "...", "image": "..." }
]`;

function normalizeSlides(rawSlides) {
  if (!Array.isArray(rawSlides)) {
    throw new Error("AI response is not a valid slide list.");
  }

  const slides = rawSlides.slice(0, 5).map((slide, index) => ({
    title: String(slide?.title || `Slide ${index + 1}`).trim(),
    content: String(slide?.content || "").trim(),
    image: String(slide?.image || "education").trim(),
  }));

  while (slides.length < 5) {
    slides.push({
      title: `Slide ${slides.length + 1}`,
      content: "Add your point here.",
      image: "education",
    });
  }

  return slides;
}

app.post("/generate", async (req, res) => {
  const { idea, format } = req.body ?? {};

  if (!idea || typeof idea !== "string" || !idea.trim()) {
    return res.status(400).json({ error: "Idea is required." });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "OpenRouter API key is missing in backend env." });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${promptTemplate}

Output schema:
{ "slides": [{ "title": "string", "content": "string", "image": "string" }] }`,
        },
        {
          role: "user",
          content: `Idea: ${idea.trim()}
Format preference: ${format || "Post"}`,
        },
      ],
    });

    const rawContent = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(rawContent);
    const slides = normalizeSlides(parsed.slides);
    return res.json(slides);
  } catch (error) {
    console.error("Generation error:", error);
    return res.status(500).json({ error: "Failed to generate slides. Please retry." });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`SlideForge backend running on http://localhost:${port}`);
});
