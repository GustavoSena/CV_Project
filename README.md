# CV PDF Generator

A modular, JSON-driven CV/resume generator that produces professional A4-sized PDFs.

## Features

- **Multi-person**: Each person has a self-contained folder (data, photos, layout, components, CSS); only the generator is shared
- **Profile + variants**: Shared data lives in one profile, each CV variant only holds what differs
- **JSON-driven**: Define CV content in JSON files, no HTML editing needed
- **Modular components**: Reusable HTML components for experience, education, skills, etc.
- **A4 PDF output**: Optimized for single-page professional CVs
- **Embedded images**: Photos and assets are embedded as data URLs
- **Customizable layout**: 70% main content / 30% sidebar split

## Requirements

- Node.js (v14 or higher)
- npm

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Generate CVs:
   ```bash
   npm run pdf                            # every person, every variant (skips example)
   npm run pdf -- <person>                # every variant of one person
   npm run pdf -- <person> <variant>      # one variant, e.g. npm run pdf -- jane-doe general
   ```

   PDFs are written to `output/<person>/<meta.outputName>.pdf`.

## Adding a Person

1. **Copy the example**:
   ```bash
   cp -R people/example people/jane-doe
   ```

2. **Edit `people/jane-doe/profile.json`** with data shared by all of that person's CVs:
   - `personal` - Name, photo path (relative to the person's folder, e.g. `photos/me.jpg`)
   - `contact` - Phone, email, location
   - `languages` - Array with name, level (1-5), maxLevel
   - `findMeOnline`, `education`, `volunteering`, or any other root-level data

3. **Edit or add variants in `people/jane-doe/cvs/`** — each file only holds what differs:
   - `meta.title` - Browser tab title
   - `meta.outputName` - Output PDF filename (without .pdf); defaults to the variant filename
   - `personal.subtitle` - Role line for this variant
   - `mainSections` - Left side content (experience, education, etc.)
   - `sidebarSections` - Right sidebar content (summary, skills, etc.)

   A variant is deep-merged over `profile.json`: objects merge key by key, arrays and values in the variant replace the profile's. `profile.json` is optional.

4. **Add a photo** to `people/jane-doe/photos/`.

5. **Customize the look** (optional) by editing that person's `templates/`, `components/` and `common/cv-base.css`. Changes only affect that person.

6. **Generate**:
   ```bash
   npm run pdf -- jane-doe
   ```

## Project Structure

```
src/                         # Shared generator (the only shared part)
├── index.js                 # CLI + PDF generation
└── utils/                   # Build, merge, inline CSS, embed images, inject data
people/
└── <person>/                # Everything specific to one person
    ├── profile.json         # Shared data for all of this person's CVs
    ├── cvs/                 # One JSON per CV variant
    │   └── general.json
    ├── photos/
    ├── templates/
    │   └── cv-layout.html   # Page skeleton
    ├── components/          # HTML components referenced by sections
    │   ├── experience.html
    │   ├── education.html
    │   ├── volunteering.html
    │   └── sidebar/
    │       ├── summary.html
    │       ├── skills.html
    │       ├── languages.html
    │       ├── contact.html
    │       ├── online.html
    │       └── interests.html
    └── common/
        └── cv-base.css      # Styles for this person's CVs
output/                      # Generated PDFs, one folder per person
```

## Git ignore rules (important)

- Everything in `people/` is ignored **except** `people/example/`, so each person's data, photos and layout stay local.

## JSON Data Structure

### Experience Items
```json
{
  "role": "Job Title",
  "company": "Company Name",
  "location": "City, Country",
  "dateRange": "01/2023 - Present",
  "description": "Brief intro without bullet point",
  "bullets": ["Achievement 1", "Achievement 2", "Stack: Tech1, Tech2"]
}
```

### Sidebar Sections
Use `$` prefix to reference root-level data:
```json
{
  "component": "sidebar/languages",
  "items": "$languages"
}
```

### Skills with Different Styles
- `"styleClass": "skills"` - Two-column layout
- `"styleClass": "skills-single"` - Single-column layout

## Available Components

Components shipped with `people/example/components/` (a person can add, remove or change their own):

| Component | Description |
|-----------|-------------|
| `experience` | Work experience with description + bullets |
| `education` | Degrees with optional details |
| `volunteering` | Volunteer work entries |
| `sidebar/summary` | Text summary block |
| `sidebar/skills` | Skills list (configurable columns) |
| `sidebar/languages` | Language proficiency with circles |
| `sidebar/contact` | Phone, email, location |
| `sidebar/online` | Social/professional links |
| `sidebar/interests` | Interests list |

## Legacy HTML Mode

Legacy HTML mode has been removed. This project is now JSON-driven only.
