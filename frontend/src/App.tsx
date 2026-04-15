import { saveAs } from "file-saver";
import JSZip from "jszip";
import { useMemo, useState } from "react";

type Slide = {
  title: string;
  content: string;
  topic: string;
  background_prompt: string;
  design_style: "modern" | "educational" | "historical" | "playful";
  layout: "center" | "split" | "highlight" | "quote";
};

const API_URL = import.meta.env.VITE_API_URL;
console.log("API URL:", API_URL);
type FormatType = "Post" | "Story" | "Carousel";
type LayoutVariant = "centered" | "split" | "highlight" | "quote";
type UiTheme = "Dark" | "Light";
const LAYOUT_VARIANTS: LayoutVariant[] = ["centered", "split", "highlight", "quote"];
const FORMAT_OPTIONS: FormatType[] = ["Post", "Story", "Carousel"];

async function generateSlides(idea: string, format: string, numberOfSlides: number): Promise<Slide[]> {
  if (!API_URL) {
    throw new Error("VITE_API_URL is not set. Check environment variables.");
  }

  const response = await fetch(`${API_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, format, number_of_slides: numberOfSlides }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate carousel. Please try again.");
  }

  const data = (await response.json()) as Slide[];
  return data.map((slide) => ({
    title: slide.title,
    content: slide.content,
    topic: slide.topic || "General",
    background_prompt:
      slide.background_prompt ||
      `Beautiful ${slide.design_style || "modern"} social media visual about ${slide.topic || "education"}`,
    design_style: slide.design_style || "modern",
    layout: slide.layout || "center",
  }));
}

function hashString(input: string) {
  return input.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function getLayoutVariant(slide: Slide, index: number): LayoutVariant {
  if (slide.layout === "center") return "centered";
  const seed = hashString(`${slide.title}${slide.topic}${slide.design_style}${index}`);
  const mapped: LayoutVariant =
    slide.layout === "split"
      ? "split"
      : slide.layout === "highlight"
        ? "highlight"
        : slide.layout === "quote"
          ? "quote"
          : "centered";
  return mapped || LAYOUT_VARIANTS[seed % LAYOUT_VARIANTS.length];
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

function buildPollinationsUrl(slide: Slide, format: FormatType) {
  const ratioHint = format === "Story" ? "vertical 9:16 composition" : "square 1:1 composition";
  const prompt = `${slide.background_prompt}, ${slide.topic}, ${slide.design_style} style, ${ratioHint}, clean composition, premium social media design, no text`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function App() {
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState<FormatType>("Carousel");
  const [numberOfSlides, setNumberOfSlides] = useState(5);
  const [uiTheme, setUiTheme] = useState<UiTheme>("Dark");
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
        const lastIndex = slides.length - 1;
        const secondLastIndex = Math.max(0, slides.length - 2);
        const displayTag =
          format === "Carousel"
            ? index === 0
              ? "Hook"
              : index === lastIndex
                ? "Takeaway"
                : index === secondLastIndex
                  ? "Solution"
                  : `Point ${index}`
            : format;

        return {
          ...slide,
          layout,
          imageUrl: buildPollinationsUrl(slide, format),
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
      const slideCount = format === "Post" ? 1 : numberOfSlides;
      const generatedSlides = await generateSlides(idea, format, slideCount);
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
      const slideCount = format === "Post" ? 1 : numberOfSlides;
      const regeneratedSlides = await generateSlides(idea, format, slideCount);
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
    <main
      className={
        uiTheme === "Dark"
          ? "min-h-screen text-white"
          : "min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 text-slate-900"
      }
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-4xl space-y-5 pt-2 text-center sm:space-y-6">
          <p
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
              uiTheme === "Dark"
                ? "border-violet-400/30 bg-violet-500/10 text-violet-200"
                : "border-violet-300/50 bg-violet-100 text-violet-700"
            }`}
          >
            AI Social Media Studio
          </p>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">
            SlideForge AI
            <span className="block bg-gradient-to-r from-violet-300 via-purple-200 to-orange-200 bg-clip-text text-transparent">
              Premium Carousel Creator
            </span>
          </h1>
          <p
            className={`mx-auto max-w-2xl text-base leading-relaxed sm:text-xl ${
              uiTheme === "Dark" ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Turn rough ideas into high-converting, beautifully designed carousel stories in seconds.
          </p>
        </header>

        <section className={`glass rounded-3xl p-6 sm:p-10 ${uiTheme === "Light" ? "bg-white/75" : ""}`}>
          <div className="space-y-5">
            <textarea
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              placeholder="e.g. Explain why kids forget math and how spaced repetition helps"
              className={`h-44 w-full resize-none rounded-3xl border px-6 py-5 text-sm outline-none backdrop-blur-sm transition-all sm:text-base ${
                uiTheme === "Dark"
                  ? "border-slate-500/40 bg-slate-900/55 text-white placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/20"
                  : "border-slate-300 bg-white/75 text-slate-900 placeholder:text-slate-500 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/20"
              }`}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value as FormatType)}
                  className={`w-full rounded-xl border px-4 py-2 text-sm font-medium outline-none backdrop-blur-sm transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 sm:w-40 ${
                    uiTheme === "Dark"
                      ? "border-slate-500/40 bg-slate-900/55 text-slate-100"
                      : "border-slate-300 bg-white/75 text-slate-800"
                  }`}
                >
                  {FORMAT_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm ${uiTheme === "Dark" ? "border-slate-500/40 bg-slate-900/55" : "border-slate-300 bg-white/75"}`}>
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${uiTheme === "Dark" ? "text-slate-300" : "text-slate-600"}`}>
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
                <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm ${uiTheme === "Dark" ? "border-slate-500/40 bg-slate-900/55" : "border-slate-300 bg-white/75"}`}>
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${uiTheme === "Dark" ? "text-slate-300" : "text-slate-600"}`}>
                    Slides
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={numberOfSlides}
                    onChange={(event) =>
                      setNumberOfSlides(Math.min(10, Math.max(1, Number(event.target.value) || 1)))
                    }
                    disabled={format === "Post"}
                    className={`w-16 rounded-md border px-2 py-1 text-sm ${
                      uiTheme === "Dark"
                        ? "border-slate-500/40 bg-slate-800 text-slate-100"
                        : "border-slate-300 bg-white text-slate-800"
                    }`}
                  />
                </div>
                <div className={`flex rounded-xl border p-1 ${uiTheme === "Dark" ? "border-slate-500/40 bg-slate-900/55" : "border-slate-300 bg-white/75"}`}>
                  {(["Dark", "Light"] as UiTheme[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setUiTheme(mode)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        uiTheme === mode
                          ? "bg-gradient-to-r from-violet-500 to-orange-500 text-white"
                          : uiTheme === "Dark"
                            ? "text-slate-300"
                            : "text-slate-700"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="pressable inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 via-purple-500 to-orange-500 px-8 text-sm font-semibold text-white shadow-lg shadow-violet-900/50 transition-all duration-300 hover:scale-[1.04] hover:shadow-xl hover:shadow-orange-900/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate Content
              </button>
            </div>
          </div>
        </section>

        {isLoading && (
          <section className="glass flex items-center gap-3 rounded-2xl p-4">
            <div className="spinner h-5 w-5 rounded-full border-2 border-violet-300/20 border-t-violet-300" />
            <p className="text-sm font-medium text-slate-200">✨ Crafting your content...</p>
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
                  className={`fade-in slide-card shrink-0 snap-start overflow-hidden rounded-3xl border p-4 shadow-lg ${
                    format === "Story" ? "w-[290px]" : "w-[350px]"
                  } ${uiTheme === "Dark" ? "border-slate-600/40 bg-slate-900/60" : "border-slate-200 bg-white/80"}`}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="relative overflow-hidden rounded-2xl">
                    <div
                      className="pointer-events-none absolute inset-0 z-10"
                      style={{
                        background: `linear-gradient(160deg, ${primaryColor}66 0%, transparent 35%, ${secondaryColor}80 100%)`,
                      }}
                    />
                    <div className={`pointer-events-none absolute inset-0 z-10 ${uiTheme === "Dark" ? "bg-gradient-to-t from-black/85 via-black/35 to-black/15" : "bg-gradient-to-t from-white/55 via-white/15 to-transparent"}`} />
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      className={`${format === "Story" ? "aspect-[9/16]" : "aspect-square"} w-full rounded-2xl object-cover shadow-md`}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 z-20 flex flex-col justify-end p-5">
                      <div className="pointer-events-none absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10 blur-sm" />
                      <div className="pointer-events-none absolute -left-4 top-1/2 h-16 w-16 rounded-full bg-white/10 blur-sm" />
                      <div className="mb-2 flex items-center justify-between">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${uiTheme === "Dark" ? "bg-white/20 text-white" : "bg-slate-900/10 text-slate-800"}`}>
                          {slide.displayTag}
                        </span>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${uiTheme === "Dark" ? "bg-violet-500/30 text-violet-100" : "bg-violet-100 text-violet-700"}`}>
                          {slide.design_style}
                        </span>
                      </div>
                      <h3
                        className={`mb-2 line-clamp-3 font-extrabold leading-tight ${uiTheme === "Dark" ? "text-white" : "text-slate-900"} ${
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
                        className={`line-clamp-4 leading-relaxed ${uiTheme === "Dark" ? "text-slate-100" : "text-slate-800"} ${
                          format === "Story" ? "text-base" : "text-sm"
                        } ${slide.layout === "quote" ? "italic" : ""}`}
                      >
                        {slide.content}
                      </p>
                      <div className={`mt-3 flex items-center justify-between text-xs ${uiTheme === "Dark" ? "text-slate-200/90" : "text-slate-700"}`}>
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
