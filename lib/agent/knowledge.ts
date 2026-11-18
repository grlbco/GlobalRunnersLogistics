import { company, fleet, guaranteeLine, hiring, pay } from "@/content/facts";
import { requirements, whatYouGet } from "@/content/jobs";

/**
 * The ONLY facts the assistant may state. Built from content/facts.ts (confirmed values).
 * Anything in `pending` (home time, hazmat…) is deliberately absent.
 */
export const OFFER_FACTS = [
  `Company: ${company.legalName}, a family-run CDL-A trucking company in ${company.office.city}, NV, hauling since ${company.foundedYear}.`,
  `Fleet: ${fleet.trucks} trucks: ${fleet.makes.join(" and ")}, all ${fleet.transmission.toLowerCase()}, with ${fleet.extras.join(", ")}.`,
  `Trailer/freight: ${fleet.trailer}, mostly ${fleet.freight.toLowerCase()}; ${fleet.loading.join(" and ").toLowerCase()}.`,
  `Runs: ${fleet.runTypes.join(", ")}. Main lane ${fleet.mainLane.from} ↔ ${fleet.mainLane.to}.`,
  `Trucks start from the yard in ${company.yard.city}, NV. Drivers can take the truck home.`,
  `Hiring: CDL-A solo and team company drivers ONLY right now. Owner-operator program: coming soon, not open yet (no terms, no pay, no dates to share).`,
  `Pay: ${pay.type.toLowerCase()}, paid ${pay.schedule.toLowerCase()} every ${pay.payday} (pay period ${pay.payPeriod}). ${guaranteeLine} (in words: team 80 to 90 cents a mile, solo 60 to 70 cents a mile). ${pay.workersComp}. $${pay.anniversaryBonus.toLocaleString()} bonus on every work anniversary.`,
  `Only quote the guaranteed minimums and per-mile ranges above, exactly as written. Never invent a yearly number or a single exact rate; the exact rate inside the range depends on the run and our team confirms it on the call.`,
  `What drivers get: ${whatYouGet.map((x) => x.replace(/\s*[—–]\s*/g, ", ")).join(". ")}.`,
  `Requirements: ${requirements.join(". ")}.`,
  `Orientation: ${hiring.orientationDays} day in Henderson, NV; first load the next day. Travel to orientation paid for drivers who live far away.`,
  `Dispatch: dedicated dispatcher, 24/7, in ${hiring.dispatchLanguages.join(" and ")}.`,
  `Home time: drivers can take the truck home. The exact home-time schedule is not confirmed in writing, our team goes over it on the call.`,
  `Someone from our team calls drivers, usually within the hour during the day (Central time). Company phone: ${company.phone.vanity} (${company.phone.display}).`,
].join("\n");

/** Numbers the assistant may write (from the facts above), plus small everyday numbers. */
export function allowedNumbers(extra: string[] = []): Set<string> {
  const text = OFFER_FACTS + " " + extra.join(" ");
  const nums = new Set<string>(["1", "2", "3", "4", "5", "10", "15", "30", "60"]);
  for (const m of text.matchAll(/\d[\d,.]*/g)) nums.add(m[0].replace(/[,.]$/, "").replace(/,/g, ""));
  return nums;
}
