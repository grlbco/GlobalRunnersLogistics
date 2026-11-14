/**
 * Single source of truth for company facts.
 * Mirrors docs/plan/00-company-facts.md. Only values marked safe to publish live here.
 * Items awaiting confirmation are kept in `pending` and must not be rendered.
 */
export const company = {
  legalName: "Global Runners Logistics LLC",
  shortName: "Global Runners Logistics",
  domain: "globalrunnerslogistics.com",
  url: "https://globalrunnerslogistics.com",
  foundedYear: 2015,
  owner: "Ken Aman",
  phone: { display: "(844) 456-7861", vanity: "844-GLORUN1", e164: "+18444567861" }, // 844-GLORUN1 toll-free (updated 2026-11-14)
  /** Quo line used only to SEND automated SMS (A2P). Not shown publicly. */
  smsSender: "+17256661558",
  email: "dev@grlbco.com", // TODO: switch to a public inbox (e.g. drive@globalrunnerslogistics.com) once Resend domain verifies
  office: {
    street: "732 S 6th St, Ste V",
    city: "Las Vegas",
    region: "NV",
    postalCode: "89101",
    country: "US",
  },
  yard: { city: "Henderson", region: "NV" },
  timeZone: "Pacific Time",
} as const;

export const fleet = {
  trucks: 30,
  drivers: 25,
  makes: ["Peterbilt 579", "Freightliner Cascadia", "Kenworth T680"],
  transmission: "Automatic",
  extras: ["APU", "Inverter", "Fridge", "Microwave", "Road-facing & side cameras only"],
  trailer: "53' dry van",
  freight: "Electronics",
  loading: ["Drop & hook", "Live load / unload"],
  runTypes: ["OTR (48 states)", "Regional", "Dedicated"],
  mainLane: { from: "Nevada", to: "Georgia" },
} as const;

export const hiring = {
  license: "CDL-A",
  driverTypes: ["Solo", "Team"],
  hireFromStates: ["Nevada"],
  pickup: "Henderson, NV",
  takeTruckHome: true,
  orientationTravelPaid: true,
  minAge: 21,
  minExperience: "1 year verifiable OTR/regional experience within the past 3 years, or 2 years verifiable experience within the past 5 years",
  newGrads: false,
  mvr: "No more than 3 moving violations in the last 3 years",
  disqualifiers: ["DUI", "Failed or refused drug test / SAP program"],
  backgroundCheck: "No felony convictions in the past 7 years",
  accidents: "No DOT recordable/preventable accidents in the past 12 months",
  english: "Basic English (road signs, DOT, dispatch)",
  dispatchLanguages: ["English", "Español"],
  workAuthorization: "Authorized to work in the U.S.",
  ridersAndPets: true,
  orientationDays: 1,
  timeToFirstLoad: "Next day after orientation",
  dedicatedDispatcher: true,
  callbackPromise: "Within 1 hour",
} as const;

export const pay = {
  type: "Per mile",
  schedule: "Weekly",
  payday: "Friday",
  payPeriod: "Monday to Monday",
  /** Weekly guaranteed minimum or rate per mile, whichever is greater. */
  guarantee: {
    team: { weekly: "$2,000–$2,300", cpm: "$0.80–$0.90" },
    solo: { weekly: "$1,500–$1,700", cpm: "$0.60–$0.70" },
  },
  workersComp: "Workers' compensation insurance available from day one",
  anniversaryBonus: 1000,
} as const;

/** Waiting on Ken. Never render these. */
export const pending = {
  avgWeeklyMiles: 6000,
  avgWeeklyGross: 2600,
  homeTime: "4 days home (per how many weeks?)",
  speedLimiter: "80 / 85 (looks wrong)",
  hazmat: "required or preferred?",
  mcNumber: null,
  usdotNumber: null,
} as const;

/** One-line pay summary used across pages, schema, llms.txt and the assistant. */
export const guaranteeLine = `Weekly guaranteed minimum or rate per mile, whichever is greater — Team: ${pay.guarantee.team.weekly}/week, ${pay.guarantee.team.cpm}/mile; Solo: ${pay.guarantee.solo.weekly}/week, ${pay.guarantee.solo.cpm}/mile`;
