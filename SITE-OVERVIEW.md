# Counder — Website, Company & Content Overview

> A reference document describing the Counder website (counder.com), the company behind it, and the content of each page.

---

## 1. The Company

**Counder** describes itself as **"The Network for Collective Understanding."** It is a curated, global network that gathers remarkable people from completely different worlds — investors, entrepreneurs, executives, scientists, artists, public servants, and philanthropists — to make sense of what is going on in the world and act on it together.

The core idea: *"Everybody wants to understand what is going on in the world. Most try to figure it out alone. We decided to do it together."* When people with very different perspectives connect around the same question, individual insight becomes shared clarity — what Counder calls **collective understanding**.

### Vision & Mission
- **Vision:** To be the foremost global network where remarkable people converge to make sense of what's going on in the world — and act on it, together. ("Understanding drives action.")
- **Mission:** To bring together curious people from completely different worlds, bridge diverse perspectives, and foster collective understanding that drives meaningful collaboration.

### Core Values
- **Curiosity** — understanding the world is genuinely hard, and worth trying; the value sought in every person and decision.
- **Trust** — meaningful conversations, relationships, and collaborations are built on honesty.
- **Perspective** — the world makes more sense when you seek out people who see it differently.

### Reach
Spans **27+ countries** / multiple continents and disciplines. The network is built primarily through the annual conference; each year's cohort become members, and afterwards alumni.

### Legal Entities (from the Imprint)
- **Counder Ltd.** — 3rd Floor, 40 Mespil Road, Dublin 4, Ireland. Reg. No. 777945. Directors: Michel Christophar Weiss, Oliver Matyschik & Leonard Stiegeler. *(Responsible for site content.)*
- **Counder Network GmbH** — Gießerallee 23, 47877 Willich, Germany. HRB 17061, Amtsgericht Krefeld. Geschäftsführer: Michel Christophar Weiß.
- **Counder (Pty) Ltd** — Duncan Road, Alfred Chambers, 2nd Floor, Cape Town Cruise Terminal Waterfront, Cape Town, South Africa.

---

## 2. The Three Pillars / Products

Counder operates through three interlocking offerings:

| Pillar | What it is | When |
|--------|-----------|------|
| **The Network** | Where perspectives stay connected across industries, continents, and time zones — year-round. Members, alumni, and partners. | Year-round |
| **The Conference** | 500 curated perspectives in one place. An "unconference" in Cape Town. | Once a year (25–29 Jan 2027) |
| **Counder & Friends** | Partner-hosted events across the city plus an evening celebration that brings thousands together. Where the network opens up. | Final day (29 Jan 2027) |

### Counder Conference
- **Format:** An **"unconference"** — participant-driven; every guest shapes the sessions and conversations.
- **Operates under the Chatham House Rule** — participants may share what they hear but not attribute it, enabling candid dialogue.
- **Scale:** Intentionally curated and limited to **500 members**, by invitation or application.
- **Location:** Cape Town ("the Mother City"), positioned as a host where "today meets tomorrow."
- **Annual theme ("The Lens"):** 2027's lens is **"The AI Inflection."**
- **Philosophy:** "You can't talk about the future without understanding the past" — framed around Yesterday → Today → Tomorrow.

**The Week (25–29 January 2027):**
1. **Mon 25 — Partner Reception:** Evening welcome for partners (100+) who set the tone.
2. **Tue 26 — Opening Reception:** 500+ members & partners arrive; the week's frame is set.
3. **Wed 27 — Context Day:** The intellectual heart. A full day at the **Norval Foundation** (Africa's largest contemporary art museum) — breakout sessions led by Knowledge Partners, curated lunches, informal exchange.
4. **Thu 28 — Connect Day:** Energy shifts outdoors — city exploration, private brunches, township immersions, and the **Gala Dinner**.
5. **Fri 29 — Counder & Friends:** Understanding opens up; partner-hosted events citywide and an evening celebration (1000+ partners, members & guests).

### Counder & Friends
A day of partner-hosted events and activities across Cape Town, capped by an evening **Celebration** that converges members, partners, their guests, and friends. While the Conference is curated to 500, Counder & Friends is where the network widens — reaching thousands. Existing members/partners don't need to register separately.

### Ways to Join
- **Counder Conference** — invite-only / by application, built around the unconference format, max 500 members.
- **Mission Partners** — a small number of self-applications accepted each year. Approved applicants commit to a **€2,500 Mission Partner contribution** (invoiced on acceptance), which sustains curation and quality. Perks include a place at the conference, official recognition, the pre-conference Mission Partner programme (Active Morning & Luncheon), early app access to pre-reserve sessions, a partner-reception seat, and +2 guests to Counder & Friends.
- **Counder & Friends** — broader access via partner/member networks (waitlist).

---

## 3. Partners

Partners help shape the conversation, the conference, and the broader community, bringing expertise and widening the network. **25+ global partners / equity partners** (family offices and investors) underpin the network.

**Types of Partnership:**
1. **Edition Partner** — principal partner of the year's edition; brand-aligned, shaping the narrative from opening through Context Day, excursions, the Gala Dinner, and a flagship Counder & Friends moment.
2. **Programme Partners** — woven across the full week; shape programme, excursions, and host their own Counder & Friends event.
3. **Knowledge Partners** — anchor a topic on Context Day under Chatham House Rule.
4. **Collaboration Partners** — host their own Friday event (venue, format, guest list) within Counder & Friends.
5. **Experience Partners** — shape the sensory layer (activations, tastings, etc.).

---

## 4. The Network (People)

The network comprises the current conference cohort, alumni of past conferences, and the partners who enable it: principal investors, leading entrepreneurs, C-level executives, public leaders, cultural figures, and philanthropists from across disciplines and continents.

**Representative members/figures named on the site include:** Christo Wiese (Chairman Emeritus, Shoprite), Dr. Jan Deepen (Co-Founder, SumUp), Neville Isdell (former Chairman/CEO, The Coca-Cola Company), Emmanuel Lubanzadio (Africa Lead, OpenAI), Hardy Pemhiwa (President & CEO, Cassava Technologies), Jessica Motaung (Director, Kaizer Chiefs), Thebe Magugu (fashion designer), Dan Mace (Chief Creative Officer, Beast Philanthropy), Ethiopis Tafara (VP for Africa, IFC), Christian zu Fürstenberg (Haus Fürstenberg Holding), Julian Teicke (Co-Founder, The Delta), Leonard Stiegeler (Chairman, Counder), and many more investors, founders, and family-office principals.

---

## 5. The Website

### Technology
- A **static website built with Astro** — compiled `.html` pages with hashed, bundled assets under `_astro/` (per-page CSS and small JS hydration scripts).
- **Analytics/marketing:** PostHog (`scripts/posthog-loader.js`) and UTM capture (`scripts/utm-store.js`).
- **Media:** background/poster videos (`video/`), images organised by page (`images/home`, `images/about`, `images/conference`, `images/partners`, `images/friends`, `images/contact`, `images/icons`), and decorative SVG shapes (`shapes/`, `scroll/`).
- Standard favicon set, `site.webmanifest`, and Apple touch icon. Copyright 2026, Counder.

### Page Map
| File | Purpose |
|------|---------|
| `index.html` | **Home** — introduces collective understanding and the three pillars; promotes Conference '27. |
| `about.html` | **About** — vision, mission, values, equity partners, and team. |
| `conference.html` | **Conference** — format (unconference, Chatham House Rule), philosophy, day-by-day week breakdown. |
| `network.html` | **The Network** — directory of members, alumni, and partners. |
| `partners.html` | **Partners** — value of partnering and the five partnership types. |
| `counder-friends.html` | **Counder & Friends** — the Friday of city-wide events and the celebration. |
| `apply.html` | **Join Counder** — request invitation, confirm a place, or join the Friends waitlist; Mission Partner application. |
| `contact.html` | **Contact** — enquiry form for joining, partnership, or general questions; newsletter signup. |
| `faqs.html` | **FAQs** — covering the network, Conference, Counder & Friends, and data/privacy. |
| `imprint.html` | **Imprint** — legal entity information. |
| `privacypolicy.html` | **Privacy Policy** — data-handling terms. |
| `terms.html` | **Terms & Conditions** — site/event terms. |

### Recurring UI
- **Header nav:** Conference · Network · About · Counder & Friends · Partner with us · Join.
- **A "Join Counder" panel** (modal) appears across pages: *"Two ways to be part of Counder"* — Conference (25–29 Jan 2027) vs. Counder & Friends (29 Jan 2027) — branching into "Apply for invite" / "I was invited."
- **Footer:** About, Network, Conference, Partners, Get Involved (Join, Counder & Friends, Contact, FAQs), newsletter subscription, and legal links (Imprint, Privacy Policy, Terms & Conditions).

---

## 6. Quick Facts

- **Tagline:** The Network for Collective Understanding.
- **Flagship event:** Counder Conference 2027 — **25–29 January 2027, Cape Town**.
- **2027 theme:** The AI Inflection.
- **Conference size:** capped at **500 members**; Counder & Friends reaches **1000+**.
- **Reach:** 27+ countries; 25+ global partners.
- **Mission Partner contribution:** €2,500 (on acceptance).
- **Headquarters of record:** Counder Ltd., Dublin, Ireland (with German and South African subsidiaries).
