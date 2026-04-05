"use client";

import {
  Download,
  User,
  Scissors,
  Image,
  Layers,
  Palette,
} from "lucide-react";

type ExportType = "all" | "characters" | "cutouts" | "raw" | "composed" | "brand_kit";

interface DownloadOption {
  type: ExportType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface DownloadKitProps {
  requestId: string;
  token: string;
  hasAssets: boolean;
}

const options: DownloadOption[] = [
  {
    type: "all",
    label: "Full Package",
    icon: <Download size={18} />,
    description: "Everything as ZIP",
  },
  {
    type: "characters",
    label: "Characters Only",
    icon: <User size={18} />,
    description: "Base character images",
  },
  {
    type: "cutouts",
    label: "Cutouts",
    icon: <Scissors size={18} />,
    description: "Transparent PNGs",
  },
  {
    type: "raw",
    label: "Raw Images",
    icon: <Image size={18} />,
    description: "No overlay",
  },
  {
    type: "composed",
    label: "Composed Finals",
    icon: <Layers size={18} />,
    description: "Complete creatives",
  },
  {
    type: "brand_kit",
    label: "Brand Kit",
    icon: <Palette size={18} />,
    description: "Logos, colors, specs",
  },
];

export default function DownloadKit({ requestId, token, hasAssets }: DownloadKitProps) {
  function handleDownload(type: ExportType) {
    const url = `/api/export/${requestId}?type=${type}&token=${token}`;
    window.open(url, "_blank");
  }

  if (!hasAssets) return null;

  return (
    <div className="card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        Download Kit
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {options.map((opt) => (
          <button
            key={opt.type}
            onClick={() => handleDownload(opt.type)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white hover:bg-[var(--muted)] hover:border-[#d4d4d4] transition-all cursor-pointer text-center group"
          >
            <span className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">
              {opt.icon}
            </span>
            <span className="text-xs font-medium text-[var(--foreground)]">
              {opt.label}
            </span>
            <span className="text-[12px] text-[var(--muted-foreground)] leading-tight">
              {opt.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
