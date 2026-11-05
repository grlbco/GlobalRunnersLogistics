import { company, fleet, hiring, pay } from "@/content/facts";
import { requirements, whatYouGet } from "@/content/jobs";

/**
 * The ONLY facts the assistant may state. Built from content/facts.ts (confirmed values).
 * Anything in `pending` (pay rates, home time, hazmat…) is deliberately absent.
 */
export const OFFER_FACTS = [
  `Company: ${company.legalName}, a family-run CDL-A trucking company in ${company.office.city}, NV, hauling since ${company.foundedYear}. Owner: ${company.owner}.`,
  `Fleet: ${fleet.trucks} trucks: ${fleet.makes.join(" and ")}, all ${fleet.transmission.toLowerCase()}, with ${fleet.extras.join(", ")}.`,
  `Trailer/freight: ${fleet.trailer}, mostly ${fleet.freight.toLowerCase()}; ${fleet.loading.join(" and ").toLowerCase()}.`,
  `Runs: ${fleet.runTypes.join(", ")}. Main lane ${fleet.mainLane.from} ↔ ${fleet.mainLane.to}.`,
  `Trucks start from the yard in ${company.yard.city}, NV. Drivers can take the truck home.`,
  `Hiring: CDL-A solo and team company drivers, and owner-operators.`,
  `Pay: ${pay.type.toLowerCase()}, paid ${pay.schedule.toLowerCase()} every ${pay.payday} (pay period ${pay.payPeriod}). $${pay.layover} layover pay. $${pay.anniversaryBonus.toLocaleString()} bonus on every work anniversary.`,
  `The exact per-mile rate is NOT confirmed in writing: Ken goes over the rate on the phone call, never state a cents-per-mile, weekly or yearly number.`,
  `What drivers get: ${whatYouGet.map((x) => x.replace(/\s*[—–]\s*/g, ", ")).join(". ")}.`,
  `Requirements: ${requirements.join(". ")}.`,
  `Orientation: ${hiring.orientationDays} day in Henderson, NV; first load in ${hiring.timeToFirstLoad.toLowerCase()}. Travel to orientation paid for drivers who live far away.`,
  `Dispatch: dedicated dispatcher, 24/7, in ${hiring.dispatchLanguages.join(" and ")}.`,
  `Home time: drivers can take the truck home. The exact home-time schedule is not confirmed in writing, Ken goes over it on the call.`,
  `Ken (owner) calls drivers himself, usually within the hour during the day (Pacific time). Ken's number: ${company.phone.display}.`,
].join("\n");

/** Numbers the assistant may write (from the facts above), plus small everyday numbers. */
export function allowedNumbers(extra: string[] = []): Set<string> {
  const text = OFFER_FACTS + " " + extra.join(" ");
  const nums = new Set<string>(["1", "2", "3", "4", "5", "10", "15", "30", "60"]);
  for (const m of text.matchAll(/\d[\d,.]*/g)) nums.add(m[0].replace(/[,.]$/, "").replace(/,/g, ""));
  return nums;
}
