import { company, fleet, hiring, pay } from "./facts";
import type { Faq } from "./faq";

/**
 * Driver guides — the topical-authority layer (docs/plan/06). Every guide answers its question in
 * the first sentence, uses only facts from content/facts.ts or stable industry knowledge, and ends
 * with an FAQ. Rendered to HTML (pages) and Markdown (.md / llms-full.txt) from this one source.
 */
export type Block = { h2: string; p?: string[]; list?: string[] };
export type Guide = {
  slug: string;
  title: string;
  description: string;
  answer: string;
  published: string;
  updated: string;
  readMinutes: number;
  blocks: Block[];
  faq: Faq[];
};

export const guides: Guide[] = [
  {
    slug: "team-vs-solo-truck-driving",
    title: "Team vs. Solo Truck Driving: Which Is Right for You?",
    description: "How team and solo CDL-A driving differ in miles, pay, home time and lifestyle — and how each works at Global Runners Logistics in Las Vegas.",
    answer:
      "Team driving means two CDL-A drivers share one truck and take turns so the truck keeps moving almost around the clock; solo driving means one driver runs the truck within their own hours-of-service limits. Teams cover more miles per week, solos get the cab to themselves.",
    published: "2026-11-03",
    updated: "2026-11-03",
    readMinutes: 4,
    blocks: [
      {
        h2: "How team driving works",
        p: [
          "In a team, one driver drives while the other rests in the sleeper berth. Because federal hours-of-service rules limit each driver's daily driving time, sharing the truck lets a team keep freight moving far longer each day than one driver can.",
          "That is why long-haul lanes such as Nevada to Georgia are a natural fit for teams: the load gets there faster, and the truck earns miles while one driver sleeps.",
        ],
      },
      {
        h2: "How solo driving works",
        p: [
          "A solo driver runs the truck alone, plans their own stops and keeps their own schedule inside the hours-of-service limits. Solo runs are often regional or dedicated, which can make home time more predictable.",
        ],
      },
      {
        h2: "Side-by-side",
        list: [
          "Miles: teams cover more miles per week because the truck rarely stops.",
          "Space: solo drivers have the cab to themselves; teams share it.",
          "Partner: teams need someone you trust and get along with for long stretches.",
          "Run type: teams suit long OTR lanes; solos often run regional or dedicated freight.",
        ],
      },
      {
        h2: "Team and solo jobs at Global Runners Logistics",
        p: [
          `${company.shortName} hires both. Teams run OTR freight including our main ${fleet.mainLane.from} ↔ ${fleet.mainLane.to} lane; solo drivers run regional and dedicated dry van routes. Everyone starts from our yard in ${company.yard.city}, NV, drives an automatic ${fleet.makes.join(" or ")}, and gets paid weekly every ${pay.payday}.`,
          "Don't have a team partner yet? Tell us on the application — our recruiter will talk through options with you.",
        ],
      },
    ],
    faq: [
      { group: "Hiring", q: "Can I apply as a team without a partner?", a: "Yes. Apply as \"Either\" or \"Team\" and tell us you don't have a partner yet; our recruiter will discuss options with you." },
      { group: "Hiring", q: "Does Global Runners Logistics hire solo drivers?", a: "Yes. Solo CDL-A drivers run regional and dedicated dry van routes out of Henderson, NV." },
      { group: "Life on the road", q: "Are riders allowed on team or solo runs?", a: "Yes. Riders and pets are allowed. Ask your recruiter about the details." },
    ],
  },
  {
    slug: "drop-and-hook-vs-live-unload",
    title: "Drop and Hook vs. Live Load/Unload, Explained",
    description: "What drop and hook and live loading mean for truck drivers, how they affect wait time, and why Global Runners Logistics runs both on 53' dry van freight.",
    answer:
      "Drop and hook means the driver drops a loaded trailer at the shipper or receiver and hooks up a different, ready trailer; live load or live unload means the driver waits at the dock while the trailer is loaded or unloaded. Drop and hook usually means less waiting.",
    published: "2026-11-03",
    updated: "2026-11-03",
    readMinutes: 3,
    blocks: [
      {
        h2: "Drop and hook",
        p: [
          "With drop and hook, the facility already has a trailer loaded (or a spot for yours). You disconnect your trailer, connect to the next one, do your inspection and roll. The time at the facility is short and predictable.",
        ],
      },
      {
        h2: "Live load and live unload",
        p: [
          "With a live load or unload, you back into a dock door and the trailer is loaded or emptied while you wait. How long that takes depends on the facility, the freight and the appointment schedule.",
        ],
      },
      {
        h2: "Why it matters to drivers",
        list: [
          "Wait time: drop and hook usually cuts time sitting at docks.",
          "Planning: shorter, predictable stops make it easier to plan your day and your hours of service.",
          "Detention and layover: when delays happen, how a carrier pays for them matters.",
        ],
      },
      {
        h2: "How Global Runners Logistics handles it",
        p: [
          `Our freight is ${fleet.trailer}, mostly ${fleet.freight.toLowerCase()}, with a mix of ${fleet.loading.join(" and ").toLowerCase()}. "No wait time" is one of the top reasons our drivers give for staying, because dispatch plans loads ahead. When a layover happens, it pays $${pay.layover}.`,
        ],
      },
    ],
    faq: [
      { group: "Pay", q: "Does Global Runners Logistics pay layover?", a: `Yes. Layover pays $${pay.layover}.` },
      { group: "Equipment", q: "What freight does Global Runners Logistics haul?", a: "53-foot dry van freight, mostly electronics, with a mix of drop & hook and live loads." },
    ],
  },
  {
    slug: "orientation-what-to-expect",
    title: "Global Runners Logistics Orientation: What to Expect",
    description: "How long orientation takes, where it happens, what to bring and how fast you'll get your first load as a new CDL-A driver at Global Runners Logistics.",
    answer: `Orientation at ${company.shortName} is ${hiring.orientationDays} day at our truck yard in ${company.yard.city}, Nevada, and most new drivers take their first load about two weeks after applying. If you live far away, we cover your travel to orientation.`,
    published: "2026-11-03",
    updated: "2026-11-03",
    readMinutes: 3,
    blocks: [
      {
        h2: "From application to orientation",
        list: [
          "Apply online in about 2 minutes.",
          "Our recruiter calls you back — usually within the hour during office hours (Pacific Time).",
          "Finish your full DOT employment application in your driver account.",
          "Complete the standard pre-hire steps (such as background check, driving record review and drug test).",
          "Come to orientation in Henderson, NV.",
        ],
      },
      {
        h2: "What to bring",
        list: [
          "Your valid CDL-A license.",
          "Your current DOT medical card.",
          "Documents that show you're authorized to work in the U.S. (any acceptable Form I-9 documents).",
          "Anything your recruiter asks you to bring on your call.",
        ],
      },
      {
        h2: "What happens on orientation day",
        p: [
          `You'll meet the team, complete paperwork, go over safety and company procedures, and get to know your truck — an automatic ${fleet.makes.join(" or ")} with ${fleet.extras.slice(0, 4).join(", ").toLowerCase()}. You'll also meet dispatch, who speak ${hiring.dispatchLanguages.join(" and ")}.`,
        ],
      },
      {
        h2: "After orientation",
        p: [`Your dedicated dispatcher sets up your first load. You can take the truck home, and pay runs weekly — every ${pay.payday}.`],
      },
    ],
    faq: [
      { group: "Hiring", q: "How long is orientation at Global Runners Logistics?", a: `${hiring.orientationDays} day, at the Henderson, NV yard.` },
      { group: "Hiring", q: "Do you pay for travel to orientation?", a: "Yes. If you live far from Henderson, we cover travel to orientation." },
      { group: "Hiring", q: "How soon after applying will I get my first load?", a: "Most drivers go from application to first load in about two weeks." },
    ],
  },
  {
    slug: "how-weekly-pay-works",
    title: "How Weekly Pay Works at Global Runners Logistics",
    description: "Pay period, payday, layover pay and the yearly anniversary bonus for CDL-A drivers at Global Runners Logistics in Las Vegas, NV.",
    answer: `${company.shortName} pays drivers every week: the pay period runs ${pay.payPeriod}, and pay lands every ${pay.payday}. Company drivers are paid per mile, layover pays $${pay.layover}, and every driver earns a $${pay.anniversaryBonus.toLocaleString()} bonus on each work anniversary.`,
    published: "2026-11-03",
    updated: "2026-11-03",
    readMinutes: 2,
    blocks: [
      {
        h2: "The weekly cycle",
        list: [`Pay period: ${pay.payPeriod}.`, `Payday: every ${pay.payday}.`, `Pay type: ${pay.type.toLowerCase()}.`],
      },
      {
        h2: "Extra pay",
        list: [`Layover: $${pay.layover}.`, `Anniversary bonus: $${pay.anniversaryBonus.toLocaleString()} every year on your work anniversary.`],
      },
      {
        h2: "Your rate",
        p: ["Your exact per-mile rate depends on the position (team or solo) and is confirmed on your first call with our recruiter — before you commit to anything."],
      },
    ],
    faq: [
      { group: "Pay", q: "What day do Global Runners Logistics drivers get paid?", a: `Every ${pay.payday}.` },
      { group: "Pay", q: "Is the anniversary bonus a sign-on bonus?", a: `No. It's a $${pay.anniversaryBonus.toLocaleString()} bonus paid every year on your work anniversary, for as long as you stay.` },
    ],
  },
];

export const getGuide = (slug: string) => guides.find((g) => g.slug === slug);
