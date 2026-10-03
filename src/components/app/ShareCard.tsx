"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CARD_H, CARD_W, drawShareCard, shareText, type ShareCardData } from "@/lib/shareCard";

/** Button that opens a preview of a shareable position card with save, copy and post actions. */
export function ShareButton({ data, className = "", label = "Share" }: { data: ShareCardData; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={className} aria-label="Share this position as an image">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" />
        </svg>
        {label && <span>{label}</span>}
      </button>
      <AnimatePresence>{open && <ShareModal data={data} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function ShareModal({ data, onClose }: { data: ShareCardData; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (canvasRef.current) drawShareCard(canvasRef.current, data, { hideAmounts });
  }, [data, hideAmounts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toBlob = () => new Promise<Blob | null>((resolve) => canvasRef.current?.toBlob((b) => resolve(b), "image/png") ?? resolve(null));

  const save = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `atomic-${data.symbol.toLowerCase()}-position.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    setNote("Saved to your downloads");
  };

  const copy = async () => {
    const blob = await toBlob();
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setNote("Image copied, paste it into your post");
    } catch {
      setNote("Copy is blocked in this browser, use Save instead");
    }
  };

  const post = async () => {
    await copy();
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(shareText(data))}`, "_blank", "noopener");
  };

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-bg/85 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="card w-full max-w-3xl p-4 md:p-5"
        initial={{ y: 16, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Share this position</div>
          <button onClick={onClose} className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-muted hover:border-line-2">close</button>
        </div>
        <canvas ref={canvasRef} width={CARD_W} height={CARD_H} className="block h-auto w-full rounded-xl border border-line" />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={post} className="btn-flash rounded-full px-5 py-2.5 text-sm">Copy image and post on X</button>
          <button onClick={save} className="btn-ghost rounded-full px-5 py-2.5 text-sm">Save image</button>
          <button onClick={copy} className="btn-ghost rounded-full px-5 py-2.5 text-sm">Copy image</button>
          <label className="ml-auto flex cursor-pointer items-center gap-2 font-mono text-[11px] text-muted">
            <input type="checkbox" checked={hideAmounts} onChange={(e) => setHideAmounts(e.target.checked)} className="accent-current" />
            hide dollar amounts
          </label>
        </div>
        <p className="mt-3 min-h-[1rem] font-mono text-[11px] text-muted-2">{note ?? "The image is made in your browser. Nothing is uploaded."}</p>
      </motion.div>
    </motion.div>
  );
}
