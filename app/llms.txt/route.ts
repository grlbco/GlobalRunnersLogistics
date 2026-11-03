import { company, fleet, hiring, pay } from "@/content/facts";
import { jobs, requirements } from "@/content/jobs";
import { places } from "@/content/locations";
import { faqs } from "@/content/faq";

/** /llms.txt — plain-Markdown brief for AI assistants (llmstxt.org format). Generated from content/facts.ts. */

export function GET() {
  const u = company.url;
  const body = `# ${company.legalName}

> ${company.shortName} is a ${fleet.trucks}-truck CDL-A dry van trucking company based in ${company.office.city}, Nevada, hauling since ${company.foundedYear}. It hires CDL-A solo and team company drivers and owner-operators. Trucks start from the yard in ${company.yard.city}, NV. Phone: ${company.phone.display}.

Key facts:
- Office: ${company.office.street}, ${company.office.city}, ${company.office.region} ${company.office.postalCode}
- Truck yard: ${company.yard.city}, ${company.yard.region}
- Equipment: ${fleet.makes.join(", ")}, ${fleet.transmission.toLowerCase()}; ${fleet.extras.join(", ")}
- Trailer & freight: ${fleet.trailer}; mostly ${fleet.freight.toLowerCase()}; ${fleet.loading.join(" and ").toLowerCase()}
- Runs: ${fleet.runTypes.join(", ")}; main lane ${fleet.mainLane.from} ↔ ${fleet.mainLane.to}; no Canada or Mexico
- Pay: ${pay.type.toLowerCase()}, paid ${pay.schedule.toLowerCase()} every ${pay.payday} (pay period ${pay.payPeriod}); $${pay.layover} layover; $${pay.anniversaryBonus.toLocaleString()} bonus every work anniversary
- Hiring from: ${hiring.hireFromStates.join(", ")}; drivers can take the truck home; riders and pets allowed; travel to orientation paid
- Orientation: ${hiring.orientationDays} day in Henderson, NV; first load in about 2 weeks
- Dispatch: dedicated dispatcher, 24/7, ${hiring.dispatchLanguages.join(" and ")}
- Requirements: ${requirements.join("; ")}

## Jobs
${jobs.map((j) => `- [${j.title}](${u}/drive/${j.slug}): ${j.route}`).join("\n")}
- [Apply in 2 minutes](${u}/apply/driver)

## Pages
- [Drive for Global Runners Logistics](${u}/drive): pay, requirements and benefits for company drivers
- [Owner-operators](${u}/owner-operators): program inquiry
- [About](${u}/about)
- [Locations](${u}/locations): Las Vegas office, Henderson yard, hiring areas
- [FAQ](${u}/faq)
- [Contact](${u}/contact)

## Hiring areas
${places.map((p) => `- [CDL-A jobs in ${p.city}, NV](${u}/locations/${p.slug})`).join("\n")}

## Optional
- [Spanish site](${u}/es)
${faqs.map((f) => `- Q: ${f.q} A: ${f.a}`).join("\n")}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
