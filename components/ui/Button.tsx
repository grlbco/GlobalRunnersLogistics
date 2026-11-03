import Link from "next/link";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost";

const base =
  "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[4px] px-6 h-12 text-[0.95rem] font-medium tracking-[-0.01em] transition-colors duration-300 ease-house select-none";

const variants: Record<Variant, string> = {
  primary: "bg-signal text-white hover:text-white",
  outline: "border border-white/25 text-white hover:border-white",
  ghost: "text-white/80 hover:text-white px-0 h-auto",
};

/** Fill that sweeps in from the left on hover. */
function Sweep({ variant }: { variant: Variant }) {
  if (variant === "ghost") return null;
  return (
    <span
      aria-hidden
      className={clsx(
        "absolute inset-0 -z-0 origin-left scale-x-0 transition-transform duration-500 ease-house group-hover:scale-x-100",
        variant === "primary" ? "bg-signal-ink" : "bg-white/10",
      )}
    />
  );
}

export function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={clsx("h-4 w-4", className)} fill="none" aria-hidden>
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

type Props = {
  href: string;
  variant?: Variant;
  children: ReactNode;
  arrow?: boolean;
  className?: string;
} & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;

export function ButtonLink({ href, variant = "primary", children, arrow, className, ...rest }: Props) {
  return (
    <Link href={href} className={twMerge(clsx(base, variants[variant], className))} {...rest}>
      <Sweep variant={variant} />
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
        {arrow && <Arrow className="transition-transform duration-300 ease-house group-hover:translate-x-1" />}
      </span>
    </Link>
  );
}
