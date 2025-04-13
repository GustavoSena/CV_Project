# CV PDF Generator

This project converts HTML CV files to PDF files formatted for A4 size paper. It includes image optimization and ensures proper layout for professional CV/resume documents.

## Features

- Converts HTML CV to PDF with A4 dimensions
- Optimizes and embeds images
- Maintains consistent styling and layout
- Ensures content fits on a single page
- Creates small file size PDFs without quality loss

## Requirements

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Place your HTML CV file in the `src/doc` directory:
   ```
   src/doc/your-cv-file.html
   ```

3. Place any images referenced in your HTML in the same directory:
   ```
   src/doc/your-image.jpg
   ```

## Usage

Run the script to generate PDFs:

```
node src/index.js
```

The generated PDF will be saved in the `src/output` directory.

## Structure

- `src/index.js`: Main script for PDF generation
- `src/doc/`: Directory for HTML files and images
- `src/output/`: Directory where generated PDFs are saved

## Customization

You can modify the HTML file to change the content and styling of your CV. The script will handle the conversion to PDF while maintaining the layout.
