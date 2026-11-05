import Image from "next/image";
import Link from "next/link";
import { clsx } from "clsx";

/** GRL mark on a black tile with a thick light outline. Inverts in dark mode. */
export function BrandTile({ href, size = "md" }: { href?: string; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-14 w-14 rounded-[17px]" : "h-11 w-11 rounded-[13px]";
  const px = size === "lg" ? 34 : 28;
  const tile = (
    <span className={clsx("flex items-center justify-center bg-fg shadow-[0_0_0_3px_var(--color-line-strong)]", box)}>
      <Image src="/brand/mark-white.png" alt="" width={px} height={px} loading="eager" className="dark:hidden" style={{ width: px, height: px }} />
      <Image src="/brand/mark-navy.png" alt="" width={px} height={px} className="hidden dark:block" style={{ width: px, height: px }} />
    </span>
  );
  return href ? <Link href={href} aria-label="Dashboard" className="rounded-[13px] transition-transform duration-150 active:scale-95">{tile}</Link> : tile;
}
