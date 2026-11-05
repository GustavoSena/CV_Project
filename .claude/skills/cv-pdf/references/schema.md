# CV JSON data contract

Each CV is rendered from one merged object: `people/<person>/profile.json` with `people/<person>/cvs/<variant>.json` deep-merged on top (objects merge key by key; arrays and plain values in the variant replace the profile's). This is the field-by-field contract for that merged object, derived from the components shipped in `people/example/components/` and the binding engine in `src/utils/injectCvData.js`. Each person has their own copy of the components and may have changed them, so check `people/<person>/components/` when their CV doesn't behave as described here.

- [Top-level shape](#top-level-shape)
- [Sections and the `$` reference system](#sections-and-the--reference-system)
- [Component catalog](#component-catalog)
- [Quirks worth knowing](#quirks-worth-knowing)

## Top-level shape

```json
{
  "meta":            { "title": "...", "outputName": "..." },
  "personal":        { "name": "...", "subtitle": "...", "photo": "photos/x.jpg" },
  "contact":         { "phone": "...", "email": "...", "location": "..." },
  "languages":       [ ... ],
  "findMeOnline":    [ ... ],
  "education":       [ ... ],
  "volunteering":    [ ... ],
  "mainSections":    [ ... ],
  "sidebarSections": [ ... ]
}
```

| Field | Notes |
|---|---|
| `meta.title` | Document title. Not visible on the page. |
| `meta.outputName` | **Determines the PDF filename** (`output/<person>/<outputName>.pdf`). Independent of the variant filename, which is only the fallback when it's unset — two variants of one person sharing an `outputName` overwrite each other. |
| `personal.name` / `personal.subtitle` | Rendered at the top of the main column. `subtitle` is the role line and is the natural thing to re-aim when tailoring. |
| `personal.photo` | Path **relative to `people/<person>/`**, so `photos/foo.jpg`. Embedded as a data URL at build time. A missing file logs a warning and renders an empty white circle — the build still "succeeds". |

`contact`, `languages`, `findMeOnline`, `education`, `volunteering` are just data pools. Nothing renders them until a section points at them (usually via `$`). You can add your own root-level keys and reference them the same way.

The renderer doesn't care whether a key comes from the profile or the variant. By convention, facts shared by every CV (`personal.name`, `personal.photo`, `contact`, `languages`, `findMeOnline`, `education`) live in `profile.json`, and `meta`, `personal.subtitle`, `mainSections` and `sidebarSections` live in each variant.

## Sections and the `$` reference system

`mainSections` (left column) and `sidebarSections` (right sidebar) are ordered arrays. Each entry names a component and carries that component's data:

```json
{ "component": "experience", "title": "EXPERIENCE", "items": [ ... ] }
```

**Order in the array is order on the page.** That's the main lever for tailoring.

Any string value starting with `$` is replaced by a root-level lookup before rendering:

```json
{ "component": "education",       "items": "$education" }
{ "component": "sidebar/contact", "phone": "$contact.phone" }
```

Two constraints: the `$` must be the *entire* value (no `"Based in $contact.location"` interpolation), and the path is always resolved from the merged document root (profile + variant), not from the section — so a variant's `"$education"` picks up the profile's education.

Inside a component, binding paths resolve against **the section config**, and inside a repeat against **the current item**, where `.` means the item itself. That's why `sidebar/interests` uses `"items": ["Hiking", "Chess"]` and binds each entry with `.`.

## Component catalog

`component` is the path under `people/<person>/components/` without `.html`. An unknown name renders an HTML comment and nothing else — no error, so check spelling if a section silently disappears.

### Main column

**`experience`** — the workhorse. `title` is settable here (unusual; see quirks).

| Field | |
|---|---|
| `title` | Section heading, e.g. `"EXPERIENCE"`. |
| `items[].role` | Job title. |
| `items[].company` | Employer. |
| `items[].clientDisplay` | Optional text shown next to the company, e.g. `"(Client: Acme)"`. This is the field that actually renders — `client` alone shows nothing. |
| `items[].location` | Right-aligned. |
| `items[].dateRange` | A **single preformatted string**, e.g. `"01/2023 - Present"`. |
| `items[].description` | Intro line, no bullet. Hidden when empty. |
| `items[].bullets[]` | Bulleted list. The first bullet renders without a bullet marker by design. |

**`education`** — heading is hardcoded as "EDUCATION".

| Field | |
|---|---|
| `items[].degree`, `items[].institution`, `items[].location` | |
| `items[].startDate` / `items[].endDate` | **Separate fields**, unlike `experience`. Rendered as `"start - end"`; omitting `endDate` yields `"Present"`. |
| `items[].details[]` | Optional bullets (GPA, thesis). `[]` is safe. |

**`volunteering`** — heading hardcoded. Fields: `items[].title`, `items[].organization`, `items[].date`.

### Sidebar

| Component | Heading | Fields |
|---|---|---|
| `sidebar/contact` | hardcoded "CONTACT INFO" | `phone`, `email`, `location` — flat on the section, not under `items` |
| `sidebar/summary` | hardcoded "SUMMARY" | `text` (single string) |
| `sidebar/languages` | hardcoded "LANGUAGES" | `items[]` of `{ name, level, maxLevel }` |
| `sidebar/skills` | **settable** via `title` | `styleClass` + `items[]` of strings |
| `sidebar/online` | hardcoded "FIND ME ONLINE" | `items[]` of `{ platform, url, displayText }` |
| `sidebar/interests` | hardcoded "INTERESTS" | `items[]` of strings |

`sidebar/skills` is the one component you can legitimately use several times (Technical Skills, Soft Skills, …) because its `title` is bindable. `styleClass` picks the layout: `"skills"` for two columns, `"skills-single"` for one. It sets `className` outright, so a typo or a missing value drops the styling entirely and the list renders unformatted.

Language levels draw filled dots. The markup contains **exactly five** circles, so `maxLevel` above 5 can't render more than five.

## Quirks worth knowing

**`data-cv-if` does nothing.** It appears in `experience.html` (`data-cv-if="client"`) and `education.html` (`data-cv-if="details.length"`) and looks like a conditional, but `injectCvData.js` never implements it. Those elements always render. It works out in practice — the bound text is empty when the data is absent — but don't add `data-cv-if` expecting it to hide anything.

**Missing fields leave placeholder text visible.** Bindings only overwrite when the resolved value is a string or number, so a missing field leaves the component's design-time placeholder in the output — an item with no `role` literally prints "Role Title", and an `education` entry with no `startDate` prints "Date Range". These reach the PDF silently, so scan the preview PNG for stray placeholder text after editing.

**Titles are mostly hardcoded.** Only `experience` and `sidebar/skills` read `title` from JSON. Renaming "VOLUNTEERING" to "COMMUNITY" means editing `people/<person>/components/volunteering.html`, which changes it for every variant of that person (other people are unaffected).

**CSS is per person.** `people/<person>/common/cv-base.css` is shared by all of that person's CVs. Adjusting spacing or font size to make one variant fit reflows the others.

**`people/example` is skipped** by `npm run pdf`, so it only produces output when named: `node src/index.js example`.

**Everything in `people/` is gitignored** except `people/example/`. Real content exists only locally.
