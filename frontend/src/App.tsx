import { saveAs } from "file-saver";
import JSZip from "jszip";
import { useMemo, useState } from "react";

type Slide = {
  title: string;
  content: string;
  background_prompt: string;
  topic: string;
  background_keywords: string;
  design_style: "modern" | "educational" | "historical" | "playful";
};

const API_URL = import.meta.env.VITE_API_URL;
console.log("API URL:", API_URL);
type FormatType = "Post" | "Story" | "Carousel";
type LayoutVariant = "centered" | "split" | "highlight" | "quote";
const LAYOUT_VARIANTS: LayoutVariant[] = ["centered", "split", "highlight", "quote"];
const FORMAT_OPTIONS: FormatType[] = ["Post", "Story", "Carousel"];

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
  return data.slice(0, 5).map((slide) => ({
    title: slide.title,
    content: slide.content,
    topic: slide.topic || "General",
    background_prompt:
      slide.background_prompt ||
      `Beautiful ${slide.design_style || "modern"} social media visual about ${slide.topic || "education"}`,
    background_keywords: slide.background_keywords || `${slide.topic || "education"}, social media design`,
    design_style: slide.design_style || "modern",
  }));
}

function hashString(input: string) {
  return input.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function getLayoutVariant(slide: Slide, index: number): LayoutVariant {
  const seed = hashString(`${slide.title}${slide.topic}${slide.design_style}${index}`);
  return LAYOUT_VARIANTS[seed % LAYOUT_VARIANTS.length];
}

function getTopicEmoji(topic: string) {
  const value = topic.toLowerCase();
  if (value.includes("chem")) return "🧪";
  if (value.includes("phys")) return "🚀";
  if (value.includes("math")) return "📐";
  if (value.includes("history")) return "🏛️";
  if (value.includes("kid")) return "🎨";
  return "✨";
}

function getDefaultThemeByTopic(topic: string) {
  const value = topic.toLowerCase();
  if (value.includes("chem")) return { primary: "#7c3aed", secondary: "#14b8a6" };
  if (value.includes("phys")) return { primary: "#2563eb", secondary: "#7c3aed" };
  if (value.includes("math")) return { primary: "#1d4ed8", secondary: "#f59e0b" };
  if (value.includes("history")) return { primary: "#92400e", secondary: "#7c2d12" };
  if (value.includes("kid")) return { primary: "#ec4899", secondary: "#8b5cf6" };
  return { primary: "#7c3aed", secondary: "#2563eb" };
}

function buildUnsplashUrl(slide: Slide, format: FormatType) {
  const dimensions = format === "Story" ? "800x1422" : "800x800";
  const keywords = `${slide.background_keywords}, ${slide.topic}, ${slide.design_style}, social media`;
  return `https://source.unsplash.com/${dimensions}/?${encodeURIComponent(keywords)}`;
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function App() {
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState<FormatType>("Carousel");
  const [primaryColor, setPrimaryColor] = useState("#7c3aed");
  const [secondaryColor, setSecondaryColor] = useState("#2563eb");
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
        const layout = getLayoutVariant(slide, index);
        const displayTag =
          format === "Carousel"
            ? index === 0
              ? "Hook"
              : index === 4
                ? "Takeaway"
                : `Point ${index}`
            : format;

        return {
          ...slide,
          layout,
          imageUrl: buildUnsplashUrl(slide, format),
          displayTag,
          emoji: getTopicEmoji(slide.topic),
        };
      }),
    [slides, format],
  );

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError("Please enter an idea before generating.");
      return;
    }
    if (!canGenerate) return;
    setError("");
    setIsLoading(true);
    try {
      const generatedSlides = await generateSlides(idea, format);
      setSlides(generatedSlides);
      const defaults = getDefaultThemeByTopic(generatedSlides[0]?.topic || "General");
      setPrimaryColor(defaults.primary);
      setSecondaryColor(defaults.secondary);
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

  const handleDownloadSlide = async (index: number, imageUrl: string) => {
    try {
      const blob = await dataUrlToBlob(imageUrl);
      saveAs(blob, `slide-${index + 1}.png`);
    } catch {
      setError("Could not download this slide. Please try again.");
    }
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
        <header className="mx-auto max-w-4xl space-y-5 pt-2 text-center sm:space-y-6">
          <p className="inline-flex rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
            AI Social Media Studio
          </p>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">
            SlideForge AI
            <span className="block bg-gradient-to-r from-violet-300 via-purple-200 to-orange-200 bg-clip-text text-transparent">
              Premium Carousel Creator
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-300 sm:text-xl">
            Turn rough ideas into high-converting, beautifully designed carousel stories in seconds.
          </p>
        </header>

        <section className="glass rounded-3xl p-6 sm:p-10">
          <div className="space-y-5">
            <textarea
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              placeholder="e.g. Explain why kids forget math and how spaced repetition helps"
              className="h-44 w-full resize-none rounded-3xl border border-slate-500/40 bg-slate-900/55 px-6 py-5 text-sm text-white outline-none backdrop-blur-sm transition-all placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/20 sm:text-base"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value as FormatType)}
                  className="w-full rounded-xl border border-slate-500/40 bg-slate-900/55 px-4 py-2 text-sm font-medium text-slate-100 outline-none backdrop-blur-sm transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 sm:w-40"
                >
                  {FORMAT_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 rounded-xl border border-slate-500/40 bg-slate-900/55 px-3 py-2 shadow-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                    Theme
                  </span>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(event) => setPrimaryColor(event.target.value)}
                    className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                    title="Primary color"
                  />
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(event) => setSecondaryColor(event.target.value)}
                    className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                    title="Secondary color"
                  />
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
            <p className="text-sm font-medium text-slate-200">✨ Crafting your carousel...</p>
          </section>
        )}

        {error && <section className="rounded-xl border border-red-400/35 bg-red-500/10 p-3 text-sm text-red-200">{error}</section>}

        {slides.length > 0 && (
          <section className="glass space-y-5 rounded-3xl p-6 sm:p-8">
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
                  className="fade-in slide-card w-[350px] shrink-0 snap-start overflow-hidden rounded-3xl border border-slate-600/40 bg-slate-900/60 p-4 shadow-lg"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="relative overflow-hidden rounded-2xl">
                    <div
                      className="pointer-events-none absolute inset-0 z-10"
                      style={{
                        background: `linear-gradient(160deg, ${primaryColor}66 0%, transparent 35%, ${secondaryColor}80 100%)`,
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/35 to-black/15" />
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="aspect-square w-full rounded-2xl object-cover shadow-md"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 z-20 flex flex-col justify-end p-5">
                      <div className="pointer-events-none absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10 blur-sm" />
                      <div className="pointer-events-none absolute -left-4 top-1/2 h-16 w-16 rounded-full bg-white/10 blur-sm" />
                      <div className="mb-2 flex items-center justify-between">
                        <span className="rounded-full bg-white/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                          {slide.displayTag}
                        </span>
                        <span className="rounded-full bg-violet-500/30 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-100">
                          {slide.design_style}
                        </span>
                      </div>
                      <h3
                        className={`mb-2 line-clamp-3 font-extrabold leading-tight text-white ${
                          slide.layout === "highlight"
                            ? "text-3xl"
                            : slide.layout === "split"
                              ? "text-2xl"
                              : "text-[1.7rem]"
                        }`}
                      >
                        {slide.title}
                      </h3>
                      <p
                        className={`line-clamp-4 leading-relaxed text-slate-100 ${
                          format === "Story" ? "text-base" : "text-sm"
                        } ${slide.layout === "quote" ? "italic" : ""}`}
                      >
                        {slide.content}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-200/90">
                        <span>{slide.emoji} {slide.topic}</span>
                        <span className="capitalize">{slide.layout}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 pb-2 pt-4">
                    <span className="text-sm font-medium text-slate-300 capitalize">AI generated visual</span>
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
