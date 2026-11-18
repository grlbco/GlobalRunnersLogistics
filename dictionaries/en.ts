const en = {
  meta: {
    title: "Global Runners Logistics — CDL-A Truck Driving Jobs in Las Vegas, NV",
    description:
      "Now hiring CDL-A solo and team drivers in Las Vegas and Henderson, NV. 53' dry van, consistent runs, weekly pay every Friday, 24/7 dispatch in English and Spanish.",
  },
  nav: {
    drive: "Drive",
    driveItems: {
      company: { label: "Company drivers", hint: "Solo and team CDL-A jobs" },
      team: { label: "Team drivers", hint: "OTR team runs, NV to GA" },
      solo: { label: "Solo drivers", hint: "Regional and dedicated" },
      pay: { label: "Pay & home time", hint: "Weekly pay, Friday payday" },
      requirements: { label: "Requirements", hint: "What you need to apply" },
    },
    ownerOperators: "Owner-operators (soon)",
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
    { k: "Nationwide dedicated freight", v: "48 states" },
    { k: "Consistent runs", v: "NV ↔ GA" },
    { k: "Experienced drivers", v: "1 yr+ CDL-A" },
    { k: "24/7 dispatch", v: "English & Español" },
  ],
  home: {
    stay: {
      label: "Why drivers stay",
      title: ["Built around the things", "drivers actually care about."],
      intro: "We asked our drivers why they stay. These are their answers, not ours.",
      items: [
        { t: "Pay you can count on", d: "Weekly guaranteed minimum or per-mile pay, whichever is greater — paid every Friday. No games with settlements." },
        { t: "Consistent runs", d: "Steady freight on lanes you get to know. Consistency is what we do better than the big carriers." },
        { t: "No wait time", d: "Planned loads and a dispatcher who stays ahead of the schedule, so you're rolling instead of sitting." },
        { t: "Home on time", d: "Get home straight and early — not late. Home time you can actually plan around." },
      ],
    },
    pay: {
      label: "Pay & home time",
      title: ["Weekly pay.", "Every Friday."],
      intro: "Guaranteed minimum or rate per mile, whichever is greater. Team: $2,000–$2,300 a week, $0.80–$0.90 per mile. Solo: $1,500–$1,700 a week, $0.60–$0.70 per mile.",
      stats: [
        { n: 1500, prefix: "$", suffix: "+", k: "Guaranteed weekly minimum (solo) · team $2,000+" },
        { n: 1000, prefix: "$", suffix: "", k: "Bonus on every work anniversary" },
        { n: 7, prefix: "", suffix: " days", k: "Pay period: Monday to Monday" },
        { n: 24, prefix: "", suffix: "/7", k: "Dispatch, English & Español" },
      ],
    },
    equipment: {
      label: "The equipment",
      title: ["Trucks you'll want", "to live in."],
      intro: "Automatic Peterbilt 579s, Freightliner Cascadias and Kenworth T680s, set up for real life on the road.",
      specs: [
        { k: "Tractors", v: "Peterbilt 579 · Freightliner Cascadia · Kenworth T680" },
        { k: "Transmission", v: "Automatic" },
        { k: "Comfort", v: "APU · Inverter · Fridge · Microwave" },
        { k: "Cameras", v: "Road-facing & side only — no driver-facing cam" },
        { k: "Trailer", v: "53' dry van" },
        { k: "Freight", v: "Electronics · Drop & hook + live" },
      ],
      fleet: "trucks in the fleet",
      since: "hauling since",
    },
    lane: {
      label: "The lane",
      title: ["Nevada to Georgia,", "and back home."],
      intro: "Our main lane runs from the Henderson yard to Georgia, with regional, dedicated and 48-state OTR freight around it. No Canada, no Mexico.",
    },
    jobs: {
      label: "Open positions",
      title: ["Pick your seat."],
      intro: "Solo or team. OTR, regional or dedicated. All CDL-A, all 53' dry van, all out of Henderson, NV.",
      cta: "Apply in 2 minutes",
    },
    steps: {
      label: "How hiring works",
      title: ["From application", "to your first load."],
      items: [
        { t: "Apply in 2 minutes", d: "A short form with tap-to-answer questions. No SSN, no paperwork yet." },
        { t: "We call you", d: "Someone from our team calls you back — usually within the hour during office hours." },
        { t: "Full application", d: "Create your driver account and finish your DOT application online, at your pace." },
        { t: "Orientation in Henderson", d: "One day at the yard. Travel covered if you live far away. Your first load goes out the next day." },
      ],
    },
    owners: {
      label: "Owner-operators · Coming soon",
      title: ["Own your truck?", "Coming soon."],
      intro: "Right now we're hiring CDL-A company drivers only. Our owner-operator program is coming soon. Leave your info and we'll reach out as soon as it opens.",
      cta: "Get notified",
    },
    faq: { label: "Questions", title: ["Straight answers."], more: "All questions" },
    final: { title: ["Ready to roll?"], sub: "Two minutes to apply. A real person calls you back.", call: "Or call" },
  },
  footer: {
    tagline: "CDL-A solo and team jobs out of Las Vegas, Nevada. Hauling since 2015.",
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
      owners: "Owner-operators (coming soon)",
      about: "About us",
      locations: "Locations",
      contact: "Contact",
      guides: "Driver guides",
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
  : T extends number
    ? number
    : T extends readonly (infer U)[]
    ? readonly DeepString<U>[]
    : { [K in keyof T]: DeepString<T[K]> };
