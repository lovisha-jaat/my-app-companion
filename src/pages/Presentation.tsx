import { useState, useEffect, useCallback, useRef } from "react";
import { Scale, ChevronLeft, ChevronRight, Maximize, Minimize } from "lucide-react";

const SLIDE_W = 1920;
const SLIDE_H = 1080;

/* ───────── Scaled Slide Wrapper ───────── */
function ScaledSlide({ children, containerRef }: { children: React.ReactNode; containerRef: React.RefObject<HTMLDivElement> }) {
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.min(width / SLIDE_W, height / SLIDE_H));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return (
    <div
      style={{
        position: "absolute",
        width: SLIDE_W,
        height: SLIDE_H,
        left: "50%",
        top: "50%",
        marginLeft: -SLIDE_W / 2,
        marginTop: -SLIDE_H / 2,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
      className="bg-white text-gray-900 shadow-2xl rounded-lg overflow-hidden"
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SLIDE 1 — System Architecture
   ═══════════════════════════════════════════ */
function Slide1() {
  return (
    <div className="relative w-full h-full p-16 flex flex-col" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #e8f5e9 100%)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#1e3a8a] flex items-center justify-center">
            <Scale className="w-9 h-9 text-white" />
          </div>
          <div>
            <h1 className="text-5xl font-extrabold text-[#1e3a8a] tracking-tight">BharatTrack</h1>
            <p className="text-xl text-gray-500 mt-1">AI-Powered Indian Legal Reference Platform</p>
          </div>
        </div>
        <div className="text-right px-6 py-3 rounded-xl bg-[#1e3a8a]/10 border border-[#1e3a8a]/20">
          <p className="text-lg font-bold text-[#1e3a8a]">System Architecture</p>
        </div>
      </div>

      {/* Main Architecture Grid */}
      <div className="flex-1 grid grid-cols-[280px_1fr_320px] gap-8">
        {/* LEFT — User Roles */}
        <div className="flex flex-col gap-3">
          <div className="text-center py-3 rounded-xl bg-[#d97706] text-white font-bold text-lg mb-1">👥 User Roles</div>
          {[
            { icon: "🧑‍🎓", label: "Law Students", access: "full" },
            { icon: "⚖️", label: "Legal Professionals", access: "full" },
            { icon: "💼", label: "Financial Advisors", access: "full" },
            { icon: "🏛️", label: "Gov Employees", access: "full" },
            { icon: "🔬", label: "Researchers", access: "full" },
            { icon: "🧑‍🤝‍🧑", label: "Citizens", access: "partial" },
          ].map((u, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-white border border-gray-200 px-4 py-3 shadow-sm">
              <span className="text-2xl">{u.icon}</span>
              <span className="font-semibold text-sm flex-1">{u.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${u.access === "full" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {u.access === "full" ? "Full" : "Partial"}
              </span>
            </div>
          ))}
        </div>

        {/* CENTER — Core System */}
        <div className="flex flex-col items-center gap-5">
          {/* Client App */}
          <div className="w-full rounded-2xl bg-[#1e3a8a] text-white p-5 text-center shadow-lg">
            <p className="text-lg font-bold mb-1">⚛️ Frontend — React + TypeScript + Vite</p>
            <p className="text-sm opacity-80">Tailwind CSS • PWA • react-markdown</p>
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-4 bg-[#1e3a8a]" />
            <div className="text-xs font-bold text-[#1e3a8a] bg-blue-50 px-3 py-1 rounded-full border border-[#1e3a8a]/20">🔐 Auth + API Req/Res</div>
            <div className="w-0.5 h-4 bg-[#1e3a8a]" />
          </div>

          {/* Backend */}
          <div className="w-full rounded-2xl bg-[#4f46e5] text-white p-5 text-center shadow-lg">
            <p className="text-lg font-bold mb-1">⚙️ Supabase Edge Functions — Deno Runtime</p>
            <p className="text-sm opacity-80">Classify Query • Generate Response • Process Documents • Search</p>
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-4 bg-[#4f46e5]" />
            <div className="text-xs font-bold text-[#4f46e5] bg-indigo-50 px-3 py-1 rounded-full border border-[#4f46e5]/20">📖 Read / Write</div>
            <div className="w-0.5 h-4 bg-[#4f46e5]" />
          </div>

          {/* Data Layer */}
          <div className="w-full grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[#059669] text-white p-5 text-center shadow-lg">
              <p className="text-lg font-bold">🗄️ PostgreSQL</p>
              <p className="text-xs mt-1 opacity-80">Chat Sessions • Messages<br/>Documents • Bookmarks • Profiles</p>
            </div>
            <div className="rounded-2xl bg-[#ea580c] text-white p-5 text-center shadow-lg">
              <p className="text-lg font-bold">📦 Storage</p>
              <p className="text-xs mt-1 opacity-80">PDF Document Files<br/>User Uploads</p>
            </div>
          </div>

          {/* Core Modules */}
          <div className="w-full grid grid-cols-6 gap-2 mt-2">
            {[
              { icon: "💬", label: "AI Chat" },
              { icon: "📄", label: "Doc Upload" },
              { icon: "⭐", label: "Bookmarks" },
              { icon: "📜", label: "History" },
              { icon: "🔍", label: "Search" },
              { icon: "📂", label: "Categories" },
            ].map((m, i) => (
              <div key={i} className="flex flex-col items-center gap-1 rounded-xl bg-[#0891b2] text-white p-3 shadow-sm">
                <span className="text-2xl">{m.icon}</span>
                <span className="text-[11px] font-bold">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — External Services & Gov Sources */}
        <div className="flex flex-col gap-3">
          <div className="text-center py-3 rounded-xl bg-[#7c3aed] text-white font-bold text-lg mb-1">🔌 External Services</div>
          {[
            { icon: "🔐", label: "Supabase Auth", desc: "Email / Password", color: "bg-green-50 border-green-200" },
            { icon: "🧠", label: "Google Gemini 2.5 Flash", desc: "AI Classification & Generation", color: "bg-red-50 border-red-200" },
            { icon: "🔥", label: "Firecrawl API", desc: "Real-time Web Scraping", color: "bg-amber-50 border-amber-200" },
          ].map((s, i) => (
            <div key={i} className={`rounded-xl border px-4 py-3 shadow-sm ${s.color}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{s.icon}</span>
                <span className="font-bold text-sm">{s.label}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 ml-8">{s.desc}</p>
            </div>
          ))}

          <div className="text-center py-3 rounded-xl bg-[#166534] text-white font-bold text-lg mt-3 mb-1">🏛️ Gov Data Sources</div>
          {[
            { icon: "📜", label: "indiacode.nic.in", desc: "Central & State Acts" },
            { icon: "💰", label: "cbic.gov.in / gst.gov.in", desc: "GST & Indirect Tax" },
            { icon: "🏦", label: "rbi.org.in / sebi.gov.in", desc: "Banking & Securities" },
            { icon: "📋", label: "incometaxindia.gov.in", desc: "Direct Tax & IT Act" },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">{s.icon}</span>
                <span className="font-bold text-xs">{s.label}</span>
              </div>
              <p className="text-[11px] text-gray-500 ml-7">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">🟢 Full Access</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">🟡 Partial Access</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-4 py-1.5 rounded-full bg-[#1e3a8a]/10 text-[#1e3a8a] text-sm font-bold">✅ Zero Hallucination</span>
          <span className="px-4 py-1.5 rounded-full bg-[#1e3a8a]/10 text-[#1e3a8a] text-sm font-bold">📎 Auto Citations</span>
          <span className="px-4 py-1.5 rounded-full bg-[#1e3a8a]/10 text-[#1e3a8a] text-sm font-bold">📱 PWA</span>
          <span className="px-4 py-1.5 rounded-full bg-[#1e3a8a]/10 text-[#1e3a8a] text-sm font-bold">🔒 RLS Security</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SLIDE 2 — AI Workflow Flowchart
   ═══════════════════════════════════════════ */
function Slide2() {
  const arrowDown = (color: string) => (
    <div className="flex flex-col items-center">
      <div className="w-0.5 h-6" style={{ background: color }} />
      <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent" style={{ borderTopColor: color }} />
    </div>
  );

  const arrowRight = (color: string, label?: string) => (
    <div className="flex items-center gap-1">
      <div className="h-0.5 w-8" style={{ background: color }} />
      {label && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border shadow-sm" style={{ color }}>{label}</span>}
      <div className="h-0.5 w-8" style={{ background: color }} />
      <div className="w-0 h-0 border-t-[5px] border-b-[5px] border-l-[7px] border-t-transparent border-b-transparent" style={{ borderLeftColor: color }} />
    </div>
  );

  return (
    <div className="relative w-full h-full p-16 flex flex-col" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fff5f5 100%)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#1e3a8a] flex items-center justify-center">
            <Scale className="w-9 h-9 text-white" />
          </div>
          <div>
            <h1 className="text-5xl font-extrabold text-[#1e3a8a] tracking-tight">BharatTrack</h1>
            <p className="text-xl text-gray-500 mt-1">AI Workflow — RAG Pipeline</p>
          </div>
        </div>
        <div className="text-right px-6 py-3 rounded-xl bg-[#1e3a8a]/10 border border-[#1e3a8a]/20">
          <p className="text-lg font-bold text-[#1e3a8a]">How It Works</p>
        </div>
      </div>

      {/* Workflow */}
      <div className="flex-1 flex flex-col items-center">
        {/* Step 1 */}
        <div className="rounded-2xl bg-[#1e3a8a] text-white px-12 py-5 text-center shadow-lg">
          <p className="text-2xl font-bold">🧑‍💻 User Asks a Question</p>
          <p className="text-sm opacity-80 mt-1">"What is Section 16 of CGST Act?"</p>
        </div>
        {arrowDown("#1e3a8a")}

        {/* Step 2 */}
        <div className="rounded-2xl bg-[#6d28d9] text-white px-12 py-5 text-center shadow-lg">
          <p className="text-2xl font-bold">🧠 Query Classification</p>
          <p className="text-sm opacity-80 mt-1">Google Gemini 2.5 Flash — Detects domain, extracts keywords, identifies intent</p>
        </div>
        {arrowDown("#6d28d9")}

        {/* Step 3 — 3-column retrieval */}
        <div className="w-full grid grid-cols-3 gap-6">
          {/* Priority 1 */}
          <div className="flex flex-col items-center">
            <div className="px-4 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-bold mb-2">🥇 Priority 1</div>
            <div className="rounded-2xl bg-[#059669] text-white p-5 text-center shadow-lg w-full">
              <p className="text-xl font-bold">📂 Local Documents</p>
              <p className="text-sm opacity-80 mt-2">PostgreSQL Full-Text Search</p>
              <p className="text-xs opacity-60 mt-1">User-uploaded government PDFs</p>
            </div>
          </div>
          {/* Priority 2 */}
          <div className="flex flex-col items-center">
            <div className="px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold mb-2">🥈 Priority 2</div>
            <div className="rounded-2xl bg-[#d97706] text-white p-5 text-center shadow-lg w-full">
              <p className="text-xl font-bold">🌐 Web Scraping</p>
              <p className="text-sm opacity-80 mt-2">Firecrawl API — 16+ Gov Domains</p>
              <p className="text-xs opacity-60 mt-1">Real-time official data retrieval</p>
            </div>
          </div>
          {/* Priority 3 */}
          <div className="flex flex-col items-center">
            <div className="px-4 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-bold mb-2">🥉 Priority 3</div>
            <div className="rounded-2xl bg-[#dc2626] text-white p-5 text-center shadow-lg w-full">
              <p className="text-xl font-bold">💡 General Knowledge</p>
              <p className="text-sm opacity-80 mt-2">AI Training Data</p>
              <p className="text-xs opacity-60 mt-1">⚠️ Mandatory disclaimer added</p>
            </div>
          </div>
        </div>

        {arrowDown("#4f46e5")}

        {/* Step 4 */}
        <div className="rounded-2xl bg-[#4f46e5] text-white px-12 py-5 text-center shadow-lg">
          <p className="text-2xl font-bold">✍️ Response Generation</p>
          <p className="text-sm opacity-80 mt-1">Google Gemini 2.5 Flash — Temperature 0.1 — High factual accuracy</p>
        </div>

        {arrowDown("#4f46e5")}

        {/* Step 5 — Verification */}
        <div className="w-full grid grid-cols-3 gap-6">
          <div className="rounded-2xl bg-green-50 border-2 border-green-300 p-5 text-center">
            <p className="text-lg font-bold text-green-700">📂 From Documents</p>
            <p className="text-sm text-green-600 mt-1">✅ Cited with Document Name</p>
          </div>
          <div className="rounded-2xl bg-blue-50 border-2 border-blue-300 p-5 text-center">
            <p className="text-lg font-bold text-blue-700">🏛️ From Gov Sites</p>
            <p className="text-sm text-blue-600 mt-1">✅ Cited with Source URL</p>
          </div>
          <div className="rounded-2xl bg-red-50 border-2 border-red-300 p-5 text-center">
            <p className="text-lg font-bold text-red-700">💡 General Knowledge</p>
            <p className="text-sm text-red-600 mt-1">⚠️ Disclaimer + Official Links</p>
          </div>
        </div>

        {arrowDown("#1e3a8a")}

        {/* Final */}
        <div className="rounded-2xl bg-[#1e3a8a] text-white px-16 py-5 text-center shadow-lg">
          <p className="text-2xl font-bold">💬 Final Answer Displayed to User</p>
          <p className="text-sm opacity-80 mt-1">With citations, sources, and legal references</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PRESENTATION SHELL
   ═══════════════════════════════════════════ */
const slides = [Slide1, Slide2];

export default function Presentation() {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, slides.length - 1)), []);
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape" && document.fullscreenElement) document.exitFullscreen();
      if (e.key === "f" || e.key === "F5") {
        e.preventDefault();
        document.documentElement.requestFullscreen();
      }
    };
    const fsHandler = () => setIsFullscreen(!!document.fullscreenElement);
    window.addEventListener("keydown", handler);
    document.addEventListener("fullscreenchange", fsHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      document.removeEventListener("fullscreenchange", fsHandler);
    };
  }, [next, prev]);

  const SlideComponent = slides[current];

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col select-none">
      {/* Toolbar */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-6 py-3 bg-gray-800 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1e3a8a] flex items-center justify-center">
              <Scale className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">BharatTrack — Presentation</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Slide {current + 1} / {slides.length}</span>
            <button
              onClick={() => document.documentElement.requestFullscreen()}
              className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Slide Canvas */}
      <div
        className="flex-1 relative overflow-hidden"
        ref={containerRef}
      >
        <ScaledSlide containerRef={containerRef}>
          <SlideComponent />
        </ScaledSlide>
      </div>

      {/* Navigation Controls */}
      <div className={`flex items-center justify-center gap-6 py-3 ${isFullscreen ? "absolute bottom-0 left-0 right-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity" : "bg-gray-800"}`}>
        <button onClick={prev} disabled={current === 0} className="p-2 rounded-lg text-white hover:bg-gray-700 disabled:opacity-30 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-3 h-3 rounded-full transition-colors ${i === current ? "bg-white" : "bg-gray-600 hover:bg-gray-400"}`}
          />
        ))}
        <button onClick={next} disabled={current === slides.length - 1} className="p-2 rounded-lg text-white hover:bg-gray-700 disabled:opacity-30 transition-colors">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
