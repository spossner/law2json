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