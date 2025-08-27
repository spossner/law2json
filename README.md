# German Law XML Transformer & Visualizer

This project transforms complex German law XML files from [gesetze-im-internet.de](https://www.gesetze-im-internet.de/) into a simplified, frontend-friendly JSON format suitable for visualization in web applications.

## 🎯 Purpose

German legal documents from the official government portal use a complex XML structure defined by the GiI-Norm DTD. This makes it challenging to create user-friendly interfaces where users can easily browse and select specific paragraphs or sections of laws. 

This transformer creates an alternative representation that:
- ✅ Preserves the hierarchical structure (Chapters → Sections → Paragraphs)
- ✅ Maintains legal metadata and relationships
- ✅ Provides navigation-friendly data structures
- ✅ Supports search and filtering functionality
- ✅ Enables interactive frontend visualizations

## 📁 Project Structure

```
norm-xml/
├── data/
│   └── BNatSchG/
│       ├── BJNR254210009.xml      # Original XML from gesetze-im-internet.de
│       └── *.jpg                  # Associated image files
├── output/
│   └── BNatSchG.json              # Transformed JSON output
├── gii-norm.dtd                   # XML Schema definition
├── law-transformer.js             # Core transformation logic
├── LawNavigator.jsx               # React component example
├── demo.html                      # Interactive HTML demo
├── package.json                   # Dependencies and scripts
├── CLAUDE.md                      # Claude Code guidance
└── README.md                      # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Complete Demo

```bash
# Transform XML and start development server
npm run demo
```

This will:
- Transform the BNatSchG XML into JSON format
- Start a Vite development server on `http://localhost:3000`
- Automatically open your browser to view the interactive demo

### Alternative: Manual Steps

```bash
# Transform the BNatSchG example
npm run transform-bnatschg

# Start the development server
npm run dev

# Or transform any law file manually
node law-transformer.js path/to/input.xml path/to/output.json
```

### 3. View the Interactive Visualization

The demo runs at `http://localhost:3000` and provides a complete interactive interface:
- ✅ **Full Hierarchical Structure**: All 11 chapters, 8 sections, 90+ paragraphs from BNatSchG
- ✅ **Multi-Level Navigation**: Expandable chapters (Kapitel) AND sections (Abschnitt)
- ✅ **Complete Legal Content**: Full text extraction with proper formatting, numbered lists, footnotes
- ✅ **Real-time Search**: Search across all titles, paragraph numbers, and content
- ✅ **Interactive Reading**: Click paragraphs to view formatted legal text with proper indentation
- ✅ **Legal References**: Extracted footnotes with legal amendments and cross-references
- ✅ **Visual Hierarchy**: Clear indentation levels for chapters → sections → paragraphs
- ✅ **Status Indicators**: Color-coded badges for repealed, future, and amended provisions
- ✅ **Responsive Design**: Optimized for desktop and mobile legal document reading

## 📊 Data Structure

### Input: Complex XML Structure
The original XML follows the GiI-Norm DTD with nested elements:
```xml
<dokumente>
  <norm doknr="BJNR254210009">
    <metadaten>
      <jurabk>BNatSchG 2009</jurabk>
      <enbez>§ 1</enbez>
      <titel>Ziele des Naturschutzes...</titel>
      <!-- Complex metadata -->
    </metadaten>
    <textdaten>
      <!-- Complex nested content structure -->
    </textdaten>
  </norm>
  <!-- Multiple norm elements -->
</dokumente>
```

### Output: Simplified JSON Structure
```json
{
  "law": {
    "id": "BJNR254210009",
    "jurabk": "BNatSchG 2009",
    "title": "Gesetz über Naturschutz und Landschaftspflege",
    "shortTitle": "Bundesnaturschutzgesetz",
    "lastModified": "2025-03-21",
    "structure": [
      {
        "type": "chapter",
        "id": "element_1",
        "number": "Kapitel 1",
        "title": "Allgemeine Vorschriften",
        "level": 1,
        "children": ["element_2", "element_3", ...],
        "hasContent": false,
        "breadcrumb": [...]
      },
      {
        "type": "paragraph",
        "id": "element_2", 
        "number": "§ 1",
        "title": "Ziele des Naturschutzes und der Landschaftspflege",
        "level": 3,
        "hasContent": true,
        "status": "active",
        "parent": "element_1",
        "breadcrumb": [...]
      }
    ]
  }
}
```

## 🏗️ Architecture

### Core Components

1. **LawTransformer Class** (`law-transformer.js`)
   - Parses XML using xmldom
   - Extracts hierarchical structure from table of contents
   - Maps individual paragraphs to structure elements
   - Generates unique IDs and relationships
   - Creates breadcrumb navigation paths

2. **Element Types**
   - `chapter`: Top-level organizational units (Kapitel)
   - `section`: Sub-sections within chapters (Abschnitt) 
   - `paragraph`: Individual legal provisions (§)
   - `annex`: Appendices and attachments (Anlage)

3. **Frontend Components**
   - React component example (`LawNavigator.jsx`)
   - Vanilla JS demo (`demo.html`)
   - Search and navigation functionality

### Key Features

- **Hierarchical Navigation**: Preserves chapter → section → paragraph structure
- **Search Functionality**: Full-text search across titles and paragraph numbers
- **Status Tracking**: Identifies repealed, future, or amended provisions
- **Breadcrumb Navigation**: Shows location within document hierarchy
- **Content Detection**: Flags elements that contain actual legal text
- **Responsive Design**: Works on desktop and mobile devices

## 🔧 Usage Examples

### Node.js API

```javascript
const LawTransformer = require('./law-transformer.js');
const fs = require('fs');

// Transform a law file
const xmlContent = fs.readFileSync('path/to/law.xml', 'utf-8');
const transformer = new LawTransformer();
const result = transformer.transform(xmlContent);

console.log(`Transformed: ${result.law.shortTitle}`);
console.log(`Chapters: ${result.law.structure.filter(el => el.type === 'chapter').length}`);
```

### React Integration

```jsx
import LawNavigator from './LawNavigator.jsx';
import lawData from './output/BNatSchG.json';

function App() {
  return <LawNavigator lawData={lawData} />;
}
```

### Frontend Filtering

```javascript
// Filter by search term
const searchResults = lawData.law.structure.filter(element =>
  element.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
  element.number.toLowerCase().includes(searchTerm.toLowerCase())
);

// Get all paragraphs in a chapter
const chapterParagraphs = lawData.law.structure
  .filter(el => el.parent === chapterId && el.type === 'paragraph');
```

## 📈 Example Output Statistics

For the Bundesnaturschutzgesetz (BNatSchG):
- **11 Chapters** (Kapitel 1-11)
- **8 Sections** (Abschnitt 1-6 in various chapters)
- **90 Paragraphs** (§ 1 - § 74, plus § 30a, § 40a-f, etc.)
- **2 Annexes** (Anlage 1-2)

## 🎨 Frontend Visualization Features

### Interactive Elements
- ✅ Expandable/collapsible chapter navigation
- ✅ Click-to-select paragraph functionality  
- ✅ Real-time search with highlighting
- ✅ Breadcrumb navigation
- ✅ Status badges for legal provision states

### Visual Hierarchy
- **Chapters**: Bold, larger text with expand/collapse icons
- **Sections**: Medium weight text, indented
- **Paragraphs**: Regular text, further indented, clickable if content available
- **Status Indicators**: Color-coded badges for repealed/future provisions

### Responsive Design
- Mobile-friendly navigation panels
- Adaptive typography and spacing
- Touch-friendly interactive elements

## 🔍 Advanced Features

### Search Capabilities
```javascript
// Search by paragraph number
const paragraph15 = findByNumber('§ 15');

// Search by topic
const climateProvisions = searchByTitle('klima');

// Filter by status
const repealedProvisions = filterByStatus('repealed');
```

### Navigation Helpers
```javascript
// Get all children of a chapter
const chapterContents = getChildren(chapterId);

// Build breadcrumb trail
const breadcrumb = buildBreadcrumb(elementId);

// Find next/previous sibling
const nextParagraph = getNextSibling(currentId);
```

## 🛠️ Technical Details

### Dependencies
- **xmldom**: XML parsing in Node.js
- **No frontend dependencies**: Vanilla JS or bring your own framework

### Browser Compatibility
- Modern browsers with ES6+ support
- IE11+ with babel transpilation
- Mobile browsers (iOS Safari, Chrome Mobile)

### Performance
- Handles large law documents (100+ paragraphs) efficiently
- Lazy loading of content sections
- Optimized search with debouncing
- Memory-efficient DOM updates

## 📝 XML Structure Analysis

The original GiI XML format uses several key elements:

- `<dokumente>` - Root container
- `<norm>` - Individual legal provisions  
- `<metadaten>` - Legal metadata (identifiers, dates, titles)
- `<textdaten>` - Content structure
- `<gliederungseinheit>` - Chapter/section organization
- `<enbez>` - Paragraph numbering (e.g., "§ 1")
- `<titel>` - Legal provision titles
- `<TOC>` - Table of contents with hierarchical structure

The transformer extracts this complex nested structure and flattens it into a navigable tree while preserving all relationships.

## 🚀 Future Enhancements

- **Content Extraction**: Parse actual legal text from `<Content>` elements
- **Cross-References**: Extract and link internal references between paragraphs
- **Amendment History**: Track changes over time using `builddate` attributes
- **Multi-Language**: Support for legal documents in other languages
- **Export Options**: Generate PDF, Word, or other output formats
- **Advanced Search**: Full-text search within legal content, not just titles
- **API Server**: REST API for law document querying and navigation

## 📜 Legal Notice

This project transforms publicly available legal documents from gesetze-im-internet.de. The original XML files and their content remain under their respective licenses. This tool is for educational and development purposes to improve accessibility of German legal documents.

## 🤝 Contributing

Contributions welcome! Please feel free to submit pull requests for:
- Additional law document formats
- Enhanced visualization components  
- Performance improvements
- Bug fixes and edge cases
- Documentation improvements

## 📖 Related Resources

- [gesetze-im-internet.de](https://www.gesetze-im-internet.de/) - Source of German law XML files
- [GiI-Norm DTD Documentation](https://www.gesetze-im-internet.de/gii-norm.dtd) - XML schema definition
- [German Legal System Overview](https://en.wikipedia.org/wiki/Law_of_Germany) - Background on German law structure