import { clsx } from "clsx";

/**
 * Flat vector interpretation of the client's globe + highway mark.
 * TODO: replace with the original vector file from Ken's designer when available.
 */
export function LogoMark({ className, title = "Global Runners Logistics" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title} fill="none">
      <defs>
        <clipPath id="grl-globe">
          <circle cx="50" cy="50" r="41" />
        </clipPath>
        <clipPath id="grl-outer">
          <circle cx="50" cy="50" r="46.5" />
        </clipPath>
        <mask id="grl-road-dash">
          <rect width="100" height="100" fill="white" />
          <path
            d="M27 97 C 44 76, 64 62, 97 56"
            stroke="black"
            strokeWidth="2.6"
            strokeDasharray="5 5"
            fill="none"
          />
        </mask>
      </defs>
      <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="5" />
      <g clipPath="url(#grl-globe)" stroke="currentColor" strokeWidth="3.6">
        <ellipse cx="50" cy="50" rx="19" ry="44" />
        <line x1="50" y1="2" x2="50" y2="98" />
        <path d="M6 30 Q 50 22 94 30" />
        <path d="M4 56 Q 50 50 96 56" />
      </g>
      {/* road: separation stroke in background color, then the road surface */}
      <path
        d="M14 100 C 36 72, 62 54, 100 47 L 100 64 C 72 68, 52 82, 42 100 Z"
        fill="currentColor"
        stroke="var(--logo-bg, #0a1220)"
        strokeWidth="4"
        paintOrder="stroke"
        mask="url(#grl-road-dash)"
        clipPath="url(#grl-outer)"
      />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-3 text-white", className)}>
      <LogoMark className="h-9 w-9 shrink-0 text-silver md:h-10 md:w-10" />
      {!compact && (
        <span className="flex flex-col text-[0.8rem] font-semibold uppercase leading-[1.05] tracking-[0.06em] md:text-[0.9rem]">
          <span>Global Runners</span>
          <span>Logistics LLC</span>
        </span>
      )}
    </span>
  );
}
