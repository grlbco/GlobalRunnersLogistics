import { clsx } from "clsx";
import type { ReactNode } from "react";
import { RevealLines, Reveal } from "@/components/motion/Reveal";

/** Standard section wrapper with the editorial index label ("01 — NAME"). */
export function Section({
  id,
  index,
  label,
  title,
  intro,
  tone = "dark",
  children,
  className,
}: {
  id?: string;
  index?: string;
  label?: string;
  title?: readonly string[];
  intro?: ReactNode;
  tone?: "dark" | "navy" | "light";
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={clsx(
        "relative scroll-mt-24 py-24 md:py-36",
        tone === "light" && "bg-fog text-ink",
        tone === "navy" && "bg-navy",
        className,
      )}
    >
      <div className="container-site">
        {(label || title) && (
          <header className="grid grid-cols-1 gap-8 md:grid-cols-12">
            {label && (
              <Reveal className="md:col-span-3">
                <p className={clsx("label", tone === "light" ? "text-ink/50" : "text-white/45")}>
                  {index && `${index} — `}
                  {label}
                </p>
              </Reveal>
            )}
            <div className={clsx(label ? "md:col-span-9" : "md:col-span-12")}>
              {title && <RevealLines lines={title} className="h2 block max-w-[20ch]" />}
              {intro && (
                <Reveal delay={0.15}>
                  <div className={clsx("body-lg mt-6 max-w-2xl", tone === "light" ? "text-ink/65" : "text-white/65")}>{intro}</div>
                </Reveal>
              )}
            </div>
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
