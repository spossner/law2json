# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains German legal norm data in XML format, structured according to the "Gesetze im Internet" (GiI) standard. The project includes:

- **DTD Schema**: `gii-norm.dtd` - Document Type Definition defining the XML structure for German federal laws and regulations
- **Legal Document Data**: `data/BNatSchG/BJNR254210009.xml` - Contains the German Federal Nature Conservation Act (Bundesnaturschutzgesetz) in structured XML format
- **Associated Media**: Supporting image files for the legal documents

## Architecture & Data Structure

### XML Document Structure
The XML documents follow a hierarchical structure defined by `gii-norm.dtd`:
- **Root**: `dokumente` - Container for multiple legal norms
- **Norm Level**: `norm` - Individual legal document with metadata and content
- **Metadata**: `metadaten` - Legal identifiers, dates, publication info
- **Text Data**: `textdaten` - Structured legal content with sections, paragraphs, tables

### Key XML Elements
- `jurabk`: Legal abbreviation (e.g., "BNatSchG")
- `enbez`: Article/section identifier (e.g., "§ 1")
- `titel`: Title of legal provision
- `gliederungseinheit`: Structural organization (chapters, sections)
- `Content`: Main legal text with formatting elements

### Text Formatting System
The DTD defines extensive formatting capabilities:
- Typography: `B` (bold), `I` (italic), `U` (underline)
- Lists: `DL` (definition lists), `DT` (term), `DD` (definition)
- Tables: Complex table structures with `tgroup`, `thead`, `tbody`
- References: `Citation`, `FnR` (footnote references)

## Working with Legal XML Data

When processing these documents:
- Preserve the semantic structure defined by the DTD
- Respect the hierarchical organization of legal content
- Handle multilingual content (German legal text with some Latin terms)
- Consider the relationship between metadata and content sections
- Be aware that legal documents may contain multiple versions/amendments

## File Handling Notes

- Large XML files may exceed token limits - use offset/limit parameters for reading
- Images are referenced within XML but stored separately
- The DTD file serves as the authoritative schema reference

## Project Development Status

### Current Architecture
This project includes a **XML-to-JSON transformation system** and **interactive frontend visualizer**:

- **law-transformer.js**: Core transformer converting GiI XML to frontend-friendly JSON
- **index.html**: Interactive visualization with hierarchical navigation
- **output/BNatSchG.json**: Transformed legal document structure
- **package.json**: Development workflow with Vite server

### Key Components

#### 1. XML Transformation (law-transformer.js)
- Transforms complex GiI XML into simplified hierarchical JSON structure
- Extracts table of contents and maps individual paragraphs to structure
- Converts XML formatting elements (`<P>`, `<DL>`, `<DT>`, `<DD>`) to HTML
- **Recent fix**: Changed `<P>` elements to `<div class="law-paragraph">` to properly contain `<ol>` lists
- Generates unique IDs for each legal paragraph for frontend selection

#### 2. Frontend Visualization (index.html)
- **Generic tree navigation**: Unified toggle system for chapters, sections, and future node types
- **Individual paragraph selection**: Each legal paragraph is selectable with hover highlighting
- **Multi-level hierarchy**: Supports chapters (Kapitel) → sections (Abschnitt) → paragraphs (§)
- **Search functionality**: Real-time filtering across titles and paragraph numbers

#### 3. Data Structure
**Input**: Complex nested XML with `<dokumente>` → `<norm>` → `<metadaten>`/`<textdaten>`
**Output**: Simplified JSON with:
```json
{
  "law": {
    "structure": [
      {
        "type": "chapter|section|paragraph",
        "id": "element_N", 
        "children": ["element_N+1", ...],
        "content": ["<div class=\"law-paragraph\">...</div>"],
        "subParagraphs": [{"id": "element_N_pX", ...}]
      }
    ]
  }
}
```

### Current Issues Being Addressed

#### List Integration Within Paragraphs
**Problem**: Some paragraphs contain `<DL>` elements (numbered lists) that need to render as children, not siblings
**Status**: Recently fixed HTML structure issues:
1. ✅ Fixed subparagraph recognition for paragraphs containing lists
2. ✅ Simplified regex to handle complex nested content
3. ✅ Removed problematic newlines from list HTML generation  
4. ✅ Changed `<P>` → `<div>` to allow proper `<ol>` nesting (HTML standard compliance)

**Next Step**: Test frontend highlighting to ensure paragraph+list combinations highlight together

### Development Commands
- `npm run transform-bnatschg`: Regenerate BNatSchG.json from XML
- `npm run dev`: Start Vite development server  
- `npm run demo`: Transform + start server + open browser

### Testing Examples
- **§ 20 (element_25)**: Contains 3 paragraphs, paragraph (2) has a 7-item numbered list
- **§ 21 (element_26)**: Contains 6 paragraphs, paragraph (3) has a 4-item numbered list
- Use these sections to test list rendering and paragraph selection