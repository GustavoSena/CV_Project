# CV PDF Generator

A modular, JSON-driven CV/resume generator that produces professional A4-sized PDFs.

## Features

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

2. Generate all CVs:
   ```bash
   npm run pdf
   ```

3. Generate a specific CV:
   ```bash
   npm run pdf:crypto    
   npm run pdf:general   
   ```

## Creating a New CV

1. **Copy the template**:
   ```bash
   cp src/doc/data/_template.json src/doc/data/CV_Your_Name.json
   ```

2. **Edit your JSON file** with your information:
   - `meta.title` - Browser tab title
   - `meta.outputName` - Output PDF filename (without .pdf)
   - `personal` - Name, subtitle, photo filename
   - `contact` - Phone, email, location
   - `languages` - Array with name, level (1-5), maxLevel
   - `education` - Array of degrees with details
   - `mainSections` - Left side content (experience, education, etc.)
   - `sidebarSections` - Right sidebar content (summary, skills, etc.)

3. **Add your photo** to `src/doc/photos/` directory

4. **Generate your CV**:
   ```bash
   node src/index.js CV_Your_Name
   ```

## Project Structure

```
src/
├── index.js                 # Main PDF generation script
├── doc/
│   ├── data/                # CV JSON data files
│   │   └── _template.json   # Template for new CVs
│   ├── photos/              # Photos (gitignored, folder tracked via .gitkeep)
│   ├── templates/
│   │   └── cv-layout.html   # Main layout skeleton
│   ├── components/          # Reusable HTML components
│   │   ├── experience.html
│   │   ├── education.html
│   │   ├── volunteering.html
│   │   └── sidebar/
│   │       ├── summary.html
│   │       ├── skills.html
│   │       ├── languages.html
│   │       ├── contact.html
│   │       ├── online.html
│   │       └── interests.html
│   └── common/
│       └── cv-base.css      # Shared styles
├── utils/                   # Helper modules
└── output/                  # Generated PDFs
```

## JSON Data Structure

## Git ignore rules (important)

- **CV data**: everything in `src/doc/data/*.json` is ignored **except** `src/doc/data/_template.json`
- **Photos**: everything in `src/doc/photos/*` is ignored **except** `src/doc/photos/.gitkeep`

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
