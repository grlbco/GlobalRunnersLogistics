import { company, fleet } from "@/content/facts";
import type { Faq } from "@/content/faq";
import type { Job } from "@/content/jobs";
import type { Place } from "@/content/locations";

const orgId = `${company.url}/#organization`;
const address = {
  "@type": "PostalAddress",
  streetAddress: company.office.street,
  addressLocality: company.office.city,
  addressRegion: company.office.region,
  postalCode: company.office.postalCode,
  addressCountry: company.office.country,
};

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": orgId,
    name: company.legalName,
    alternateName: company.shortName,
    url: company.url,
    logo: `${company.url}/icon.png`,
    foundingDate: String(company.foundedYear),
    address,
    telephone: company.phone.e164,
    numberOfEmployees: { "@type": "QuantitativeValue", value: fleet.drivers },
    knowsLanguage: ["en", "es"],
    contactPoint: [
      { "@type": "ContactPoint", contactType: "recruiting", telephone: company.phone.e164, areaServed: "US-NV", availableLanguage: ["English", "Spanish"] },
    ],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${company.url}/#website`,
    url: company.url,
    name: company.shortName,
    publisher: { "@id": orgId },
    inLanguage: ["en-US", "es-US"],
  };
}

export function localBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${company.url}/#office`,
    name: `${company.shortName} — Las Vegas office`,
    parentOrganization: { "@id": orgId },
    address,
    telephone: company.phone.e164,
    url: `${company.url}/locations`,
    geo: { "@type": "GeoCoordinates", latitude: 36.1615, longitude: -115.1478 },
  };
}

export function faqSchema(items: readonly Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: `${company.url}${t.path}` })),
  };
}

/** Google for Jobs. Salary omitted until confirmed (docs/plan/00). */
export function jobPostingSchema(job: Job, descriptionHtml: string) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: descriptionHtml,
    datePosted: job.datePosted,
    validThrough: `${job.validThrough}T23:59:59-08:00`,
    employmentType: "FULL_TIME",
    directApply: true,
    hiringOrganization: { "@type": "Organization", name: company.legalName, sameAs: company.url, logo: `${company.url}/icon.png` },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: company.yard.city, addressRegion: company.yard.region, addressCountry: "US" },
    },
    applicantLocationRequirements: { "@type": "State", name: "Nevada" },
    experienceRequirements: { "@type": "OccupationalExperienceRequirements", monthsOfExperience: 12 },
    qualifications: "Valid CDL-A license, minimum age 21, 1 year CDL-A experience.",
    industry: "Trucking",
    occupationalCategory: "53-3032.00 Heavy and Tractor-Trailer Truck Drivers",
    identifier: { "@type": "PropertyValue", name: company.legalName, value: job.slug },
  };
}

export function placeSchema(place: Place) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `CDL-A truck driving jobs near ${place.city}, NV`,
    about: { "@type": "City", name: place.city, containedInPlace: { "@type": "State", name: "Nevada" } },
    publisher: { "@id": orgId },
  };
}
