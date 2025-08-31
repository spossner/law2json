/**
 * German Law XML to Hierarchical JSON Transformer
 * 
 * Transforms GiI XML format into hierarchical JSON structure 
 * according to german-legal-json-schema.json
 */

const fs = require('fs');
const { DOMParser } = require('xmldom');

class HierarchicalLawTransformer {
  constructor() {
    this.currentId = 0;
  }

  generateId() {
    return `element_${++this.currentId}`;
  }

  /**
   * Transform a GiI XML document into hierarchical JSON structure
   * @param {string} xmlContent - The XML content to transform
   * @returns {Object} Transformed law structure matching JSON schema
   */
  transform(xmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    
    const dokumente = doc.documentElement;
    const norms = Array.from(dokumente.getElementsByTagName('norm'));
    
    // Extract law metadata
    const mainNorm = norms[0];
    const lawMetadata = this.extractLawMetadata(mainNorm);
    
    // Build hierarchical structure
    const structure = this.buildHierarchicalStructure(norms);
    
    return {
      law: {
        title: lawMetadata.title,
        abbreviation: lawMetadata.abbreviation,
        structure: structure
      }
    };
  }

  extractLawMetadata(norm) {
    const metadaten = norm.getElementsByTagName('metadaten')[0];
    if (!metadaten) return { title: '', abbreviation: '' };

    const jurabk = this.getElementText(metadaten, 'jurabk');
    const langue = this.getElementText(metadaten, 'langue');
    const kurzue = this.getElementText(metadaten, 'kurzue');
    
    return {
      title: langue || kurzue || jurabk,
      abbreviation: jurabk
    };
  }

  buildHierarchicalStructure(norms) {
    // Find TOC and paragraph norms
    const tocNorm = norms.find(norm => {
      const enbez = this.getElementText(norm, 'enbez');
      return enbez === 'Inhaltsübersicht';
    });

    const paragraphNorms = norms.filter(norm => {
      const enbez = this.getElementText(norm, 'enbez');
      return enbez && (enbez.startsWith('§') || enbez.startsWith('Anlage'));
    });

    // Create paragraph content map
    const paragraphMap = new Map();
    paragraphNorms.forEach(norm => {
      const enbez = this.getElementText(norm, 'enbez');
      if (enbez) {
        paragraphMap.set(enbez, norm);
      }
    });

    let structure = [];

    if (tocNorm) {
      structure = this.extractHierarchyFromTOC(tocNorm, paragraphMap);
    } else {
      // Fallback: create flat structure from paragraphs
      structure = this.createFlatStructure(paragraphNorms);
    }

    return structure;
  }

  extractHierarchyFromTOC(tocNorm, paragraphMap) {
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
            children: []
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
            children: []
          };
          
          if (currentChapter) {
            currentChapter.children.push(currentSection);
          } else {
            structure.push(currentSection);
          }
        }
      } else if (element.tagName === 'table') {
        // Extract paragraphs from table and add to hierarchy
        const paragraphs = this.extractParagraphsFromTable(element, paragraphMap);
        paragraphs.forEach(paragraph => {
          if (currentSection) {
            currentSection.children.push(paragraph);
          } else if (currentChapter) {
            currentChapter.children.push(paragraph);
          } else {
            structure.push(paragraph);
          }
        });
      }
    }

    return structure;
  }

  extractParagraphsFromTable(table, paragraphMap) {
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
          const paragraph = {
            type: 'paragraph',
            id: this.generateId(),
            number: number,
            title: title,
            children: []
          };

          // Add content from paragraph norm if available
          // Normalize paragraph number for lookup (remove extra spaces)
          const normalizedNumber = number.replace(/\s+/g, ' ').trim();
          const norm = paragraphMap.get(normalizedNumber);
          if (norm) {
            const subParagraphs = this.extractSubParagraphs(norm, paragraph.id);
            paragraph.children = subParagraphs;
          }

          paragraphs.push(paragraph);
        }
      }
    });
    
    return paragraphs;
  }

  createFlatStructure(paragraphNorms) {
    return paragraphNorms.map(norm => {
      const enbez = this.getElementText(norm, 'enbez');
      const metadaten = norm.getElementsByTagName('metadaten')[0];
      const title = metadaten ? this.getElementText(metadaten, 'titel') : '';

      const paragraph = {
        type: 'paragraph',
        id: this.generateId(),
        number: enbez,
        title: title,
        children: []
      };

      const subParagraphs = this.extractSubParagraphs(norm, paragraph.id);
      paragraph.children = subParagraphs;

      return paragraph;
    });
  }

  extractSubParagraphs(norm, paragraphId) {
    const textdaten = norm.getElementsByTagName('textdaten')[0];
    if (!textdaten) return [];

    const textElement = textdaten.getElementsByTagName('text')[0];
    const contentElements = textElement ? textElement.getElementsByTagName('Content') : 
                           textdaten.getElementsByTagName('Content');

    const subParagraphs = [];
    let subParagraphIndex = 0;

    for (let i = 0; i < contentElements.length; i++) {
      const contentElement = contentElements[i];
      const pElements = contentElement.getElementsByTagName('P');

      for (let j = 0; j < pElements.length; j++) {
        const pElement = pElements[j];
        subParagraphIndex++;

        // Extract paragraph number from content
        const textContent = this.getNodeText(pElement);
        const numberMatch = textContent.match(/^\((\d+[a-z]?)\)/);
        const subParagraphNumber = numberMatch ? numberMatch[1] : subParagraphIndex.toString();

        const subParagraph = {
          type: 'subparagraph',
          id: `${paragraphId}_${subParagraphIndex}`,
          number: `(${subParagraphNumber})`,
          children: this.processElementContent(pElement)
        };

        subParagraphs.push(subParagraph);
      }
    }

    return subParagraphs;
  }

  processElementContent(element) {
    const contentElements = [];
    
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      const processed = this.processContentNode(node);
      if (processed) {
        contentElements.push(...processed);
      }
    }

    return this.consolidateTextElements(contentElements);
  }

  processContentNode(node) {
    if (!node) return null;

    switch (node.nodeType) {
      case 1: // Element node
        return this.processContentElement(node);
      case 3: // Text node
        const text = (node.nodeValue || '').trim();
        return text ? [{ type: 'text', text: text }] : null;
      default:
        return null;
    }
  }

  processContentElement(element) {
    const tagName = element.tagName;

    switch (tagName) {
      case 'DL':
        return [this.processDefinitionList(element)];

      case 'IMG':
        return [this.processImage(element)];

      case 'table':
        return [this.processTable(element)];

      case 'BR':
        return [{ type: 'line_break' }];

      case 'B':
        return [{ type: 'formatted_text', style: 'bold', text: this.getNodeText(element) }];

      case 'I':
        return [{ type: 'formatted_text', style: 'italic', text: this.getNodeText(element) }];

      case 'U':
        return [{ type: 'formatted_text', style: 'underline', text: this.getNodeText(element) }];

      case 'SUB':
        return [{ type: 'formatted_text', style: 'subscript', text: this.getNodeText(element) }];

      case 'SUP':
        return [{ type: 'formatted_text', style: 'superscript', text: this.getNodeText(element) }];

      case 'SP':
        return [{ type: 'formatted_text', style: 'spacing', text: this.getNodeText(element) }];

      case 'pre':
        return [{ type: 'preformatted', text: this.getNodeText(element) }];

      case 'kommentar':
        const commentType = element.getAttribute('typ') || 'Hinweis';
        return [{ type: 'comment', commentType: commentType, text: this.getNodeText(element) }];

      default:
        // For other elements, process children and return as text
        const text = this.getNodeText(element).trim();
        return text ? [{ type: 'text', text: text }] : null;
    }
  }

  processDefinitionList(dlElement) {
    const type = dlElement.getAttribute('Type') || 'arabic';
    const listType = this.mapListType(type);
    
    const listItems = [];
    const dtElements = dlElement.getElementsByTagName('DT');
    const ddElements = dlElement.getElementsByTagName('DD');

    for (let i = 0; i < Math.min(dtElements.length, ddElements.length); i++) {
      const dtElement = dtElements[i];
      const ddElement = ddElements[i];
      
      // Get content from DD/LA structure
      const laElements = ddElement.getElementsByTagName('LA');
      const itemText = laElements.length > 0 ? 
        this.getNodeText(laElements[0]) : 
        this.getNodeText(ddElement);

      if (itemText.trim()) {
        const listItem = {
          type: 'list_item',
          text: itemText.trim()
        };
        listItems.push(listItem);
      }
    }

    const result = {
      type: 'ordered_list',
      listType: listType,
      children: listItems
    };

    // Add symbol for Symbol type lists
    if (type === 'Symbol') {
      result.symbol = '•'; // Default symbol, could be extracted from content
    }

    return result;
  }

  processImage(imgElement) {
    return {
      type: 'image',
      src: imgElement.getAttribute('SRC') || '',
      width: parseInt(imgElement.getAttribute('Width')) || null,
      height: parseInt(imgElement.getAttribute('Height')) || null,
      alt: imgElement.getAttribute('alt') || '',
      align: imgElement.getAttribute('Align') || null
    };
  }

  processTable(tableElement) {
    // Simplified table processing - could be enhanced
    const tgroups = tableElement.getElementsByTagName('tgroup');
    if (tgroups.length === 0) return null;

    const tgroup = tgroups[0];
    const cols = parseInt(tgroup.getAttribute('cols')) || 1;
    
    const rows = [];
    const rowElements = tgroup.getElementsByTagName('row');
    
    for (let i = 0; i < rowElements.length; i++) {
      const rowElement = rowElements[i];
      const entries = rowElement.getElementsByTagName('entry');
      const rowData = [];
      
      for (let j = 0; j < entries.length; j++) {
        rowData.push(this.getNodeText(entries[j]).trim());
      }
      
      if (rowData.some(cell => cell)) {
        rows.push(rowData);
      }
    }

    return {
      type: 'table',
      columns: cols,
      rows: rows,
      frame: tableElement.getAttribute('frame') || 'none'
    };
  }

  mapListType(xmlType) {
    const typeMap = {
      'arabic': 'arabic',
      'alpha': 'alpha', 
      'Alpha': 'Alpha',
      'roman': 'roman',
      'Roman': 'Roman',
      'Dash': 'Dash',
      'Bullet': 'Bullet',
      'Symbol': 'Symbol',
      'None': 'None'
    };
    
    return typeMap[xmlType] || 'arabic';
  }

  consolidateTextElements(elements) {
    if (!elements || elements.length === 0) return [];

    const consolidated = [];
    let currentTextParts = [];

    elements.forEach(element => {
      if (element.type === 'text') {
        currentTextParts.push(element.text);
      } else {
        // Flush accumulated text
        if (currentTextParts.length > 0) {
          consolidated.push({
            type: 'text',
            text: currentTextParts.join(' ').trim()
          });
          currentTextParts = [];
        }
        
        consolidated.push(element);
      }
    });

    // Flush any remaining text
    if (currentTextParts.length > 0) {
      consolidated.push({
        type: 'text',
        text: currentTextParts.join(' ').trim()
      });
    }

    return consolidated.filter(el => 
      el.type !== 'text' || (el.text && el.text.trim())
    );
  }

  getElementText(parent, tagName) {
    const element = parent.getElementsByTagName(tagName)[0];
    return element ? this.getNodeText(element) : '';
  }

  getNodeText(node) {
    if (!node) return '';
    return node.textContent || node.innerText || '';
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HierarchicalLawTransformer;
}

// Example usage function
function transformLawFile(inputPath, outputPath) {
  try {
    const xmlContent = fs.readFileSync(inputPath, 'utf-8');
    const transformer = new HierarchicalLawTransformer();
    const result = transformer.transform(xmlContent);
    
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Hierarchical law document saved to: ${outputPath}`);
    
    // Print summary
    const countElements = (elements, type) => {
      let count = 0;
      elements.forEach(el => {
        if (el.type === type) count++;
        if (el.children) count += countElements(el.children, type);
      });
      return count;
    };

    const stats = {
      chapters: countElements(result.law.structure, 'chapter'),
      sections: countElements(result.law.structure, 'section'),
      paragraphs: countElements(result.law.structure, 'paragraph'),
      subparagraphs: countElements(result.law.structure, 'subparagraph')
    };
    
    console.log('Document structure:', stats);
    
  } catch (error) {
    console.error('Error transforming law file:', error.message);
    console.error(error.stack);
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length >= 2) {
    transformLawFile(args[0], args[1]);
  } else {
    console.log('Usage: node law-transformer-hierarchical.js <input.xml> <output.json>');
    console.log('Example: node law-transformer-hierarchical.js data/BNatSchG/BJNR254210009.xml output/BNatSchG-hierarchical.json');
  }
}