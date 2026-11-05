---
name: cv-pdf
description: Author, tailor, and generate one-page A4 CV/resume PDFs with this repo's JSON-driven, multi-person generator (people/<person>/cvs/*.json merged over people/<person>/profile.json → Puppeteer → output/<person>/*.pdf). Use whenever the user wants to create a new CV variant, add a new person, edit CV content (experience, education, skills, summary, languages, interests, links), target a CV at a specific job posting or company, rewrite bullets for a role, shorten a CV that runs long, or regenerate/preview a CV PDF — including phrasings like "update my CV", "make a version for this job", "add this role to my resume", "my CV doesn't fit", "make a CV for my friend", or when they paste a job description and want a matching CV. The layout silently clips anything past one page, so use the fit check here rather than generating on your own.
---

# CV PDF generator

This repo turns JSON data into one-page A4 PDFs, for any number of people. Two jobs come up: **authoring** (create or edit CV content) and **tailoring** (produce a variant aimed at a specific job posting). Both end the same way — generate, check it fits, look at it.

## How the pipeline works

Only `src/` is shared: it is the engine. Everything else belongs to one person and lives in their own folder:

```
people/<person>/
├── profile.json         # data shared by all of this person's CVs
├── cvs/<variant>.json   # one file per CV; only what differs from the profile
├── photos/
├── templates/cv-layout.html
├── components/          # HTML components that sections reference
└── common/cv-base.css
```

`src/index.js` deep-merges the variant over `profile.json` (objects merge key by key; arrays and plain values in the variant replace the profile's), assembles the page from that person's own template and components, hydrates them from the merged data, and prints to PDF with Puppeteer.

```bash
node src/index.js <person> <variant>   # one CV (variant = filename in cvs/, .json optional)
node src/index.js <person>             # every variant of one person
npm run pdf                            # everyone except people/example
```

The PDF is named after `meta.outputName`, **not** the variant filename: it writes `output/<person>/<outputName>.pdf`, falling back to the variant filename when `outputName` is unset. Two variants of the same person sharing one `outputName` overwrite each other's output, so give every new variant its own.

Everything in `people/` except `people/example/` is gitignored, so real people's content lives only on this machine. List `people/` and `people/<person>/cvs/` before assuming anything exists. If more than one person is there and the request doesn't make clear whose CV it is, ask.

## The one-page constraint is the whole game

`body` is fixed at `297mm` with `overflow: hidden`, `.main-content` is `height: 100%; overflow: hidden`, and the generator prints with `pageRanges: '1'`. Content that doesn't fit is **silently deleted** — it does not flow to page 2, and `src/index.js` prints "PDF generated successfully" either way. A CV that overflows by 3cm loses its education section with no error at all.

So generating is not the last step. After every content change:

```bash
node .agents/skills/cv-pdf/scripts/check-fit.js <person> <variant>
```

It renders exactly like the generator does, reports how much each column overflows (or how much headroom is left), names any section that starts below the page edge, and writes `output/<person>/<outputName>.preview.png`. Exit code 1 means content is being cut.

**Read the preview PNG.** The numbers tell you whether it fits; only the image tells you it looks right — a lopsided layout with 12cm of blank main column and a crammed sidebar passes the fit check and still looks bad. This is the cheapest way to catch that, so do it rather than reporting success from an exit code.

When it overflows, cut content — don't reach for CSS. A person's `common/cv-base.css` is shared by all of their variants, so shrinking a font to rescue one CV silently reflows the others. Trim in this order, since it costs the least signal: drop the oldest/least relevant role's bullets, then whole old roles, then education `details`, then interests and soft skills. Tell the user what you cut.

## Authoring or editing CV content

1. **Find the person.** List `people/`. For a new person, copy the example (`cp -R people/example people/<person>`), then fill in `profile.json`, a variant in `cvs/`, and a photo. For a new variant of an existing person, copy their closest file in `cvs/`.
2. **Decide where the change belongs.** Facts that are the same on every CV (name, photo, contact, languages, links, education) go in `profile.json`, and an edit there changes every variant of that person. Anything specific to one CV goes in the variant. To make one variant differ from the profile, set the key in the variant: objects merge, so `{"personal": {"subtitle": "…"}}` keeps the profile's name and photo, but an array such as `education` replaces the profile's whole list.
3. **Make the change.** `references/schema.md` has the field-by-field contract, the component catalog, and the `$reference` system — read it before writing JSON, because several components take fields that aren't obvious (e.g. `experience` uses a single `dateRange` string while `education` uses `startDate`/`endDate`, and most section titles are hardcoded in the person's components and can't be set from JSON).
4. **Generate, fit-check, view the preview.**

## Tailoring to a job posting

The point is emphasis, not invention. You're re-cutting the same career for a different reader.

Ground rules worth holding onto: never add a role, employer, date, degree, or credential the person doesn't already have, and don't inflate scope or seniority — a CV is a factual document they have to defend in an interview. Reordering, reweighting, reworded bullets, and dropping irrelevant material are all fair; new facts are not. If the posting wants something genuinely absent from their history, say so plainly rather than papering over it — that gap is useful information for deciding whether to apply.

1. **Read the posting** for the actual requirements: must-have tech, domain, seniority, and the vocabulary it uses. If the user gives a URL, fetch it; if they paste text, use that.
2. **Start from the closest existing variant** in `people/<person>/cvs/`, not from the example — the nearest one is usually most of the way there.
3. **Write the new file** as `people/<person>/cvs/<role-or-company>.json` with its own unique `outputName`. Keep tailoring in the variant; editing `profile.json` to tailor one CV changes all the others too.
4. **Re-aim the content:**
   - `personal.subtitle` and the summary should echo the posting's own framing of the role.
   - Order `mainSections[].items` so the most relevant roles come first when chronology allows it; within a role, lead with the bullets that match the posting.
   - Rewrite bullets to surface the matching work using the posting's vocabulary — same achievement, different emphasis. Keep the concrete numbers; they're what makes a bullet land.
   - Reorder technical skills so the posting's stack is visible first, and drop skills that are just noise for this reader. Something has to go to make room.
5. **Generate, fit-check, read the preview.** Tailoring almost always adds length, so expect at least one trimming pass.
6. **Report what changed** — which variant you started from, what you reordered or reworded, what you cut to fit, and any requirement from the posting that their background doesn't cover.

## Reference

- `references/schema.md` — full JSON contract, component catalog, `$reference` syntax, and the known template quirks (including `data-cv-if`, which looks like a conditional in the HTML but is never implemented and does nothing).
- `scripts/check-fit.js` — the fit checker described above.
