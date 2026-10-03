import { useId } from "react";
/**
 * ATOMIC brand marks. Every mark is a 64x64 viewBox that inherits `currentColor` for the
 * primary shape and uses `accent` for the highlight, so the same component works on any tile.
 */
export interface MarkProps { size?: number; accent?: string; className?: string; title?: string }

/** Sphere: an outlined sphere with one orbit ring, the flat version of the reference logo. `accent` is the knockout colour behind the sphere. */
export function MarkSphere({ size = 32, accent = "var(--bg)", className = "", title = "ATOMIC" }: MarkProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role="img" aria-label={title}>
      <defs>
        <clipPath id={id}>
          <rect x="-40" y="0" width="80" height="40" transform="translate(32.0 32.0) rotate(-24.0)" />
        </clipPath>
      </defs>
      <ellipse cx="32.0" cy="32.0" rx="29.5" ry="10.0" transform="rotate(-24.0 32.0 32.0)" stroke="currentColor" strokeWidth="4.0" />
      <circle cx="32.0" cy="32.0" r="14.5" fill={accent} stroke="currentColor" strokeWidth="4.0" />
      <ellipse cx="32.0" cy="32.0" rx="29.5" ry="10.0" transform="rotate(-24.0 32.0 32.0)" stroke="currentColor" strokeWidth="4.0" clipPath={`url(#${id})`} />
    </svg>
  );
}

/** Fold: a folded ribbon A with a dot and a leaf, traced from the reference the user chose. */
export function MarkFold({ size = 32, className = "", title = "ATOMIC" }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor" className={className} role="img" aria-label={title}>
      <path d="M 28.49 6.02 L 27.56 6.69 L 25.84 8.54 L 24.78 10.53 L 23.72 12.12 L 23.45 12.78 L 22.39 14.37 L 21.99 15.30 L 20.80 17.16 L 20.01 18.75 L 19.74 19.01 L 18.81 20.87 L 22.66 20.73 L 22.79 20.87 L 23.72 20.87 L 23.85 21.00 L 24.78 21.13 L 25.97 21.53 L 27.96 22.59 L 30.08 24.58 L 31.14 26.17 L 44.52 53.07 L 45.58 54.66 L 47.04 56.25 L 49.03 57.71 L 50.75 58.51 L 52.08 58.77 L 52.21 58.90 L 52.87 58.90 L 53.01 59.04 L 54.99 59.04 L 55.13 58.90 L 55.66 58.90 L 56.19 58.64 L 56.58 58.64 L 57.65 58.11 L 59.24 56.92 L 59.77 56.12 L 60.03 55.99 L 60.69 54.66 L 60.96 53.87 L 60.96 53.34 L 61.09 53.21 L 61.09 51.35 L 60.96 51.22 L 60.96 50.55 L 60.56 49.36 L 59.50 47.64 L 59.37 47.11 L 54.86 38.23 L 54.60 37.96 L 52.08 32.80 L 51.81 32.53 L 51.81 32.27 L 51.28 31.47 L 51.15 30.94 L 50.89 30.67 L 49.96 28.69 L 49.69 28.42 L 47.97 24.84 L 47.71 24.58 L 47.71 24.31 L 47.44 24.05 L 46.25 21.53 L 45.98 21.26 L 44.26 17.69 L 43.99 17.42 L 39.36 8.41 L 38.43 7.22 L 37.50 6.42 L 36.17 5.63 L 34.58 5.10 L 34.05 5.10 L 33.92 4.96 L 31.40 4.96 L 29.55 5.49 Z" />
      <circle cx="20.55" cy="30.20" r="6.48" />
      <path d="M 34.05 39.16 L 25.44 39.16 L 25.31 39.29 L 21.20 39.29 L 21.07 39.42 L 19.61 39.42 L 19.48 39.55 L 18.68 39.55 L 18.55 39.69 L 17.22 39.82 L 17.09 39.95 L 15.63 40.22 L 13.78 40.88 L 11.79 41.81 L 8.61 43.93 L 6.35 46.18 L 5.03 48.04 L 3.97 49.89 L 3.04 52.54 L 2.91 53.87 L 3.04 54.00 L 3.17 55.06 L 3.44 55.59 L 4.23 56.52 L 5.56 57.31 L 5.96 57.31 L 6.49 57.58 L 7.15 57.58 L 7.28 57.71 L 9.40 57.71 L 9.54 57.58 L 10.99 57.45 L 14.04 56.25 L 15.90 55.06 L 18.28 52.81 L 22.13 47.51 L 22.92 46.58 L 26.10 43.53 L 29.28 41.28 L 31.01 40.48 L 31.54 40.08 Z" />
    </svg>
  );
}

/** Tri: three glass-cut blades chasing each other around a triangle, the borrow, swap, repay loop. */
export function MarkTri({ size = 32, className = "", title = "ATOMIC" }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor" className={className} role="img" aria-label={title}>
      <polygon points="10.6,14.2 32.0,1.8 47.2,10.6 51.9,19.0 39.7,17.6 32.0,13.1 30.1,14.2" />
      <polygon points="59.7,25.1 59.7,49.8 44.6,58.6 34.9,58.5 42.2,48.6 49.9,44.1 49.9,41.9" />
      <polygon points="25.7,62.2 4.3,49.8 4.3,32.3 9.2,24.0 14.1,35.3 14.1,44.1 16.0,45.3" />
    </svg>
  );
}

/** A: the borrow, swap, repay loop drawn as a closed arrow that reads as the letter A. */
export function MarkLoop({ size = 32, accent = "var(--flash)", className = "", title = "ATOMIC" }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role="img" aria-label={title}>
      <path d="M12 52 L32 10 L52 52" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M52 52 H31" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M38 44 L30 52 L38 60" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="25" y="34" width="14" height="6.5" rx="3.25" fill={accent} />
    </svg>
  );
}

/** B: one block, five segments, the middle one lit. The transaction visualizer as a glyph. */
export function MarkBlock({ size = 32, accent = "var(--flash)", className = "", title = "ATOMIC" }: MarkProps) {
  const bars = [22, 34, 44, 30, 18];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role="img" aria-label={title}>
      <rect x="6" y="6" width="52" height="52" rx="14" stroke="currentColor" strokeWidth="5" />
      {bars.map((h, i) => (
        <rect key={i} x={15 + i * 7.5} y={46 - h} width="5" height={h} rx="2.5" fill={i === 2 ? accent : "currentColor"} opacity={i === 2 ? 1 : 0.55} />
      ))}
    </svg>
  );
}

/** C: a block nucleus with a single orbit, the atomic idea drawn literally. */
export function MarkOrbit({ size = 32, accent = "var(--flash)", className = "", title = "ATOMIC" }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role="img" aria-label={title}>
      <ellipse cx="32" cy="32" rx="27" ry="11" transform="rotate(-28 32 32)" stroke="currentColor" strokeWidth="4.5" />
      <rect x="22" y="22" width="20" height="20" rx="6" fill="currentColor" />
      <circle cx="53.5" cy="18.5" r="5" fill={accent} />
    </svg>
  );
}

/** D: a bolt cut into a solid block, the fastest read at small sizes. */
export function MarkBolt({ size = 32, accent = "var(--flash)", className = "", title = "ATOMIC" }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role="img" aria-label={title}>
      <rect x="4" y="4" width="56" height="56" rx="16" fill={accent} />
      <path d="M35 10 L18 36 H31 L28 54 L46 27 H33 Z" fill="currentColor" />
    </svg>
  );
}

export const MARKS = {
  sphere: { key: "sphere", label: "Sphere", note: "outlined sphere with one orbit ring", Mark: MarkSphere },
  fold: { key: "fold", label: "Fold", note: "a folded ribbon A with a dot and a leaf", Mark: MarkFold },
  tri: { key: "tri", label: "Tri", note: "three blades chasing each other around a triangle", Mark: MarkTri },
  loop: { key: "loop", label: "Loop A", note: "borrow, swap, repay closed into an A", Mark: MarkLoop },
  block: { key: "block", label: "One block", note: "five steps inside one block, middle lit", Mark: MarkBlock },
  orbit: { key: "orbit", label: "Orbit", note: "block nucleus with a single orbit", Mark: MarkOrbit },
  bolt: { key: "bolt", label: "Bolt block", note: "bolt cut into a solid tile", Mark: MarkBolt },
} as const;
export type MarkKey = keyof typeof MARKS;
