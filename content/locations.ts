/**
 * Hiring-area pages (pSEO). Only areas Ken actually hires from (Nevada).
 * Distances/drive times are approximate city-center figures to the Henderson yard;
 * refine once the yard street address is confirmed (docs/plan/00).
 */
export type Place = {
  slug: string;
  city: string;
  region: "NV";
  milesToYard: number;
  minutesToYard: number;
  highways: string[];
  intro: string;
  geo: { lat: number; lng: number };
};

export const places: Place[] = [
  {
    slug: "las-vegas-nv",
    city: "Las Vegas",
    region: "NV",
    milesToYard: 16,
    minutesToYard: 20,
    highways: ["I-15", "I-215", "US-95"],
    intro: "Our office is downtown on S 6th St, and the Henderson yard is a short drive down I-215 or US-95.",
    geo: { lat: 36.1699, lng: -115.1398 },
  },
  {
    slug: "henderson-nv",
    city: "Henderson",
    region: "NV",
    milesToYard: 0,
    minutesToYard: 0,
    highways: ["I-11", "I-215", "US-95"],
    intro: "Henderson is home base — this is where you pick up your truck and where orientation happens.",
    geo: { lat: 36.0395, lng: -114.9817 },
  },
  {
    slug: "north-las-vegas-nv",
    city: "North Las Vegas",
    region: "NV",
    milesToYard: 24,
    minutesToYard: 28,
    highways: ["I-15", "I-215", "US-95"],
    intro: "From North Las Vegas, the yard is an easy run south on I-15 to I-215.",
    geo: { lat: 36.1989, lng: -115.1175 },
  },
  {
    slug: "boulder-city-nv",
    city: "Boulder City",
    region: "NV",
    milesToYard: 12,
    minutesToYard: 15,
    highways: ["I-11", "US-93"],
    intro: "Boulder City drivers are minutes from the yard straight up I-11.",
    geo: { lat: 35.9786, lng: -114.8325 },
  },
  {
    slug: "pahrump-nv",
    city: "Pahrump",
    region: "NV",
    milesToYard: 70,
    minutesToYard: 75,
    highways: ["NV-160", "I-15"],
    intro: "Pahrump drivers come over NV-160. Since you can take the truck home, the commute only happens at the start and end of a run.",
    geo: { lat: 36.2083, lng: -115.9839 },
  },
  {
    slug: "mesquite-nv",
    city: "Mesquite",
    region: "NV",
    milesToYard: 95,
    minutesToYard: 90,
    highways: ["I-15"],
    intro: "Mesquite sits right on I-15 — the same interstate many of our loads run on.",
    geo: { lat: 36.8055, lng: -114.0672 },
  },
  {
    slug: "laughlin-nv",
    city: "Laughlin",
    region: "NV",
    milesToYard: 90,
    minutesToYard: 90,
    highways: ["NV-163", "US-95"],
    intro: "Laughlin drivers head north on US-95 to the Henderson yard.",
    geo: { lat: 35.1678, lng: -114.5730 },
  },
];

export const getPlace = (slug: string) => places.find((p) => p.slug === slug);
