/**
 * German Law XML to Frontend-Friendly JSON Transformer
 * 
 * This script transforms the complex GiI XML format from gesetze-im-internet.de
 * into a simplified hierarchical structure suitable for frontend visualization
 */

const fs = require('fs');
const { DOMParser } = require('xmldom');

class LawTransformer {
  constructor() {
    this.currentId = 0;
  }

  generateId() {
    return `element_${++this.currentId}`;
  }

  /**
   * Transform a GiI XML document into a visualization-friendly structure
   * @param {string} xmlContent - The XML content to transform
   * @returns {Object} Transformed law structure
   */
  transform(xmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    
    const dokumente = doc.documentElement;
    const norms = Array.from(dokumente.getElementsByTagName('norm'));
    
    // Find the main law norm (first norm with basic metadata)
    const mainNorm = norms[0];
    const lawMetadata = this.extractLawMetadata(mainNorm);
    
    // Find the table of contents norm
    const tocNorm = norms.find(norm => {
      const enbez = this.getElementText(norm, 'enbez');
      return enbez === 'Inhaltsübersicht';
    });
    
    let structure = [];
    if (tocNorm) {
      structure = this.extractStructureFromTOC(tocNorm);
    }
    
    // Find individual paragraph norms and map them to structure
    const paragraphNorms = norms.filter(norm => {
      const enbez = this.getElementText(norm, 'enbez');
      return enbez && enbez.startsWith('§');
    });
    
    this.mapParagraphsToStructure(structure, paragraphNorms);
    
    return {
      law: {
        ...lawMetadata,
        structure: structure
      }
    };
  }

  extractLawMetadata(norm) {
    const metadaten = norm.getElementsByTagName('metadaten')[0];
    if (!metadaten) return {};

    const builddate = norm.getAttribute('builddate');
    const doknr = norm.getAttribute('doknr');
    
    return {
      id: doknr,
      jurabk: this.getElementText(metadaten, 'jurabk'),
      title: this.getElementText(metadaten, 'langue') || this.getElementText(metadaten, 'kurzue'),
      shortTitle: this.getElementText(metadaten, 'kurzue'),
      lastModified: this.formatBuildDate(builddate),
      source: 'gesetze-im-internet.de'
    };
  }

  extractStructureFromTOC(tocNorm) {
    const textdaten = tocNorm.getElementsByTagName('textdaten')[0];
    if (!textdaten) return [];

    const toc = textdaten.getElementsByTagName('TOC')[0];
    if (!toc) return [];

    const structure = [];
    let currentChapter = null;
    let currentSection = null;

    // Process TOC elements in order
    const tocChildren = Array.from(toc.childNodes).filter(node => 
      node.nodeType === 1 && (node.tagName === 'Ident' || node.tagName === 'Title' || node.tagName === 'table')
    );

    for (let i = 0; i < tocChildren.length; i++) {
      const element = tocChildren[i];
      
      if (element.tagName === 'Ident') {
        const className = element.getAttribute('Class');
        const text = this.getNodeText(element);
        
        if (className === 'S0' && text.startsWith('Kapitel')) {
          // New chapter
          const nextElement = tocChildren[i + 1];
          const title = nextElement && nextElement.tagName === 'Title' ? this.getNodeText(nextElement) : '';
          
          currentChapter = {
            type: 'chapter',
            id: this.generateId(),
            number: text,
            title: title,
            level: 1,
            children: [],
            hasContent: false
          };
          structure.push(currentChapter);
          currentSection = null;
          
        } else if (className === 'S2') {
          // New section within chapter
          const nextElement = tocChildren[i + 1];
          const title = nextElement && nextElement.tagName === 'Title' ? this.getNodeText(nextElement) : '';
          
          currentSection = {
            type: 'section', 
            id: this.generateId(),
            number: text,
            title: title,
            level: 2,
            children: [],
            hasContent: false,
            parent: currentChapter ? currentChapter.id : null
          };
          
          if (currentChapter) {
            currentChapter.children.push(currentSection.id);
            structure.push(currentSection);
          }
        }
      } else if (element.tagName === 'table') {
        // Extract paragraphs from table
        const paragraphs = this.extractParagraphsFromTable(element);
        paragraphs.forEach(paragraph => {
          paragraph.parent = currentSection ? currentSection.id : (currentChapter ? currentChapter.id : null);
          
          if (currentSection) {
            currentSection.children.push(paragraph.id);
          } else if (currentChapter) {
            currentChapter.children.push(paragraph.id);
          }
          
          structure.push(paragraph);
        });
      }
    }

    return structure;
  }

  extractParagraphsFromTable(table) {
    const paragraphs = [];
    const rows = table.getElementsByTagName('row');
    
    Array.from(rows).forEach(row => {
      const entries = row.getElementsByTagName('entry');
      if (entries.length >= 2) {
        const numberEntry = entries[0];
        const titleEntry = entries[1];
        
        const number = this.getNodeText(numberEntry).trim();
        const title = this.getNodeText(titleEntry).trim();
        
        if (number && title && (number.startsWith('§') || number.startsWith('Anlage'))) {
          paragraphs.push({
            type: number.startsWith('§') ? 'paragraph' : 'annex',
            id: this.generateId(),
            number: number,
            title: title,
            level: 3,
            children: [],
            hasContent: true,
            status: title.includes('(weggefallen)') ? 'repealed' : 
                   title.includes('(zukünftig in Kraft)') ? 'future' : 'active'
          });
        }
      }
    });
    
    return paragraphs;
  }

  mapParagraphsToStructure(structure, paragraphNorms) {
    // Create a map for quick paragraph lookup
    const paragraphMap = new Map();
    paragraphNorms.forEach(norm => {
      const enbez = this.getElementText(norm, 'enbez');
      if (enbez) {
        paragraphMap.set(enbez, norm);
      }
    });

    // Update structure elements with actual content information
    structure.forEach(element => {
      if (element.type === 'paragraph' || element.type === 'annex') {
        const norm = paragraphMap.get(element.number);
        if (norm) {
          const textdaten = norm.getElementsByTagName('textdaten')[0];
          element.hasContent = !!(textdaten && textdaten.getElementsByTagName('text')[0]);
          
          // Add additional metadata
          const metadaten = norm.getElementsByTagName('metadaten')[0];
          if (metadaten) {
            element.fullTitle = this.getElementText(metadaten, 'titel');
          }
          
          // Extract formatted legal content
          if (element.hasContent && textdaten) {
            const rawContent = this.extractFormattedContent(textdaten);
            const processedContent = this.processContentWithParagraphIds(rawContent, element.id);
            element.content = processedContent.content;
            element.subParagraphs = processedContent.subParagraphs;
          }
          
          // Extract footnotes if present
          const footnotes = textdaten ? textdaten.getElementsByTagName('fussnoten')[0] : null;
          if (footnotes) {
            element.footnotes = this.extractFormattedContent(footnotes);
          }
        }
      }
    });
  }

  getElementText(parent, tagName) {
    const element = parent.getElementsByTagName(tagName)[0];
    return element ? this.getNodeText(element) : '';
  }

  getNodeText(node) {
    if (!node) return '';
    return node.textContent || node.innerText || '';
  }

  formatBuildDate(builddate) {
    if (!builddate) return null;
    // Format: YYYYMMDDHHMMSS -> YYYY-MM-DD
    if (builddate.length >= 8) {
      const year = builddate.substring(0, 4);
      const month = builddate.substring(4, 6);
      const day = builddate.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
    return builddate;
  }

  /**
   * Extract and format legal content from textdaten elements
   */
  extractFormattedContent(textdaten) {
    const content = [];
    
    // Look for text and Content elements
    const textElement = textdaten.getElementsByTagName('text')[0];
    const contentElements = textElement ? textElement.getElementsByTagName('Content') : 
                           textdaten.getElementsByTagName('Content');
    
    for (let i = 0; i < contentElements.length; i++) {
      const contentElement = contentElements[i];
      const formattedContent = this.processContentElement(contentElement);
      if (formattedContent.trim()) {
        content.push(formattedContent);
      }
    }
    
    return content;
  }

  /**
   * Process a Content element and convert to HTML
   */
  processContentElement(element) {
    if (!element || !element.childNodes) return '';
    
    let html = '';
    
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      html += this.processNode(node);
    }
    
    return html.trim();
  }

  /**
   * Process individual XML nodes and convert to HTML
   */
  processNode(node) {
    if (!node) return '';
    
    switch (node.nodeType) {
      case 1: // Element node
        return this.processElement(node);
      case 3: // Text node
        return this.escapeHtml(node.nodeValue || '');
      default:
        return '';
    }
  }

  /**
   * Process XML elements and convert to appropriate HTML
   */
  processElement(element) {
    const tagName = element.tagName;
    let content = '';
    
    // Process child nodes
    for (let i = 0; i < element.childNodes.length; i++) {
      content += this.processNode(element.childNodes[i]);
    }
    
    switch (tagName) {
      case 'P':
        return `<p class="law-paragraph">${content}</p>\n`;
        
      case 'DL':
        const type = element.getAttribute('Type') || 'arabic';
        const className = `law-list law-list-${type}`;
        return `<ol class="${className}">${content}</ol>\n`;
        
      case 'DT':
        return `<li class="law-list-term">${content}`;
        
      case 'DD':
        return `<div class="law-list-definition">${content}</div></li>\n`;
        
      case 'LA':
        return content; // Just return the content, it's wrapped by DD
        
      case 'BR':
        return '<br>';
        
      case 'B':
        return `<strong>${content}</strong>`;
        
      case 'I':
        return `<em>${content}</em>`;
        
      case 'U':
        return `<u>${content}</u>`;
        
      case 'small':
        return `<small>${content}</small>`;
        
      case 'SUP':
        return `<sup>${content}</sup>`;
        
      case 'SUB':
        return `<sub>${content}</sub>`;
        
      case 'pre':
        return `<pre class="law-preformatted">${content}</pre>\n`;
        
      case 'table':
        return this.processTable(element);
        
      case 'Citation':
        return `<cite class="law-citation">${content}</cite>`;
        
      case 'FnR':
        const fnId = element.getAttribute('ID') || '';
        return `<sup class="law-footnote-ref"><a href="#fn-${fnId}">${content}</a></sup>`;
        
      case 'kommentar':
        const typ = element.getAttribute('typ') || '';
        return `<div class="law-comment law-comment-${typ.toLowerCase()}">${content}</div>\n`;
        
      default:
        // For unknown elements, just return the content
        return content;
    }
  }

  /**
   * Process table elements
   */
  processTable(table) {
    let html = '<table class="law-table">';
    
    // Process table children
    for (let i = 0; i < table.childNodes.length; i++) {
      const node = table.childNodes[i];
      if (node.nodeType === 1) {
        switch (node.tagName) {
          case 'Title':
            html += `<caption class="law-table-title">${this.processNode(node)}</caption>`;
            break;
          case 'tgroup':
            html += this.processTableGroup(node);
            break;
        }
      }
    }
    
    html += '</table>\n';
    return html;
  }

  /**
   * Process table group (tgroup) elements
   */
  processTableGroup(tgroup) {
    let html = '';
    
    for (let i = 0; i < tgroup.childNodes.length; i++) {
      const node = tgroup.childNodes[i];
      if (node.nodeType === 1) {
        switch (node.tagName) {
          case 'thead':
            html += '<thead>' + this.processTableSection(node) + '</thead>';
            break;
          case 'tbody':
            html += '<tbody>' + this.processTableSection(node) + '</tbody>';
            break;
          case 'tfoot':
            html += '<tfoot>' + this.processTableSection(node) + '</tfoot>';
            break;
        }
      }
    }
    
    return html;
  }

  /**
   * Process table sections (thead, tbody, tfoot)
   */
  processTableSection(section) {
    let html = '';
    
    for (let i = 0; i < section.childNodes.length; i++) {
      const node = section.childNodes[i];
      if (node.nodeType === 1 && node.tagName === 'row') {
        html += '<tr>';
        
        // Process row entries
        for (let j = 0; j < node.childNodes.length; j++) {
          const entry = node.childNodes[j];
          if (entry.nodeType === 1 && entry.tagName === 'entry') {
            const cellContent = this.processNode(entry);
            const isHeader = section.tagName === 'thead';
            const tag = isHeader ? 'th' : 'td';
            html += `<${tag} class="law-table-cell">${cellContent}</${tag}>`;
          }
        }
        
        html += '</tr>';
      }
    }
    
    return html;
  }

  /**
   * Process content and add unique IDs to each law-paragraph
   */
  processContentWithParagraphIds(contentArray, elementId) {
    const processedContent = [];
    const subParagraphs = [];
    let paragraphIndex = 0;
    
    contentArray.forEach(content => {
      // Replace law-paragraph elements with ones that have unique IDs
      // Use a simpler regex that matches ANY content inside <p class="law-paragraph">
      const processedHtml = content.replace(
        /<p class="law-paragraph">(.*?)<\/p>/gs,
        (match, fullContent) => {
          paragraphIndex++;
          const paragraphId = `${elementId}_p${paragraphIndex}`;
          
          // Extract paragraph number if it exists at the beginning
          const numberMatch = fullContent.match(/^\(([0-9]+)\)/);
          const paragraphNumber = numberMatch ? numberMatch[1] : paragraphIndex.toString();
          const fullText = fullContent;
          
          // Create sub-paragraph entity
          subParagraphs.push({
            id: paragraphId,
            number: paragraphNumber,
            text: fullText.trim(),
            parentId: elementId
          });
          
          return `<p class="law-paragraph" id="${paragraphId}" data-paragraph-id="${paragraphId}">${fullText}</p>`;
        }
      );
      
      processedContent.push(processedHtml);
    });
    
    return {
      content: processedContent,
      subParagraphs: subParagraphs
    };
  }


  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    const div = { innerHTML: '', textContent: text };
    if (typeof document !== 'undefined') {
      const element = document.createElement('div');
      element.textContent = text;
      return element.innerHTML;
    }
    // Fallback for Node.js environment
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Helper method to add breadcrumb navigation
  addBreadcrumbs(structure) {
    const elementMap = new Map();
    structure.forEach(el => elementMap.set(el.id, el));

    structure.forEach(element => {
      element.breadcrumb = [];
      let current = element;
      
      while (current) {
        element.breadcrumb.unshift({
          id: current.id,
          title: current.title,
          number: current.number
        });
        current = current.parent ? elementMap.get(current.parent) : null;
      }
    });

    return structure;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LawTransformer;
}

// Example usage function
function transformLawFile(inputPath, outputPath) {
  try {
    const xmlContent = fs.readFileSync(inputPath, 'utf-8');
    const transformer = new LawTransformer();
    const result = transformer.transform(xmlContent);
    
    // Add breadcrumbs for navigation
    result.law.structure = transformer.addBreadcrumbs(result.law.structure);
    
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Transformed law document saved to: ${outputPath}`);
    
    // Print summary
    const stats = {
      chapters: result.law.structure.filter(el => el.type === 'chapter').length,
      sections: result.law.structure.filter(el => el.type === 'section').length,
      paragraphs: result.law.structure.filter(el => el.type === 'paragraph').length,
      annexes: result.law.structure.filter(el => el.type === 'annex').length
    };
    
    console.log('Document structure:', stats);
    
  } catch (error) {
    console.error('Error transforming law file:', error.message);
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length >= 2) {
    transformLawFile(args[0], args[1]);
  } else {
    console.log('Usage: node law-transformer.js <input.xml> <output.json>');
    console.log('Example: node law-transformer.js data/BNatSchG/BJNR254210009.xml output/BNatSchG.json');
  }
}