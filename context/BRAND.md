# Pepla Brand Guidelines v2
*For independent creatives. An intuitive platform designed to meet you where you are — and grow with you.*

**Prepared by:** MacDoCo / Hope MacDonald
**Revised:** March 2026

---

## Design Philosophy

Pepla's new visual direction is **monochromatic, editorial, and still** — inspired by the stark confidence of Co-Star's UI. The goal is a product that feels like a quiet, trusted tool: no distractions, no flourishes, just clear information with room to breathe.

> The app should feel like a well-designed notebook: serious, purposeful, slightly cerebral — but warm at the edges.

---

## Color Palette

The desert palette has been retired. Pepla now uses a near-monochromatic system anchored in near-black and soft off-white, with two functional accent colors and one destructive color.

| Name           | Hex       | Usage                                              |
|----------------|-----------|----------------------------------------------------|
| **Void**       | `#0E0E0E` | Primary background (dark mode), heavy text          |
| **Ash**        | `#1C1C1C` | Card backgrounds, sidebar, nav surfaces             |
| **Fog**        | `#3A3A3A` | Borders, dividers, inactive states                  |
| **Dust**       | `#8A8A8A` | Muted labels, secondary text, placeholders          |
| **Parchment**  | `#F2EFE9` | Primary background (light mode), page canvas        |
| **Chalk**      | `#FFFFFF` | High-contrast text on dark backgrounds              |
| **Sky**        | `#C4CEDF` | Positive/forward actions — confirm, save, next      |
| **Ember**      | `#7C1618` | Destructive/cancel actions and sparingly as accents |

> **Theme:** Near-monochromatic with two intentional signals. Sky and Ember are functional colors — they tell the user what an action *does*, not just that it's clickable. Use both sparingly so they always carry meaning.

### Color Roles at a Glance

| Signal        | Color  | Hex       | Examples                              |
|---------------|--------|-----------|---------------------------------------|
| Positive/Next | Sky    | `#C4CEDF` | Save, Confirm, Next, Add, Accept      |
| Destructive   | Ember  | `#7C1618` | Cancel, Delete, Remove, Decline       |
| Neutral       | Greyscale | —      | Secondary actions, ghost buttons, nav |

### Light vs. Dark Mode

Pepla supports both modes. The hierarchy simply inverts:

- **Light mode:** Parchment background, Void text, Fog borders, Sky/Ember for action buttons
- **Dark mode:** Void background, Chalk text, Fog borders, Sky/Ember for action buttons

---

## Typography

Pepla uses **exactly two live typefaces:** Times New Roman (italic only, for all heading and headline use) and DM Sans (for everything functional — body, UI, labels, and numeric detail). They should not be swapped or mixed with any other font. The logo is an image asset, not a third typeface.

> **Note on the logo:** The Pepla wordmark (Dreaming Outloud) is used as an image asset — not a live font. Use the exported Canva logo file wherever the brand name appears. This keeps the signature look intact with no font-loading overhead.

### Header Font — Times New Roman
- **Style:** Italic always — never roman (upright)
- **Weight:** Regular (400) — never bold
- **Usage:** Page titles, section headings, card headings, stat-card hero figures, client names, any important label over ~16px
- **Case:** Sentence case — never all caps
- **Letter spacing:** `-0.01em` for large sizes; default for smaller sizes

> Italic Times New Roman has an editorial, slightly literary quality — confident without being loud.

### Body & UI Font — [DM Sans](https://fonts.google.com/specimen/DM+Sans)
- **Weight:** 300 (Light) for body copy, 400 (Regular) for labels and UI chrome, 500 (Medium) for buttons and eyebrow tags
- **Usage:** All functional UI — navigation, form fields, buttons, table data, inline numeric data, stat card labels and secondary detail, timestamps, captions, descriptions
- **Case:** `UPPERCASE` with `0.1em` letter-spacing for micro-labels and tags only; sentence case everywhere else

> DM Sans handles everything functional. It should feel invisible — clear and out of the way.

### Type Scale

| Role                     | Font            | Size     | Weight | Style     |
|--------------------------|-----------------|----------|--------|-----------|
| Logo / app name          | Image asset     | —        | —      | —         |
| Page title               | Times New Roman | 36–48px  | 400    | Italic    |
| Section heading          | Times New Roman | 22–28px  | 400    | Italic    |
| Card heading             | Times New Roman | 16–20px  | 400    | Italic    |
| Important info / callout | Times New Roman | 14–16px  | 400    | Italic    |
| Body / description       | DM Sans         | 14–15px  | 300    | Normal    |
| UI label                 | DM Sans         | 12–13px  | 400    | Normal    |
| Button text              | DM Sans         | 11–12px  | 500    | Uppercase |
| Eyebrow / tag            | DM Sans         | 10–11px  | 500    | Uppercase |
| Stat card hero figure    | Times New Roman | 36–40px  | 400    | Italic    |
| Table / inline numeric   | DM Sans         | 14–28px  | 300    | Normal    |
| Timestamp / caption      | DM Sans         | 11–12px  | 300    | Normal    |

---

## Layout & Spacing

Co-Star's signature quality is **generous negative space** — content is never crowded. Pepla should feel the same.

- **Max content width:** 900px (desktop), full-width on mobile
- **Page padding:** 40px horizontal on desktop; 20px on mobile
- **Section gaps:** 48–64px between major sections
- **Card padding:** 24–32px
- **Line height:** 1.6 for body text; 1.2 for headings
- **Grid:** 12-column, but rarely use all 12 — let content breathe in 6–8 columns max

### Spacing Principles

- Treat whitespace as a design element, not empty space
- Content blocks should feel like they're floating, not packed
- Never stack two large typographic elements without breathing room between them

---

## Components

### Cards
- Background: `Ash` (dark mode) or `Parchment` (light mode)
- Border: 1px solid `Fog`
- Border radius: `4px` — subtle, not rounded
- No shadows — use border + background contrast instead
- Hover state: border shifts to `Dust`, subtle background shift only

### Buttons

Pepla buttons communicate *intent* through color. There are three types, and each has a job.

- **Positive / Primary** — Sky (`#C4CEDF`) background, Void text, no border radius (or 2px max), DM Sans Medium 12px uppercase
  - Use for: Save, Confirm, Next, Add, Accept, Book, Send
- **Destructive** — Ember (`#7C1618`) background, Chalk text, same sizing
  - Use for: Cancel, Delete, Remove, Decline, Undo
- **Neutral / Ghost** — Transparent background, 1px Fog border, Dust text, same sizing
  - Use for: Back, Dismiss, secondary options with no strong intent

> Rule of thumb: if clicking it moves something forward, it's Sky. If clicking it undoes or removes something, it's Ember. If it's just navigation or a soft option, it's ghost.

- No shadows, no gradients, no rounded pill shapes
- Never use Sky and Ember side by side — they should never compete in the same moment

### Form Fields
- Border: 1px solid `Fog`
- Focus state: border changes to `Dust` (not Ember — keep Ember reserved for actions only)
- Background: transparent or barely tinted
- Label: DM Sans 10px uppercase, `Dust` color, positioned above the input
- No floating labels

### Navigation (Sidebar — Desktop/iPad)
- Background: `Ash`
- Active item: `Chalk` text, no background fill — just typography weight change to 400
- Inactive item: `Dust` text, 300 weight
- No icons-only nav — always pair icon with label
- Dividers between nav sections: 1px `Fog`

### Stat Cards (Today page, dashboard)
- **Headings** (including the primary stat figure): Times New Roman italic, 36–40px, 400 — the hero number reads as the card’s headline
- **Body and detail** (labels under the figure, secondary metrics, deltas, captions): DM Sans — e.g. label beneath at 11px uppercase, `Dust`
- No colored backgrounds on stat cards — just the number and label on `Ash`

---

## Imagery & Illustration

Photography is no longer a core design element. Pepla v2 is **typography-led** — text and data do the heavy lifting.

- **No decorative photography** in the admin dashboard
- **Line illustrations only** if visual accents are needed: thin-stroke, geometric, monochrome
- **No gradients** in illustrations
- If client profile photos appear, display them in greyscale or with low saturation

---

## Voice & Tone

Unchanged from v1, but now paired with the new visual restraint:

- Direct, confident, warm
- Speaks to creatives as equals — never preachy or instructional
- Short sentences. Let silence do work.
- No exclamation points in UI copy

---

## What Changed from v1

| Element         | v1                              | v2                                        |
|-----------------|---------------------------------|-------------------------------------------|
| Background      | `#FDF6F3` warm sand             | `#0E0E0E` near-black / `#F2EFE9` parchment |
| Accent          | Deep red `#7C1618` (frequent)   | Ember `#7C1618` (destructive only) + Sky `#C4CEDF` (positive actions) |
| Secondary color | Slate grey `#2E2C32`            | Full greyscale system (5 steps)           |
| Heading font    | Dreaming Outloud (all caps, overused) | Times New Roman italic (headers only)     |
| Logo            | Dreaming Outloud (live font)    | Canva image asset (no font needed)                |
| Body font       | Times New Roman                 | DM Sans                                   |
| Photography     | Central to the design           | Removed from admin UI                     |
| Border radius   | Not specified                   | `4px` max — near-square                   |
| Overall mood    | Desert warmth                   | Editorial stillness                       |

---

*End of Pepla Brand Guidelines v2 — March 2026*
