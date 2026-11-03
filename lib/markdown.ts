import { company, fleet, hiring, pay } from "@/content/facts";
import { jobs, requirements, whatYouGet, getJob } from "@/content/jobs";
import { faqs, type Faq } from "@/content/faq";
import { places, getPlace } from "@/content/locations";
import { guides, getGuide } from "@/content/guides";
import { legalDocs, getLegal } from "@/content/legal";

/**
 * Markdown representations of every public page, generated from the same content files as the HTML
 * (so they never drift). Served at /<path>.md, to clients sending Accept: text/markdown, and
 * concatenated into /llms-full.txt. Same content as the HTML page — not a different "bot page".
 */
const U = company.url;
const list = (items: readonly string[]) => items.map((i) => `- ${i}`).join("\n");
const faqMd = (items: readonly Faq[]) => items.map((f) => `### ${f.q}\n\n${f.a}`).join("\n\n");
const front = (title: string, path: string, description: string, updated = "2026-11-03") =>
  `---\ntitle: "${title.replace(/"/g, "'")}"\ncanonical_url: ${U}${path === "/" ? "" : path}\ndescription: "${description.replace(/"/g, "'")}"\nlast_updated: ${updated}\npublisher: ${company.legalName}\n---\n\n`;
const contact = `## Contact\n\n- Phone: ${company.phone.display}\n- Office: ${company.office.street}, ${company.office.city}, ${company.office.region} ${company.office.postalCode}\n- Truck yard: ${company.yard.city}, ${company.yard.region}\n- Apply: ${U}/apply/driver`;
const facts = `## Key facts\n\n${list([
  `Hauling since ${company.foundedYear}; ${fleet.trucks} trucks`,
  `Equipment: ${fleet.makes.join(", ")} (${fleet.transmission.toLowerCase()}), ${fleet.extras.join(", ")}`,
  `Trailer & freight: ${fleet.trailer}, mostly ${fleet.freight.toLowerCase()}, ${fleet.loading.join(" and ").toLowerCase()}`,
  `Runs: ${fleet.runTypes.join(", ")}; main lane ${fleet.mainLane.from} ↔ ${fleet.mainLane.to}`,
  `Pay: ${pay.type.toLowerCase()}, weekly, every ${pay.payday} (pay period ${pay.payPeriod}); $${pay.layover} layover; $${pay.anniversaryBonus.toLocaleString()} anniversary bonus every year`,
  `Take the truck home: yes · Riders & pets: yes · Dedicated dispatcher: yes (24/7, ${hiring.dispatchLanguages.join(" & ")})`,
])}`;

export type MdPage = { path: string; title: string; markdown: string };

export function pageMarkdown(path: string): MdPage | null {
  const clean = path === "" ? "/" : path.replace(/\/$/, "") || "/";
  const seg = clean.split("/").filter(Boolean);

  if (clean === "/") {
    const title = `${company.shortName} — CDL-A Truck Driving Jobs in Las Vegas, NV`;
    return {
      path: clean,
      title,
      markdown:
        front(title, "/", "Now hiring CDL-A solo and team drivers in Las Vegas and Henderson, NV.") +
        `# ${title}\n\n${company.shortName} is a ${fleet.trucks}-truck CDL-A dry van carrier in ${company.office.city}, Nevada, hiring solo and team company drivers and owner-operators. Your road. Your future. Our family.\n\n${facts}\n\n## Why drivers stay\n\n${list(["Pay you can count on — per mile, every week, every Thursday", "Consistent runs", "No wait time", "Home on time, not late"])}\n\n## Open positions\n\n${jobs.map((j) => `- [${j.title}](${U}/drive/${j.slug}) — ${j.route}`).join("\n")}\n\n## How hiring works\n\n1. Apply in 2 minutes\n2. Our recruiter calls you back (usually within the hour, Pacific Time)\n3. Finish your full DOT application online\n4. ${hiring.orientationDays}-day orientation in Henderson, NV — first load in about 2 weeks\n\n## FAQ\n\n${faqMd(faqs.slice(0, 8))}\n\n${contact}\n`,
    };
  }
  if (clean === "/drive") {
    const title = "CDL-A Driving Jobs in Las Vegas & Henderson, NV";
    return {
      path: clean,
      title,
      markdown:
        front(title, clean, "Company CDL-A jobs for solo and team drivers out of Henderson, NV.") +
        `# ${title}\n\n${company.shortName} hires CDL-A solo and team drivers out of ${company.yard.city}, Nevada.\n\n## Open positions\n\n${jobs.map((j) => `- [${j.title}](${U}/drive/${j.slug}) — ${j.route}`).join("\n")}\n\n## What you get\n\n${list(whatYouGet)}\n\n## Requirements\n\n${list(requirements)}\n\nYour per-mile rate is confirmed on your first call with our recruiter.\n\n${contact}\n`,
    };
  }
  if (seg[0] === "drive" && seg[1]) {
    const j = getJob(seg[1]);
    if (!j) return null;
    return {
      path: clean,
      title: j.title,
      markdown:
        front(j.title, clean, j.summary.slice(0, 155)) +
        `# ${j.title}\n\n**Location:** ${hiring.pickup} · **Type:** Full-time · **Posted:** ${j.datePosted}\n\n${j.summary}\n\n## Job details\n\n${j.highlights.map((h) => `- **${h.k}:** ${h.v}`).join("\n")}\n\n## What you get\n\n${list(whatYouGet)}\n\n## Requirements\n\n${list(requirements)}\n\n## How to apply\n\nApply at ${U}/apply/driver or call ${company.phone.display}. ${company.legalName} is an equal opportunity employer.\n`,
    };
  }
  if (clean === "/owner-operators") {
    const title = "Owner-Operator Trucking Jobs — Las Vegas, NV";
    return { path: clean, title, markdown: front(title, clean, "Run consistent 53' dry van freight with Global Runners Logistics.") + `# ${title}\n\nOwn your truck? Run consistent ${fleet.trailer} freight with ${company.shortName}, a Las Vegas fleet hauling since ${company.foundedYear}. Dedicated dispatch 24/7 in English and Spanish. Program terms are reviewed with you on the first call.\n\nTell us about your truck: ${U}/owner-operators#apply\n\n${contact}\n` };
  }
  if (clean === "/about") {
    const title = `About ${company.shortName}`;
    return { path: clean, title, markdown: front(title, clean, `A ${fleet.trucks}-truck dry van carrier in Las Vegas, NV.`) + `# ${title}\n\n${company.legalName} has been hauling freight since ${company.foundedYear} and is led by owner ${company.owner}. We run ${fleet.trucks} trucks out of Las Vegas and Henderson, Nevada.\n\n${facts}\n\n${contact}\n` };
  }
  if (clean === "/locations") {
    const title = "Locations — Las Vegas Office & Henderson Truck Yard";
    return { path: clean, title, markdown: front(title, clean, "Office in Las Vegas, truck yard in Henderson, hiring across Southern Nevada.") + `# ${title}\n\n${contact}\n\n## Hiring areas\n\n${places.map((pl) => `- [CDL-A jobs in ${pl.city}, NV](${U}/locations/${pl.slug})${pl.milesToYard ? ` — ~${pl.milesToYard} mi to the yard` : ""}`).join("\n")}\n` };
  }
  if (seg[0] === "locations" && seg[1]) {
    const pl = getPlace(seg[1]);
    if (!pl) return null;
    const title = `CDL-A Truck Driving Jobs in ${pl.city}, NV`;
    return {
      path: clean,
      title,
      markdown:
        front(title, clean, `Hiring CDL-A drivers in ${pl.city}, NV.`) +
        `# ${title}\n\n${pl.intro} ${company.shortName} hires solo and team CDL-A drivers for ${fleet.trailer} runs.\n\n- Distance to Henderson yard: ${pl.milesToYard ? `~${pl.milesToYard} miles (~${pl.minutesToYard} min)` : "you're here"}\n- Main routes: ${pl.highways.join(", ")}\n\n## Open positions\n\n${jobs.map((j) => `- [${j.title}](${U}/drive/${j.slug})`).join("\n")}\n\n${contact}\n`,
    };
  }
  if (clean === "/lanes/nevada-georgia") {
    const title = "Nevada to Georgia Dry Van Lane";
    return { path: clean, title, markdown: front(title, clean, "Our main lane.") + `# ${title}\n\nOur main lane runs from the Henderson, NV yard to Georgia and back — ${fleet.trailer}, mostly ${fleet.freight.toLowerCase()}, ${fleet.loading.join(" and ").toLowerCase()}.\n\n${contact}\n` };
  }
  if (clean === "/faq") {
    const title = "Driver FAQ";
    return { path: clean, title, markdown: front(title, clean, "Answers to drivers' most common questions.") + `# ${title}\n\n${faqMd(faqs)}\n\n${contact}\n` };
  }
  if (clean === "/contact") {
    const title = `Contact ${company.shortName}`;
    return { path: clean, title, markdown: front(title, clean, `Call ${company.phone.display}.`) + `# ${title}\n\n${contact}\n` };
  }
  if (clean === "/apply/driver") {
    const title = "Apply — CDL-A Company Driver";
    return { path: clean, title, markdown: front(title, clean, "Apply in 2 minutes.") + `# ${title}\n\nThe application takes about 2 minutes on the website: ${U}/apply/driver. Or call ${company.phone.display}.\n\n## Requirements\n\n${list(requirements)}\n` };
  }
  if (clean === "/guides") {
    const title = "Driver Guides";
    return { path: clean, title, markdown: front(title, clean, "Guides for CDL-A drivers.") + `# ${title}\n\n${guides.map((g) => `- [${g.title}](${U}/guides/${g.slug}) — ${g.description}`).join("\n")}\n` };
  }
  if (seg[0] === "guides" && seg[1]) {
    const g = getGuide(seg[1]);
    if (!g) return null;
    const body = g.blocks.map((b) => `## ${b.h2}\n\n${[...(b.p ?? []), b.list ? list(b.list) : ""].filter(Boolean).join("\n\n")}`).join("\n\n");
    return { path: clean, title: g.title, markdown: front(g.title, clean, g.description, g.updated) + `# ${g.title}\n\n${g.answer}\n\n${body}\n\n## FAQ\n\n${faqMd(g.faq)}\n` };
  }
  if (seg[0] === "legal" && seg[1]) {
    const d = getLegal(seg[1]);
    if (!d) return null;
    return { path: clean, title: d.title, markdown: front(d.title, clean, `${d.title} for ${company.legalName}.`, d.updated) + `# ${d.title}\n\n${d.sections.map((s) => `## ${s.h}\n\n${s.p.join("\n\n")}`).join("\n\n")}\n` };
  }
  return null;
}

export function allMarkdownPaths(): string[] {
  return [
    "/",
    "/drive",
    ...jobs.map((j) => `/drive/${j.slug}`),
    "/apply/driver",
    "/owner-operators",
    "/about",
    "/locations",
    ...places.map((p) => `/locations/${p.slug}`),
    "/lanes/nevada-georgia",
    "/faq",
    "/guides",
    ...guides.map((g) => `/guides/${g.slug}`),
    "/contact",
    ...legalDocs.map((d) => `/legal/${d.slug}`),
  ];
}

export const mdUrl = (path: string) => (path === "/" ? "/index.md" : `${path}.md`);
