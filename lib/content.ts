/**
 * Real Counder content, sourced from SITE-OVERVIEW.md and counder.com, used
 * across the home experience. Kept in one place so copy stays consistent and the
 * scroll journey reads as the brand's own voice — not placeholder.
 */

export const NAV_LINKS = [
  { label: "Conference", href: "#conference" },
  { label: "Network", href: "#network" },
  { label: "About", href: "#about" },
  { label: "Counder & Friends", href: "#friends" },
] as const;

export const SOCIALS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/counder", short: "In" },
  { label: "Instagram", href: "https://www.instagram.com/counder", short: "Ig" },
] as const;

/** The three interlocking pillars — wipe-revealed over the globe. */
export interface Pillar {
  id: string;
  index: string;
  title: string;
  when: string;
  body: string;
}

export const PILLARS: Pillar[] = [
  {
    id: "network",
    index: "01",
    title: "The Network",
    when: "Year-round",
    body: "Where perspectives stay connected across industries, continents, and time zones. Members, alumni, and partners — remarkable people from completely different worlds, in continuous conversation.",
  },
  {
    id: "conference",
    index: "02",
    title: "The Conference",
    when: "25–29 January 2027",
    body: "500 curated perspectives in one place. An unconference in Cape Town under the Chatham House Rule, where every guest shapes the sessions. This year's lens: The AI Inflection.",
  },
  {
    id: "friends",
    index: "03",
    title: "Counder & Friends",
    when: "29 January 2027",
    body: "Partner-hosted events across the city and an evening celebration that brings thousands together. Where the network opens up — curated to 500, widened to more than a thousand.",
  },
];

/** The "Presenting" reveal — the conference headline that resolves out of blur. */
export const PRESENTING = {
  eyebrow: "Presenting",
  title: "Counder Conference 2027",
  meta: "Cape Town · 25–29 January",
  lens: "This year's lens — The AI Inflection.",
  note: "You can't talk about the future without understanding the past. Yesterday, today, tomorrow — in the Mother City, where today meets tomorrow.",
} as const;

/** The "continues" beat — this is a landing, not the whole site, so a quiet
 *  closing note signals the experience carries on beyond this page. */
export const CONTINUES = {
  eyebrow: "Beyond this page",
  line: "What you've seen is one window onto Counder. The network, the conference, and the conversation continue — year-round, across 27+ countries.",
  cta: { label: "Continue the conversation", href: "https://counder.com" },
} as const;

/** The resolve / footer call-to-action. */
export const RESOLVE = {
  eyebrow: "Join Counder · January 2027",
  title: "Apply for an invitation.",
  body: "The Counder Conference is curated and limited to 500 members, by invitation or application. Tell us how you see the world.",
  primary: { label: "Apply for invite", href: "#apply" },
  secondary: { label: "I was invited", href: "#confirm" },
} as const;

/** Footer navigation columns (from the live site footer). */
export const FOOTER_COLUMNS = [
  {
    heading: "Counder",
    links: [
      { label: "About", href: "#about" },
      { label: "Network", href: "#network" },
      { label: "Conference", href: "#conference" },
      { label: "Partners", href: "#partners" },
    ],
  },
  {
    heading: "Get involved",
    links: [
      { label: "Join", href: "#apply" },
      { label: "Counder & Friends", href: "#friends" },
      { label: "Contact", href: "#contact" },
      { label: "FAQs", href: "#faqs" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Imprint", href: "#imprint" },
      { label: "Privacy Policy", href: "#privacy" },
      { label: "Terms", href: "#terms" },
    ],
  },
] as const;

export const QUICK_FACTS = [
  { value: "500", label: "Members, curated" },
  { value: "27+", label: "Countries" },
  { value: "25+", label: "Global partners" },
  { value: "1000+", label: "At Counder & Friends" },
] as const;
