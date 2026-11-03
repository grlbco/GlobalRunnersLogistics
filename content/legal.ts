import { company } from "./facts";

/**
 * Plain-language legal pages. Drafts written for review by Global Runners Logistics' attorney before launch
 * (docs/plan/09). Keep SMS terms in sync with the Quo A2P 10DLC campaign registration.
 */
export type LegalDoc = { slug: string; title: string; updated: string; sections: { h: string; p: string[] }[] };

const name = company.legalName;
const addr = `${company.office.street}, ${company.office.city}, ${company.office.region} ${company.office.postalCode}`;

export const legalDocs: LegalDoc[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    updated: "2026-11-03",
    sections: [
      { h: "Who we are", p: [`${name} ("we", "us") operates globalrunnerslogistics.com. Our office is at ${addr}. Questions about this policy: call ${company.phone.display} or write to us at that address.`] },
      {
        h: "What we collect",
        p: [
          "Information you give us when you apply, register or contact us: name, phone number, email, ZIP code, driving experience, licensing and safety-history answers, and anything you write in a message.",
          "If you complete the full driver application in your account, we also collect the information federal regulations require for driver qualification (49 CFR Part 391), such as license details, employment and address history, and signed authorizations. Sensitive identifiers are encrypted and only visible to authorized recruiting staff.",
          "Basic technical data: pages visited, referring site, campaign tags (UTM), device and browser type, and IP address.",
        ],
      },
      {
        h: "How we use it",
        p: [
          "To review your application, contact you about driving or owner-operator opportunities, run required background and safety checks with your written authorization, operate and improve the website, and comply with law.",
          "We do not sell your personal information. We do not share your mobile number or SMS opt-in with third parties for their marketing.",
        ],
      },
      {
        h: "Who we share it with",
        p: [
          "Service providers that help us run our business under contract — hosting and database (Vercel, Supabase), email (Resend), phone and text messaging (Quo), and screening providers you authorize. They may only use your data to provide services to us.",
          "Government agencies or others when required by law.",
        ],
      },
      { h: "How long we keep it", p: ["Applicant records are kept as long as needed for hiring and as required by DOT record-keeping rules, then deleted or anonymized."] },
      { h: "Your choices", p: ["You can ask us to access, correct or delete your information by calling or writing to us. Reply STOP to any text to stop messages. Unsubscribe links are in every marketing email."] },
      { h: "Security", p: ["We use encryption in transit, access controls and row-level security in our database. No system is perfectly secure, but we work to protect your data."] },
      { h: "Children", p: ["This site is for adults seeking employment. We do not knowingly collect information from anyone under 18."] },
      { h: "Changes", p: ["We'll post any changes here and update the date above."] },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Use",
    updated: "2026-11-03",
    sections: [
      { h: "Using this site", p: [`By using globalrunnerslogistics.com you agree to these terms. The site is operated by ${name}.`] },
      { h: "Job information", p: ["Job details, pay and benefits described on this site are provided for information and can change. Final terms are confirmed directly with our recruiting team and in your offer. Submitting an application does not guarantee employment."] },
      { h: "Accounts", p: ["If you create an account, keep your login private and give us accurate information. We may suspend accounts used for fraud or abuse."] },
      { h: "Acceptable use", p: ["Don't misuse the site: no automated scraping, spam submissions, attempts to break security, or uploading anything unlawful."] },
      { h: "Content", p: ["Site content, our name and logo belong to us. Don't copy them for commercial use without permission."] },
      { h: "Disclaimer", p: ["The site is provided as is. To the extent the law allows, we aren't liable for indirect damages from using it."] },
      { h: "Law", p: ["These terms are governed by the laws of the State of Nevada."] },
    ],
  },
  {
    slug: "sms-terms",
    title: "SMS Terms",
    updated: "2026-11-03",
    sections: [
      { h: "Program", p: [`${name} sends text messages about your driver or owner-operator application, interview scheduling, onboarding and job opportunities to people who opt in on our website forms.`] },
      { h: "Opt-in", p: ["You opt in by checking the SMS consent box on our forms. Consent is not a condition of employment or of applying."] },
      { h: "Frequency & cost", p: ["Message frequency varies. Message and data rates may apply."] },
      { h: "Opt-out & help", p: [`Reply STOP to any message to opt out; you'll get one confirmation and no further texts. Reply HELP for help, or call ${company.phone.display}.`] },
      { h: "Carriers", p: ["Carriers are not liable for delayed or undelivered messages."] },
      { h: "Privacy", p: ["Mobile numbers and opt-in information are never sold or shared with third parties for marketing. See our Privacy Policy."] },
    ],
  },
  {
    slug: "eeo",
    title: "Equal Employment Opportunity",
    updated: "2026-11-03",
    sections: [
      {
        h: "Our commitment",
        p: [
          `${name} is an equal opportunity employer. We make employment decisions without regard to race, color, religion, sex (including pregnancy), sexual orientation, gender identity, national origin, age (40 and over), disability, genetic information, veteran status, citizenship status, or any other status protected by federal, state or local law.`,
          "All applicants must be authorized to work in the United States. We accept any valid documents permitted by Form I-9 and do not specify which documents an applicant must present.",
          `If you need an accommodation to apply, call ${company.phone.display}.`,
        ],
      },
    ],
  },
  {
    slug: "accessibility",
    title: "Accessibility",
    updated: "2026-11-03",
    sections: [
      { h: "Our goal", p: ["We aim for this website to meet WCAG 2.2 Level AA. It supports keyboard navigation, screen readers and reduced-motion settings."] },
      { h: "Need help?", p: [`If anything on the site is hard to use, call ${company.phone.display} and we'll help you apply by phone.`] },
    ],
  },
];

export const getLegal = (slug: string) => legalDocs.find((d) => d.slug === slug);
