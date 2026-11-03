import Image from "next/image";
import { clsx } from "clsx";
import logoWhite from "@/public/brand/logo-white.png";
import logoNavy from "@/public/brand/logo-navy.png";
import markWhite from "@/public/brand/mark-white.png";

/**
 * Official Global Runners Logistics LLC logo — the client's supplied artwork, recolored only
 * (white for dark backgrounds, navy for light). Never redraw or regenerate it.
 */
export function Logo({ className, tone = "light", priority = false }: { className?: string; tone?: "light" | "dark"; priority?: boolean }) {
  return (
    <Image
      src={tone === "light" ? logoWhite : logoNavy}
      alt="Global Runners Logistics LLC"
      priority={priority}
      sizes="200px"
      className={clsx("h-8 w-auto md:h-10", className)}
    />
  );
}

/** The round globe-and-road mark from the same artwork. */
export function LogoMark({ className }: { className?: string; title?: string }) {
  return <Image src={markWhite} alt="" aria-hidden sizes="64px" className={clsx("h-12 w-auto", className)} />;
}
