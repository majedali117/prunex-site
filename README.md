# Prunex — Company Website

Professional company website for **Prunex**, an AI policy governance company that helps enterprises govern AI with confidence.

## About Prunex

Prunex provides enterprise-grade AI governance through:
- **Policy Control** — Define and enforce AI usage policies
- **Compliance Support** — Map controls to regulatory standards
- **Responsible AI Oversight** — Embed ethical considerations into operations
- **Auditability** — Full traceability and audit-ready evidence

## Project Structure

```
prunex-site/
├── index.html              Home page (root)
├── CNAME                   Custom domain (prunex.ai)
├── README.md               This file
├── pages/
│   ├── about.html          About Us
│   ├── offerings.html      Products / Services / Offerings
│   ├── why-prunex.html     Why Prunex (differentiators)
│   ├── contact.html        Contact Us (form)
│   ├── privacy.html        Privacy Policy
│   └── cookies.html        Cookie Policy + Cookie Settings
└── resources/
    ├── css/
    │   └── styles.css      Shared design system (CSS)
    ├── js/
    │   └── main.js         Shared JavaScript
    └── images/
        └── logo.png        Official Prunex logo
```

## Design System

- **Colors**: Black & white base with restrained dark green accents (`#1a3a2a`)
- **Typography**: [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts
- **Layout**: 1200px max-width container, 8px spacing grid
- **Components**: Buttons, cards, feature lists, pillars, CTA blocks, forms
- **Responsive**: Mobile-first with breakpoints at 768px and 1024px
- **Animations**: Subtle scroll-reveal via IntersectionObserver

## Running Locally

Open `index.html` in any browser, or use a local server:

```bash
# Python
python3 -m http.server 8000

# Node.js (npx)
npx serve .
```

Then open [http://localhost:8000](http://localhost:8000).

## Deployment

The site is deployed to **GitHub Pages** via the `CNAME` file pointing to `prunex.ai`.

## Technology

Static HTML, CSS, and vanilla JavaScript. No build step, no framework, no dependencies.
