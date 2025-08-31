/**
 * German Law XML to Hierarchical JSON Transformer (TypeScript)
 * 
 * Transforms GiI XML format into hierarchical JSON structure 
 * according to german-legal-json-schema.json
 */

import * as fs from 'fs';
import { DOMParser } from 'xmldom';

// Types for the hierarchical JSON structure
export type ListType = 'arabic' | 'alpha' | 'Alpha' | 'roman' | 'Roman' | 'Dash' | 'Bullet' | 'Symbol' | 'None';
export type FormattingStyle = 'bold' | 'italic' | 'underline' | 'subscript' | 'superscript' | 'spacing';
export type CommentType = 'Stand' | 'Stand-Hinweis' | 'Hinweis' | 'Fundstelle' | 'Verarbeitung';

export interface TextElement {
  type: 'text';
  text: string;
}

export interface FormattedTextElement {
  type: 'formatted_text';
  style: FormattingStyle;
  text: string;
}

export interface LineBreakElement {
  type: 'line_break';
}

export interface PreformattedElement {
  type: 'preformatted';
  text: string;
}

export interface CommentElement {
  type: 'comment';
  commentType: CommentType;
  text: string;
}

export interface ListItemElement {
  type: 'list_item';
  text?: string;
  children?: ContentElement[];
}

export interface OrderedListElement {
  type: 'ordered_list';
  listType: ListType;
  symbol?: string;
  children: ListItemElement[];
}

export interface ImageElement {
  type: 'image';
  src: string;
  width?: number;
  height?: number;
  alt?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableElement {
  type: 'table';
  columns: number;
  headers?: string[];
  rows: (string | ContentElement)[][];
  frame?: 'none' | 'all' | 'top' | 'bottom' | 'topbot' | 'sides';
}

export type ContentElement = 
  | TextElement 
  | FormattedTextElement
  | LineBreakElement
  | PreformattedElement
  | CommentElement
  | ListItemElement
  | OrderedListElement
  | ImageElement
  | TableElement;

export interface StructuralElement {
  type: 'chapter' | 'section' | 'paragraph' | 'subparagraph';
  id: string;
  number?: string;
  title?: string;
  children: (StructuralElement | ContentElement)[];
}

export interface LawDocument {
  law: {
    title: string;
    abbreviation: string;
    structure: StructuralElement[];
  };
}

export class HierarchicalLawTransformer {
  private currentId: number = 0;

  private generateId(): string {
    return `element_${++this.currentId}`;
  }

  /**
   * Transform a GiI XML document into hierarchical JSON structure
   */
  transform(xmlContent: string): LawDocument {
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

  private extractLawMetadata(norm: Element): { title: string; abbreviation: string } {
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

  private buildHierarchicalStructure(norms: Element[]): StructuralElement[] {
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
    const paragraphMap = new Map<string, Element>();
    paragraphNorms.forEach(norm => {
      const enbez = this.getElementText(norm, 'enbez');
      if (enbez) {
        paragraphMap.set(enbez, norm);
      }
    });

    let structure: StructuralElement[] = [];

    if (tocNorm) {
      structure = this.extractHierarchyFromTOC(tocNorm, paragraphMap);
    } else {
      // Fallback: create flat structure from paragraphs
      structure = this.createFlatStructure(paragraphNorms);
    }

    return structure;
  }

  private extractHierarchyFromTOC(tocNorm: Element, paragraphMap: Map<string, Element>): StructuralElement[] {
    const textdaten = tocNorm.getElementsByTagName('textdaten')[0];
    if (!textdaten) return [];

    const toc = textdaten.getElementsByTagName('TOC')[0];
    if (!toc) return [];

    const structure: StructuralElement[] = [];
    let currentChapter: StructuralElement | null = null;
    let currentSection: StructuralElement | null = null;

    // Process TOC elements in order
    const tocChildren = Array.from(toc.childNodes).filter(node => 
      node.nodeType === 1 && (node.nodeName === 'Ident' || node.nodeName === 'Title' || node.nodeName === 'table')
    ) as Element[];

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

  private extractParagraphsFromTable(table: Element, paragraphMap: Map<string, Element>): StructuralElement[] {
    const paragraphs: StructuralElement[] = [];
    const rows = table.getElementsByTagName('row');
    
    Array.from(rows).forEach(row => {
      const entries = row.getElementsByTagName('entry');
      if (entries.length >= 2) {
        const numberEntry = entries[0];
        const titleEntry = entries[1];
        
        const number = this.getNodeText(numberEntry).trim();
        const title = this.getNodeText(titleEntry).trim();
        
        if (number && title && (number.startsWith('§') || number.startsWith('Anlage'))) {
          const paragraph: StructuralElement = {
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

  private createFlatStructure(paragraphNorms: Element[]): StructuralElement[] {
    return paragraphNorms.map(norm => {
      const enbez = this.getElementText(norm, 'enbez');
      const metadaten = norm.getElementsByTagName('metadaten')[0];
      const title = metadaten ? this.getElementText(metadaten, 'titel') : '';

      const paragraph: StructuralElement = {
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

  private extractSubParagraphs(norm: Element, paragraphId: string): StructuralElement[] {
    const textdaten = norm.getElementsByTagName('textdaten')[0];
    if (!textdaten) return [];

    const textElement = textdaten.getElementsByTagName('text')[0];
    const contentElements = textElement ? textElement.getElementsByTagName('Content') : 
                           textdaten.getElementsByTagName('Content');

    const subParagraphs: StructuralElement[] = [];
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

        const subParagraph: StructuralElement = {
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

  private processElementContent(element: Element): ContentElement[] {
    const contentElements: ContentElement[] = [];
    
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      const processed = this.processContentNode(node);
      if (processed) {
        contentElements.push(...processed);
      }
    }

    return this.consolidateTextElements(contentElements);
  }

  private processContentNode(node: Node): ContentElement[] | null {
    if (!node) return null;

    switch (node.nodeType) {
      case 1: // Element node
        return this.processContentElement(node as Element);
      case 3: // Text node
        const text = (node.nodeValue || '').trim();
        return text ? [{ type: 'text', text: text }] : null;
      default:
        return null;
    }
  }

  private processContentElement(element: Element): ContentElement[] | null {
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
        return [{ type: 'comment', commentType: commentType as CommentType, text: this.getNodeText(element) }];

      default:
        // For other elements, process children and return as text
        const text = this.getNodeText(element).trim();
        return text ? [{ type: 'text', text: text }] : null;
    }
  }

  private processDefinitionList(dlElement: Element): OrderedListElement {
    const type = dlElement.getAttribute('Type') || 'arabic';
    const listType = this.mapListType(type);
    
    const listItems: ListItemElement[] = [];
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
        const listItem: ListItemElement = {
          type: 'list_item',
          text: itemText.trim()
        };
        listItems.push(listItem);
      }
    }

    const result: OrderedListElement = {
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

  private processImage(imgElement: Element): ImageElement {
    return {
      type: 'image',
      src: imgElement.getAttribute('SRC') || '',
      width: parseInt(imgElement.getAttribute('Width') || '0') || undefined,
      height: parseInt(imgElement.getAttribute('Height') || '0') || undefined,
      alt: imgElement.getAttribute('alt') || '',
      align: (imgElement.getAttribute('Align') as 'left' | 'center' | 'right') || undefined
    };
  }

  private processTable(tableElement: Element): TableElement {
    // Simplified table processing - could be enhanced
    const tgroups = tableElement.getElementsByTagName('tgroup');
    if (tgroups.length === 0) {
      return {
        type: 'table',
        columns: 1,
        rows: []
      };
    }

    const tgroup = tgroups[0];
    const cols = parseInt(tgroup.getAttribute('cols') || '1');
    
    const rows: (string | ContentElement)[][] = [];
    const rowElements = tgroup.getElementsByTagName('row');
    
    for (let i = 0; i < rowElements.length; i++) {
      const rowElement = rowElements[i];
      const entries = rowElement.getElementsByTagName('entry');
      const rowData: string[] = [];
      
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
      frame: (tableElement.getAttribute('frame') as any) || 'none'
    };
  }

  private mapListType(xmlType: string): ListType {
    const typeMap: Record<string, ListType> = {
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

  private consolidateTextElements(elements: ContentElement[]): ContentElement[] {
    if (!elements || elements.length === 0) return [];

    const consolidated: ContentElement[] = [];
    let currentTextParts: string[] = [];

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
      el.type !== 'text' || (el.type === 'text' && el.text && el.text.trim())
    );
  }

  private getElementText(parent: Element, tagName: string): string {
    const element = parent.getElementsByTagName(tagName)[0];
    return element ? this.getNodeText(element) : '';
  }

  private getNodeText(node: Node): string {
    if (!node) return '';
    return (node as any).textContent || (node as any).innerText || '';
  }
}

// CLI usage
async function transformLawFile(inputPath: string, outputPath: string): Promise<void> {
  try {
    const xmlContent = fs.readFileSync(inputPath, 'utf-8');
    const transformer = new HierarchicalLawTransformer();
    const result = transformer.transform(xmlContent);
    
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Hierarchical law document saved to: ${outputPath}`);
    
    // Print summary
    const countElements = (elements: StructuralElement[], type: string): number => {
      let count = 0;
      elements.forEach(el => {
        if (el.type === type) count++;
        if (el.children) {
          count += countElements(el.children as StructuralElement[], type);
        }
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
    console.error('Error transforming law file:', error);
    process.exit(1);
  }
}

// CLI entry point
if (process.argv[1]?.endsWith('law-transformer-hierarchical.ts')) {
  const args = process.argv.slice(2);
  if (args.length >= 2) {
    transformLawFile(args[0], args[1]);
  } else {
    console.log('Usage: tsx law-transformer-hierarchical.ts <input.xml> <output.json>');
    console.log('Example: tsx law-transformer-hierarchical.ts data/BNatSchG/BJNR254210009.xml public/law/BNatSchG-hierarchical.json');
  }
}