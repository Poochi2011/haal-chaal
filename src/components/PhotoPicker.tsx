"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Avatar } from "./bits";
import type { Parent } from "@/lib/types";

/** Shrinks a picked image to a 320 px square JPEG data URL (kept on this device). */
async function toSquareDataUrl(file: File, size = 320): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoPicker({ parent, onChange }: { parent: Parent; onChange: (photo: string | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} className="group relative shrink-0" aria-label="Upload a photo">
        <Avatar parent={parent} className="h-20 w-20 border-2 border-white shadow" textClass="text-2xl" />
        <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-navy text-white shadow ring-2 ring-white transition group-hover:scale-110">
          <Camera className="h-4 w-4" />
        </span>
      </button>
      <div className="min-w-0">
        <button type="button" onClick={() => input.current?.click()} className="text-[15px] font-semibold text-iris">
          {parent.photo ? "Change photo" : "Add a photo"}
        </button>
        {parent.photo && (
          <button type="button" onClick={() => onChange(undefined)} className="ml-3 inline-flex items-center gap-1 text-[14px] text-muted hover:text-alarm">
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        )}
        <p className="text-[13px] text-muted">Optional. Shown on your dashboard only; stays on this device.</p>
        {error && <p className="text-[13px] text-alarm">{error}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (!f.type.startsWith("image/")) { setError("Please choose an image file."); return; }
          try { setError(null); onChange(await toSquareDataUrl(f)); } catch { setError("That image couldn't be read. Try another one."); }
        }}
      />
    </div>
  );
}
