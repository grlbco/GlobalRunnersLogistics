const en = {
  meta: {
    title: "Global Runners Logistics — CDL-A Truck Driving Jobs in Las Vegas, NV",
    description:
      "Now hiring CDL-A solo and team drivers in Las Vegas and Henderson, NV. 53' dry van, consistent runs, weekly pay every Thursday, 24/7 dispatch in English and Spanish.",
  },
  nav: {
    drive: "Drive",
    driveItems: {
      company: { label: "Company drivers", hint: "Solo and team CDL-A jobs" },
      team: { label: "Team drivers", hint: "OTR team runs, NV to GA" },
      solo: { label: "Solo drivers", hint: "Regional and dedicated" },
      pay: { label: "Pay & home time", hint: "Weekly pay, Thursday payday" },
      requirements: { label: "Requirements", hint: "What you need to apply" },
    },
    ownerOperators: "Owner-operators",
    about: "About",
    locations: "Locations",
    contact: "Contact",
    login: "Log in",
    apply: "Apply now",
    menu: "Menu",
    close: "Close",
    call: "Call",
  },
  hero: {
    eyebrow: "Now hiring CDL-A · Las Vegas, NV",
    titleLines: ["Your road.", "Your future.", "Our family."],
    sub: "Drive for a Las Vegas fleet that keeps you moving: consistent runs, weekly pay, 24/7 dispatch, and home time you can plan around.",
    primary: "Apply now",
    secondary: "See pay",
  },
  proof: [
    { k: "Nationwide freight", v: "48 states" },
    { k: "Consistent runs", v: "NV ↔ GA" },
    { k: "Experienced drivers", v: "1 yr+ CDL-A" },
    { k: "24/7 dispatch", v: "English & Español" },
  ],
  footer: {
    tagline: "CDL-A solo and team jobs out of Las Vegas, Nevada. Hauling since 2012.",
    columns: {
      drivers: "Drivers",
      company: "Company",
      legal: "Legal",
    },
    links: {
      jobs: "Open positions",
      apply: "Apply now",
      pay: "Pay & home time",
      requirements: "Requirements",
      owners: "Owner-operators",
      about: "About us",
      locations: "Locations",
      contact: "Contact",
      faq: "FAQ",
      privacy: "Privacy policy",
      terms: "Terms",
      sms: "SMS terms",
      eeo: "Equal opportunity",
    },
    office: "Office",
    yard: "Truck yard",
    hours: "Dispatch 24/7 · Office hours Pacific Time",
    rights: "All rights reserved.",
  },
  stub: {
    soon: "This page is being built.",
    back: "Back to home",
  },
} as const;

export default en;
export type Dictionary = DeepString<typeof en>;
type DeepString<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly DeepString<U>[]
    : { [K in keyof T]: DeepString<T[K]> };
