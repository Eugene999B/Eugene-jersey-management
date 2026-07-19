"use client";

import { Download, RotateCcw, Shirt, Type } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

function svgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function DesignStudio() {
  const [baseColor, setBaseColor] = useState("#0f766e");
  const [accentColor, setAccentColor] = useState("#f97316");
  const [playerName, setPlayerName] = useState("MENSAH");
  const [playerNumber, setPlayerNumber] = useState("10");
  const [sponsor, setSponsor] = useState("ACCRA PRO");
  const [view, setView] = useState<"front" | "back">("back");

  const svg = useMemo(() => {
    const safeSponsor = svgText(sponsor);
    const safePlayerName = svgText(playerName);
    const safePlayerNumber = svgText(playerNumber);
    const frontText = `<text x="200" y="250" text-anchor="middle" font-size="24" font-weight="700" fill="#ffffff">${safeSponsor}</text>`;
    const backText = `
      <text x="200" y="210" text-anchor="middle" font-size="34" font-weight="700" fill="#ffffff">${safePlayerName}</text>
      <text x="200" y="305" text-anchor="middle" font-size="96" font-weight="800" fill="#ffffff">${safePlayerNumber}</text>
    `;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520">
      <rect width="400" height="520" fill="#f6f4ef"/>
      <path d="M112 78 L160 42 L200 70 L240 42 L288 78 L350 132 L309 188 L282 164 L282 460 L118 460 L118 164 L91 188 L50 132 Z" fill="${baseColor}" stroke="#111827" stroke-width="4"/>
      <path d="M160 42 C175 86 225 86 240 42 L218 94 L182 94 Z" fill="${accentColor}"/>
      <path d="M118 164 L282 164" stroke="${accentColor}" stroke-width="10"/>
      <path d="M118 410 L282 410" stroke="${accentColor}" stroke-width="14"/>
      ${view === "front" ? frontText : backText}
    </svg>`;
  }, [accentColor, baseColor, playerName, playerNumber, sponsor, view]);

  function downloadSvg() {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jersey-${view}-${playerName || "design"}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <Shirt size={18} className="text-[var(--shop-primary)]" />
          <h2 className="text-lg font-semibold">Jersey designer</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Base</span>
              <input className="field h-12" type="color" value={baseColor} onChange={(event) => setBaseColor(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Accent</span>
              <input className="field h-12" type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-semibold"><Type size={15} /> Player name</span>
            <input className="field" value={playerName} onChange={(event) => setPlayerName(event.target.value.toUpperCase())} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Number</span>
            <input className="field" value={playerNumber} onChange={(event) => setPlayerNumber(event.target.value.slice(0, 3))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Sponsor or crest text</span>
            <input className="field" value={sponsor} onChange={(event) => setSponsor(event.target.value.toUpperCase())} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["front", "back"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                className={`rounded-[8px] px-3 py-2 text-sm font-semibold ${view === item ? "bg-[var(--shop-primary)] text-white" : "bg-white text-slate-700"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => {
              setBaseColor("#0f766e");
              setAccentColor("#f97316");
              setPlayerName("MENSAH");
              setPlayerNumber("10");
              setSponsor("ACCRA PRO");
            }}>
              <RotateCcw size={16} /> Reset
            </Button>
            <Button onClick={downloadSvg}>
              <Download size={16} /> SVG
            </Button>
          </div>
        </div>
      </section>

      <section className="panel min-h-[620px] overflow-hidden bg-white">
        <div className="border-b border-[#ded8cd] p-4">
          <h2 className="font-semibold">Production canvas</h2>
          <p className="mt-1 text-sm text-slate-500">Export SVG for printing, cutting, sublimation prep, or machine-specific conversion.</p>
        </div>
        <div className="flex items-center justify-center p-5">
          <div className="w-full max-w-[520px]" dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      </section>
    </div>
  );
}
