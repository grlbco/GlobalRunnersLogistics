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
  foundedYear: 2012,
  owner: "Ken Aman",
  phone: { display: "(725) 666-1558", e164: "+17256661558" },
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
  makes: ["Peterbilt 579", "Freightliner Cascadia"],
  transmission: "Automatic",
  extras: ["APU", "Inverter", "Fridge", "Microwave", "Road-facing dash cam only"],
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
  minExperience: "1 year CDL-A",
  newGrads: false,
  mvr: "No more than 3 moving violations in the last 3 years",
  disqualifiers: ["DUI", "Failed or refused drug test / SAP program"],
  backgroundCheck: "7-year background check",
  english: "Basic English (road signs, DOT, dispatch)",
  dispatchLanguages: ["English", "Español"],
  workAuthorization: "Authorized to work in the U.S.",
  ridersAndPets: true,
  orientationDays: 1,
  timeToFirstLoad: "About 2 weeks",
  dedicatedDispatcher: true,
  callbackPromise: "Within 1 hour",
} as const;

export const pay = {
  type: "Per mile",
  schedule: "Weekly",
  payday: "Thursday",
  payPeriod: "Monday to Monday",
  layover: 250,
  anniversaryBonus: 1000,
} as const;

/** Waiting on Ken. Never render these. */
export const pending = {
  teamCpm: "$0.80–$0.90 per mile? (form said '08 to 90 CPM')",
  weeklyMinimum: 2000,
  avgWeeklyMiles: 6000,
  avgWeeklyGross: 2600,
  homeTime: "4 days home (per how many weeks?)",
  speedLimiter: "80 / 85 (looks wrong)",
  hazmat: "required or preferred?",
  mcNumber: null,
  usdotNumber: null,
} as const;
