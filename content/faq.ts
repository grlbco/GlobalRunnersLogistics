import { company, hiring, pay } from "./facts";

export type Faq = { q: string; a: string; group: "Pay" | "Hiring" | "Equipment" | "Life on the road" | "Company" };

/** Every answer starts with a direct one-sentence answer (good for Google and AI assistants). */
export const faqs: Faq[] = [
  { group: "Pay", q: "How often do Global Runners Logistics drivers get paid?", a: `Drivers are paid weekly. The pay period runs ${pay.payPeriod}, and pay lands every ${pay.payday}.` },
  { group: "Pay", q: "How are drivers paid — per mile or percentage?", a: "Company drivers are paid per mile. Your exact rate is confirmed on your first call with our recruiter, before you commit to anything." },
  { group: "Pay", q: "Do you pay layover?", a: `Yes. Layover pays $${pay.layover}.` },
  { group: "Pay", q: "Is there a bonus?", a: `Yes. Every driver earns a $${pay.anniversaryBonus.toLocaleString()} bonus on each work anniversary, every year you stay with us.` },
  { group: "Pay", q: "When do I get my first paycheck?", a: `Your first check comes on the ${pay.payday} after your first full pay period (${pay.payPeriod}).` },
  { group: "Hiring", q: "What are the requirements to drive for Global Runners Logistics?", a: `You need a valid CDL-A, at least ${hiring.minAge} years of age, ${hiring.minExperience} experience, no more than 3 moving violations in the last 3 years, no DUI, a clean drug and alcohol history, and authorization to work in the U.S.` },
  { group: "Hiring", q: "Do you hire new CDL school graduates?", a: "Not at this time. We require at least 1 year of CDL-A driving experience." },
  { group: "Hiring", q: "Do you hire teams?", a: "Yes. We hire both solo drivers and teams. If you don't have a partner yet, tell us on the application." },
  { group: "Hiring", q: "Where do I pick up the truck?", a: `Trucks are picked up at our yard in ${company.yard.city}, Nevada.` },
  { group: "Hiring", q: "Which areas do you hire from?", a: "We currently hire CDL-A drivers who live in Nevada, mainly the Las Vegas and Henderson area." },
  { group: "Hiring", q: "How long does it take to start?", a: `Most drivers go from application to first load in about two weeks. Orientation is ${hiring.orientationDays} day.` },
  { group: "Hiring", q: "Do you pay for travel to orientation?", a: "Yes. If you live far from Henderson, we cover travel to orientation." },
  { group: "Hiring", q: "How fast will someone call me after I apply?", a: "Our recruiter aims to call new applicants within 1 hour during office hours (Pacific Time)." },
  { group: "Hiring", q: "Do I need to speak perfect English?", a: "No. You need basic English for road signs, DOT and dispatch. Our dispatchers also speak Spanish." },
  { group: "Equipment", q: "What trucks do you run?", a: "We run automatic Peterbilt 579s and Freightliner Cascadias with APU, inverter, fridge and microwave." },
  { group: "Equipment", q: "Are the trucks automatic?", a: "Yes. Every truck in the fleet has an automatic transmission." },
  { group: "Equipment", q: "Is there a driver-facing camera?", a: "No. Our trucks have a road-facing dash cam only." },
  { group: "Equipment", q: "What trailer and freight do you haul?", a: "53-foot dry van, mostly electronics, with a mix of drop & hook and live loads." },
  { group: "Life on the road", q: "Can I take the truck home?", a: "Yes. Drivers can take the truck home." },
  { group: "Life on the road", q: "Are riders and pets allowed?", a: "Yes. Riders and pets are allowed. Ask your recruiter about the details." },
  { group: "Life on the road", q: "Will I have a dedicated dispatcher?", a: "Yes. Every driver has a dedicated dispatcher, and dispatch is available 24/7 in English and Spanish." },
  { group: "Life on the road", q: "What lanes do you run?", a: "Our main lane is Nevada to Georgia. We also run regional, dedicated and 48-state OTR freight. We do not run into Canada or Mexico." },
  { group: "Company", q: "Where is Global Runners Logistics located?", a: `Our office is at ${company.office.street}, ${company.office.city}, ${company.office.region} ${company.office.postalCode}. Our truck yard is in ${company.yard.city}, Nevada.` },
  { group: "Company", q: "How long has Global Runners Logistics been hauling?", a: `Since ${company.foundedYear}.` },
  { group: "Company", q: "How big is the fleet?", a: "We run 30 trucks." },
];

export const homeFaqs = faqs.filter((f) =>
  [
    "How often do Global Runners Logistics drivers get paid?",
    "What are the requirements to drive for Global Runners Logistics?",
    "Can I take the truck home?",
    "What trucks do you run?",
    "Do you hire teams?",
    "How long does it take to start?",
  ].includes(f.q),
);
