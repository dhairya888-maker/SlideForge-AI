import { saveAs } from "file-saver";
import JSZip from "jszip";
import { useMemo, useState } from "react";

type Slide = {
  title: string;
  content: string;
};

type Theme = "Minimal" | "Gradient" | "Dark";
type LayoutStyle = "centered" | "split" | "highlight" | "quote";

const API_URL = import.meta.env.VITE_API_URL;
console.log("API URL:", API_URL);
const LAYOUTS: LayoutStyle[] = ["centered", "split", "highlight", "quote"];
const THEME_OPTIONS: Theme[] = ["Minimal", "Gradient", "Dark"];

async function generateSlides(idea: string, format: string): Promise<Slide[]> {
  if (!API_URL) {
    throw new Error("VITE_API_URL is not set. Check environment variables.");
  }

  const response = await fetch(`${API_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, format }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate carousel. Please try again.");
  }

  const data = (await response.json()) as Slide[];
  return data.slice(0, 5);
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";
  let wordIndex = 0;

  while (wordIndex < words.length) {
    const word = words[wordIndex];
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine;
      wordIndex += 1;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      if (lines.length >= maxLines) {
        currentLine = "";
        break;
      }
      currentLine = "";
      continue;
    }

    let chunk = "";
    for (const char of word) {
      const attempt = chunk + char;
      if (ctx.measureText(attempt).width <= maxWidth) {
        chunk = attempt;
      } else {
        break;
      }
    }

    const safeChunk = chunk || word.charAt(0);
    lines.push(safeChunk);
    if (lines.length >= maxLines) {
      currentLine = "";
      break;
    }

    words[wordIndex] = word.slice(safeChunk.length);
    if (!words[wordIndex]) {
      wordIndex += 1;
    }
  }

  if (currentLine && lines.length < maxLines) lines.push(currentLine);
  return lines.slice(0, maxLines);
}

function fitTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  startSize: number,
  minSize: number,
  weight: number,
) {
  let fontSize = startSize;
  let lines: string[] = [];

  while (fontSize >= minSize) {
    ctx.font = `${weight} ${fontSize}px Inter, sans-serif`;
    lines = wrapTextLines(ctx, text, maxWidth, maxLines);
    const tooWide = lines.some((line) => ctx.measureText(line).width > maxWidth);
    const linesWithinLimit =
      lines.length < maxLines ||
      (lines.length === maxLines &&
        wrapTextLines(ctx, text, maxWidth, maxLines + 1).length <= maxLines);
    if (!tooWide && linesWithinLimit) break;
    fontSize -= 2;
  }

  return { lines, fontSize };
}

function drawThemeBackground(ctx: CanvasRenderingContext2D, theme: Theme) {
  if (theme === "Minimal") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 500, 500);
    ctx.strokeStyle = "rgba(17, 17, 17, 0.08)";
    for (let i = 0; i < 10; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, i * 56);
      ctx.lineTo(500, i * 56);
      ctx.stroke();
    }
    return;
  }

  if (theme === "Dark") {
    const darkGradient = ctx.createLinearGradient(0, 0, 500, 500);
    darkGradient.addColorStop(0, "#09090b");
    darkGradient.addColorStop(1, "#111827");
    ctx.fillStyle = darkGradient;
    ctx.fillRect(0, 0, 500, 500);
    ctx.fillStyle = "rgba(34, 211, 238, 0.16)";
    ctx.fillRect(0, 360, 500, 140);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, 500, 500);
  gradient.addColorStop(0, "#7c3aed");
  gradient.addColorStop(0.55, "#5b4ee6");
  gradient.addColorStop(1, "#3b82f6");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 500, 500);
}

function drawDecorativeShapes(ctx: CanvasRenderingContext2D, theme: Theme) {
  if (theme === "Minimal") {
    ctx.strokeStyle = "rgba(17, 17, 17, 0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(420, 90, 58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(90, 420, 42, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (theme === "Dark") {
    ctx.fillStyle = "rgba(34, 211, 238, 0.2)";
    ctx.beginPath();
    ctx.arc(430, 90, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(168, 85, 247, 0.2)";
    ctx.beginPath();
    ctx.arc(70, 440, 120, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.beginPath();
  ctx.arc(420, 85, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(75, 430, 135, 0, Math.PI * 2);
  ctx.fill();
}

function pickKeyword(slide: Slide) {
  const source = `${slide.title} ${slide.content}`.replace(/[^\w\s]/g, "");
  return source.split(/\s+/).filter((word) => word.length > 4)[0]?.toUpperCase() ?? "IMPACT";
}

function drawSlideLayout(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  slideNumber: number,
  theme: Theme,
  layout: LayoutStyle,
) {
  const darkText = "#111111";
  const lightText = "#ffffff";
  const accent = theme === "Dark" ? "#22d3ee" : theme === "Minimal" ? "#111111" : "#c4b5fd";
  const primaryText = theme === "Minimal" ? darkText : lightText;
  const secondaryText = theme === "Minimal" ? "rgba(17, 17, 17, 0.8)" : "rgba(255, 255, 255, 0.9)";

  const titleBlock = fitTextLines(ctx, slide.title, 390, 2, 44, 28, 700);
  const contentBlock = fitTextLines(ctx, slide.content, 390, 3, 24, 18, 500);
  const titleLines = titleBlock.lines;
  const contentLines = contentBlock.lines;
  const icon = layout === "quote" ? "✦" : layout === "highlight" ? "⚡" : "●";

  ctx.textAlign = "center";

  if (layout === "centered") {
    ctx.fillStyle = theme === "Minimal" ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.1)";
    ctx.fillRect(40, 120, 420, 260);
    ctx.fillStyle = primaryText;
    ctx.font = `700 ${titleBlock.fontSize}px Inter, sans-serif`;
    let y = 190;
    for (const line of titleLines) {
      ctx.fillText(line, 250, y);
      y += Math.round(titleBlock.fontSize * 1.2);
    }
    ctx.fillStyle = secondaryText;
    ctx.font = `500 ${contentBlock.fontSize}px Inter, sans-serif`;
    y += 12;
    for (const line of contentLines) {
      ctx.fillText(line, 250, y);
      y += Math.round(contentBlock.fontSize * 1.4);
    }
  } else if (layout === "split") {
    ctx.fillStyle = theme === "Minimal" ? "rgba(17,17,17,0.06)" : "rgba(255,255,255,0.14)";
    ctx.fillRect(44, 265, 412, 170);
    ctx.fillStyle = primaryText;
    const splitTitle = fitTextLines(ctx, slide.title, 390, 2, 42, 26, 700);
    ctx.font = `700 ${splitTitle.fontSize}px Inter, sans-serif`;
    let y = 135;
    for (const line of splitTitle.lines) {
      ctx.fillText(line, 250, y);
      y += Math.round(splitTitle.fontSize * 1.2);
    }
    ctx.fillStyle = secondaryText;
    const splitContent = fitTextLines(ctx, slide.content, 360, 3, 23, 17, 500);
    ctx.font = `500 ${splitContent.fontSize}px Inter, sans-serif`;
    y = 330;
    for (const line of splitContent.lines) {
      ctx.fillText(line, 250, y);
      y += Math.round(splitContent.fontSize * 1.35);
    }
  } else if (layout === "highlight") {
    const keyword = pickKeyword(slide);
    ctx.fillStyle = accent;
    const keywordSize = Math.max(42, 88 - keyword.length * 2);
    ctx.font = `800 ${keywordSize}px Inter, sans-serif`;
    ctx.fillText(keyword, 250, 220);

    ctx.fillStyle = primaryText;
    const highlightTitle = fitTextLines(ctx, slide.title, 390, 1, 34, 22, 700);
    ctx.font = `700 ${highlightTitle.fontSize}px Inter, sans-serif`;
    ctx.fillText(highlightTitle.lines[0] ?? slide.title, 250, 285);
    ctx.fillStyle = secondaryText;
    const summaryText = fitTextLines(ctx, slide.content, 370, 2, 22, 17, 500);
    ctx.font = `500 ${summaryText.fontSize}px Inter, sans-serif`;
    const summary = summaryText.lines;
    let y = 335;
    for (const line of summary) {
      ctx.fillText(line, 250, y);
      y += Math.round(summaryText.fontSize * 1.35);
    }
  } else {
    ctx.fillStyle = theme === "Minimal" ? "rgba(17,17,17,0.08)" : "rgba(255,255,255,0.13)";
    ctx.fillRect(68, 105, 364, 288);
    ctx.fillStyle = primaryText;
    const quoteBlock = fitTextLines(ctx, `"${slide.content}"`, 320, 4, 30, 18, 700);
    ctx.font = `700 ${quoteBlock.fontSize}px Inter, sans-serif`;
    const quoteLines = quoteBlock.lines;
    let y = 185;
    for (const line of quoteLines) {
      ctx.fillText(line, 250, y);
      y += Math.round(quoteBlock.fontSize * 1.25);
    }
    ctx.fillStyle = secondaryText;
    const author = fitTextLines(ctx, `- ${slide.title}`, 330, 1, 24, 16, 600);
    ctx.font = `600 ${author.fontSize}px Inter, sans-serif`;
    ctx.fillText(author.lines[0] ?? `- ${slide.title}`, 250, 390);
  }

  ctx.fillStyle = accent;
  ctx.font = "700 28px Inter, sans-serif";
  ctx.fillText(icon, 58, 66);
  ctx.fillText(icon, 442, 66);

  ctx.fillStyle = theme === "Minimal" ? "rgba(17,17,17,0.14)" : "rgba(255,255,255,0.2)";
  ctx.fillRect(184, 446, 132, 34);
  ctx.fillStyle = primaryText;
  ctx.font = "600 20px Inter, sans-serif";
  ctx.fillText(`${slideNumber}/5`, 250, 469);
}

function generateSlideImage(slide: Slide, slideNumber: number, theme: Theme, layout: LayoutStyle): string {
  const canvas = document.createElement("canvas");
  canvas.width = 500;
  canvas.height = 500;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  drawThemeBackground(ctx, theme);
  drawDecorativeShapes(ctx, theme);
  drawSlideLayout(ctx, slide, slideNumber, theme, layout);
  return canvas.toDataURL("image/png");
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function getLayoutForSlide(slide: Slide, index: number): LayoutStyle {
  const seed = `${slide.title}${slide.content}${index}`
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  return LAYOUTS[seed % LAYOUTS.length];
}

function App() {
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState("Post");
  const [theme, setTheme] = useState<Theme>("Gradient");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");

  const canGenerate = idea.trim().length > 0 && !isLoading;

  const allSlidesText = useMemo(
    () => slides.map((slide, index) => `Slide ${index + 1}: ${slide.title}\n${slide.content}`).join("\n\n"),
    [slides],
  );

  const renderedSlides = useMemo(
    () =>
      slides.map((slide, index) => {
        const layout = getLayoutForSlide(slide, index);
        return {
          ...slide,
          layout,
          imageUrl: generateSlideImage(slide, index + 1, theme, layout),
        };
      }),
    [slides, theme],
  );

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setError("");
    setIsLoading(true);
    try {
      const generatedSlides = await generateSlides(idea, format);
      setSlides(generatedSlides);
    } catch (generationError) {
      setError(
        generationError instanceof Error ? generationError.message : "Something went wrong. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async (index: number) => {
    if (!idea.trim()) return;
    setError("");
    setRegeneratingIndex(index);
    try {
      const regeneratedSlides = await generateSlides(idea, format);
      setSlides((currentSlides) =>
        currentSlides.map((slide, slideIndex) =>
          slideIndex === index ? (regeneratedSlides[index] ?? slide) : slide,
        ),
      );
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Could not regenerate this slide.");
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleCopyAll = async () => {
    if (!allSlidesText) return;
    await navigator.clipboard.writeText(allSlidesText);
  };

  const handleDownloadSlide = (index: number, imageUrl: string) => {
    downloadDataUrl(imageUrl, `slide-${index + 1}.png`);
  };

  const handleDownloadCarousel = async () => {
    if (renderedSlides.length === 0 || isPreparingDownload) return;
    setIsPreparingDownload(true);
    try {
      const zip = new JSZip();
      for (let index = 0; index < renderedSlides.length; index += 1) {
        const blob = await dataUrlToBlob(renderedSlides[index].imageUrl);
        zip.file(`slide-${index + 1}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, "slideforge-carousel.zip");
    } catch {
      setError("Could not prepare download. Please try again.");
    } finally {
      setIsPreparingDownload(false);
    }
  };

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="inline-flex rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
            AI Social Media Studio
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            SlideForge AI
            <span className="block bg-gradient-to-r from-violet-300 via-purple-200 to-orange-200 bg-clip-text text-transparent">
              Premium Carousel Creator
            </span>
          </h1>
          <p className="text-base text-slate-300 sm:text-lg">
            Turn rough ideas into high-converting, beautifully designed social slides in seconds.
          </p>
        </header>

        <section className="glass rounded-3xl p-5 sm:p-8">
          <div className="space-y-5">
            <textarea
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              placeholder="e.g. Explain why kids forget math and how spaced repetition helps"
              className="h-44 w-full resize-none rounded-3xl border border-slate-500/40 bg-slate-900/55 px-5 py-4 text-sm text-white outline-none backdrop-blur-sm transition-all placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/20 sm:text-base"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value)}
                  className="w-full rounded-xl border border-slate-500/40 bg-slate-900/55 px-4 py-2 text-sm font-medium text-slate-100 outline-none backdrop-blur-sm transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 sm:w-40"
                >
                  <option>Post</option>
                  <option>Story</option>
                </select>
                <div className="flex rounded-xl border border-slate-500/40 bg-slate-900/55 p-1 shadow-sm">
                  {THEME_OPTIONS.map((themeOption) => (
                    <button
                      key={themeOption}
                      onClick={() => setTheme(themeOption)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        theme === themeOption
                          ? "bg-gradient-to-r from-violet-500 to-orange-500 text-white shadow-md"
                          : "text-slate-300 hover:text-violet-300"
                      }`}
                    >
                      {themeOption}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="pressable inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 via-purple-500 to-orange-500 px-8 text-sm font-semibold text-white shadow-lg shadow-violet-900/50 transition-all duration-300 hover:scale-[1.04] hover:shadow-xl hover:shadow-orange-900/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate Carousel
              </button>
            </div>
          </div>
        </section>

        {isLoading && (
          <section className="glass flex items-center gap-3 rounded-2xl p-4">
            <div className="spinner h-5 w-5 rounded-full border-2 border-violet-300/20 border-t-violet-300" />
            <p className="text-sm font-medium text-slate-200">✨ Crafting your slides...</p>
          </section>
        )}

        {error && <section className="rounded-xl border border-red-400/35 bg-red-500/10 p-3 text-sm text-red-200">{error}</section>}

        {slides.length > 0 && (
          <section className="glass space-y-4 rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white sm:text-2xl">Generated Carousel</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyAll}
                  className="pressable rounded-lg border border-slate-500/40 bg-slate-900/50 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-violet-400 hover:text-violet-200"
                >
                  Copy all content
                </button>
                <button
                  onClick={handleDownloadCarousel}
                  disabled={isPreparingDownload}
                  className="pressable rounded-lg border border-slate-500/40 bg-slate-900/50 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-violet-400 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPreparingDownload ? "Preparing download..." : "Download Carousel"}
                </button>
              </div>
            </div>

            <div className="horizontal-carousel flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2">
              {renderedSlides.map((slide, index) => (
                <article
                  key={`${slide.title}-${index}`}
                  className="fade-in slide-card w-[338px] shrink-0 snap-start overflow-hidden rounded-3xl border border-slate-600/40 bg-slate-900/60 p-3 shadow-lg"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="relative overflow-hidden rounded-2xl">
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                    <img src={slide.imageUrl} alt={slide.title} className="aspect-square w-full rounded-2xl object-cover shadow-md" />
                  </div>
                  <div className="flex items-center justify-between px-2 pb-2 pt-3">
                    <span className="text-sm font-medium text-slate-300 capitalize">{slide.layout} layout</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadSlide(index, slide.imageUrl)}
                        className="pressable rounded-lg border border-slate-500/40 bg-slate-900/50 px-3 py-2 text-sm font-medium text-slate-200 transition-all duration-200 hover:border-violet-400 hover:text-violet-200"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleRegenerate(index)}
                        disabled={regeneratingIndex === index}
                        className="pressable rounded-lg border border-slate-500/40 bg-slate-900/50 px-3 py-2 text-sm font-medium text-slate-200 transition-all duration-200 hover:border-violet-400 hover:text-violet-200 disabled:opacity-50"
                      >
                        {regeneratingIndex === index ? "Regenerating..." : "Regenerate"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default App;
