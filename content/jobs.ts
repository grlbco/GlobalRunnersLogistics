import { company, fleet, hiring, pay } from "./facts";

export type Job = {
  slug: string;
  title: string;
  short: string;
  driverType: "Team" | "Solo";
  runType: string;
  summary: string;
  highlights: { k: string; v: string }[];
  route: string;
  /** ISO date the posting went live. Update when the role is re-posted. */
  datePosted: string;
  /** Postings expire for Google for Jobs; renew or remove (docs/plan/06). */
  validThrough: string;
};

const common = [
  { k: "Equipment", v: `${fleet.makes.join(" / ")} · ${fleet.transmission}` },
  { k: "Trailer", v: fleet.trailer },
  { k: "Pay", v: `${pay.type}, paid ${pay.schedule.toLowerCase()} every ${pay.payday}` },
  { k: "Layover pay", v: `$${pay.layover}` },
  { k: "Anniversary bonus", v: `$${pay.anniversaryBonus.toLocaleString()} every year` },
  { k: "Truck home", v: hiring.takeTruckHome ? "Yes" : "No" },
];

export const jobs: Job[] = [
  {
    slug: "team-cdl-a-otr-las-vegas",
    title: "Team CDL-A Truck Driver — OTR Dry Van",
    short: "Team CDL-A · OTR",
    driverType: "Team",
    runType: "OTR (48 states)",
    summary: `Run coast-to-coast dry van freight as a team out of ${company.yard.city}, NV. Our main lane is ${fleet.mainLane.from} to ${fleet.mainLane.to}, mostly ${fleet.freight.toLowerCase()} — consistent loads, ${fleet.loading.join(" and ").toLowerCase()}, and a dedicated dispatcher who gets you home on time.`,
    highlights: [{ k: "Run type", v: "OTR, 48 states" }, { k: "Main lane", v: "NV ↔ GA" }, ...common],
    route: "Nevada ↔ Georgia and 48-state OTR",
    datePosted: "2026-11-03",
    validThrough: "2027-01-31",
  },
  {
    slug: "solo-cdl-a-regional-las-vegas",
    title: "Solo CDL-A Truck Driver — Regional Dry Van",
    short: "Solo CDL-A · Regional",
    driverType: "Solo",
    runType: "Regional",
    summary: `Drive solo on regional dry van runs out of ${company.yard.city}, NV. Automatic Peterbilt 579s and Freightliner Cascadias with APU, inverter, fridge and microwave, weekly pay every Thursday, and dispatch in English and Spanish around the clock.`,
    highlights: [{ k: "Run type", v: "Regional" }, { k: "Start point", v: hiring.pickup }, ...common],
    route: "Regional lanes from Henderson, NV",
    datePosted: "2026-11-03",
    validThrough: "2027-01-31",
  },
  {
    slug: "solo-cdl-a-dedicated-las-vegas",
    title: "Solo CDL-A Truck Driver — Dedicated Dry Van",
    short: "Solo CDL-A · Dedicated",
    driverType: "Solo",
    runType: "Dedicated",
    summary: `Run the same dedicated dry van lanes week after week. Consistent freight, no wait time, drop & hook and live loads, and a dispatcher who knows your schedule — based out of ${company.yard.city}, NV.`,
    highlights: [{ k: "Run type", v: "Dedicated" }, { k: "Start point", v: hiring.pickup }, ...common],
    route: "Dedicated lanes from Henderson, NV",
    datePosted: "2026-11-03",
    validThrough: "2027-01-31",
  },
];

export const requirements = [
  `Valid ${hiring.license} license`,
  `At least ${hiring.minAge} years old`,
  `${hiring.minExperience} experience (no new CDL school graduates)`,
  hiring.mvr,
  "No DUI",
  "Clean drug and alcohol history (no failed or refused tests, no SAP program)",
  hiring.backgroundCheck,
  hiring.english,
  hiring.workAuthorization,
];

export const whatYouGet = [
  "Weekly pay — pay period Monday to Monday, paid every Thursday",
  `$${pay.layover} layover pay`,
  `$${pay.anniversaryBonus.toLocaleString()} bonus on every work anniversary`,
  "Dedicated dispatcher, 24/7, English and Spanish",
  "Automatic trucks with APU, inverter, fridge and microwave",
  "Road-facing dash cam only — no driver-facing camera",
  "Take the truck home",
  "Riders and pets allowed",
  "Travel to orientation paid for drivers who live far away",
  `${hiring.orientationDays}-day orientation, first load in about 2 weeks`,
];

export const getJob = (slug: string) => jobs.find((j) => j.slug === slug);
