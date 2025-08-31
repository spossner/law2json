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
  id?: string;
}

export interface FormattedTextElement {
  type: 'formatted_text';
  style: FormattingStyle;
  text: string;
  id?: string;
}

export interface LineBreakElement {
  type: 'line_break';
  id?: string;
}

export interface PreformattedElement {
  type: 'preformatted';
  text: string;
  id?: string;
}

export interface CommentElement {
  type: 'comment';
  commentType: CommentType;
  text: string;
  id?: string;
}

export interface ListItemElement {
  type: 'list_item';
  text?: string;
  children?: ContentElement[];
  id?: string;
}

export interface OrderedListElement {
  type: 'ordered_list';
  listType: ListType;
  symbol?: string;
  children: ListItemElement[];
  id?: string;
}

export interface ImageElement {
  type: 'image';
  src: string;
  width?: number;
  height?: number;
  alt?: string;
  align?: 'left' | 'center' | 'right';
  id?: string;
}

export interface TableElement {
  type: 'table';
  columns: number;
  headers?: string[];
  rows: (string | ContentElement)[][];
  frame?: 'none' | 'all' | 'top' | 'bottom' | 'topbot' | 'sides';
  id?: string;
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

  // Generate hierarchical ID based on legal structure
  private generateHierarchicalId(
    chapter?: string, 
    section?: string, 
    paragraph?: string, 
    subparagraph?: string,
    contentType?: string,
    contentIndex?: number
  ): string {
    const parts: string[] = [];
    
    if (chapter) {
      // Clean chapter number (e.g. "Kapitel 4" -> "K4")
      const chapterNum = chapter.match(/\d+/)?.[0] || chapter.replace(/\D/g, '');
      if (chapterNum) parts.push(`K${chapterNum}`);
    }
    
    if (section) {
      // Clean section number (e.g. "Abschnitt 1" -> "A1")
      const sectionNum = section.match(/\d+/)?.[0] || section.replace(/\D/g, '');
      if (sectionNum) parts.push(`A${sectionNum}`);
    }
    
    if (paragraph) {
      // Clean paragraph number (e.g. "§  20" -> "P20")
      const paragraphNum = paragraph.replace(/[§\s\u00a0]/g, '');
      if (paragraphNum) parts.push(`P${paragraphNum}`);
    }
    
    if (subparagraph) {
      // Clean subparagraph number (e.g. "(2)" -> "S2")
      const subNum = subparagraph.match(/\d+/)?.[0];
      if (subNum) parts.push(`S${subNum}`);
    }
    
    if (contentType && contentIndex !== undefined) {
      // Map content types to slimmer prefixes
      const contentTypePrefixes: Record<string, string> = {
        'text': 'TXT',
        'formatted_text': 'FMT',
        'line_break': 'BR',
        'preformatted': 'PRE',
        'comment': 'CMT',
        'list_item': 'LI',
        'ordered_list': 'OL',
        'image': 'IMG',
        'table': 'TBL'
      };
      
      const prefix = contentTypePrefixes[contentType] || contentType.toUpperCase();
      parts.push(`${prefix}${contentIndex}`);
    }
    
    return parts.join('_') || `element_${++this.currentId}`;
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
    
    // Context for hierarchical ID generation
    let currentChapterNum = '';
    let currentSectionNum = '';

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
          
          currentChapterNum = text;
          currentChapter = {
            type: 'chapter',
            id: this.generateHierarchicalId(currentChapterNum),
            number: this.normalizeNumber(text),
            title: title,
            children: []
          };
          structure.push(currentChapter);
          currentSection = null;
          
        } else if (className === 'S2') {
          // New section within chapter
          const nextElement = tocChildren[i + 1];
          const title = nextElement && nextElement.tagName === 'Title' ? this.getNodeText(nextElement) : '';
          
          currentSectionNum = text;
          currentSection = {
            type: 'section',
            id: this.generateHierarchicalId(currentChapterNum, currentSectionNum),
            number: this.normalizeNumber(text),
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
        const paragraphs = this.extractParagraphsFromTable(element, paragraphMap, currentChapterNum, currentSectionNum);
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

  private extractParagraphsFromTable(table: Element, paragraphMap: Map<string, Element>, currentChapterNum?: string, currentSectionNum?: string): StructuralElement[] {
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
            id: this.generateHierarchicalId(currentChapterNum, currentSectionNum, number),
            number: this.normalizeNumber(number),
            title: title,
            children: []
          };

          // Add content from paragraph norm if available
          // Normalize paragraph number for lookup (remove extra spaces)
          const normalizedNumber = number.replace(/\s+/g, ' ').trim();
          const norm = paragraphMap.get(normalizedNumber);
          if (norm) {
            const subParagraphs = this.extractSubParagraphs(norm, currentChapterNum, currentSectionNum, number);
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
        id: this.generateHierarchicalId(undefined, undefined, enbez),
        number: this.normalizeNumber(enbez),
        title: title,
        children: []
      };

      const subParagraphs = this.extractSubParagraphs(norm, undefined, undefined, enbez);
      paragraph.children = subParagraphs;

      return paragraph;
    });
  }

  private extractSubParagraphs(norm: Element, chapterNum?: string, sectionNum?: string, paragraphNum?: string): StructuralElement[] {
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
          id: this.generateHierarchicalId(chapterNum, sectionNum, paragraphNum, `(${subParagraphNumber})`),
          number: `(${subParagraphNumber})`,
          children: this.processElementContent(pElement, chapterNum, sectionNum, paragraphNum, `(${subParagraphNumber})`)
        };

        subParagraphs.push(subParagraph);
      }
    }

    return subParagraphs;
  }

  private processElementContent(element: Element, chapterNum?: string, sectionNum?: string, paragraphNum?: string, subparagraphNum?: string): ContentElement[] {
    const contentElements: ContentElement[] = [];
    
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      const processed = this.processContentNode(node, chapterNum, sectionNum, paragraphNum, subparagraphNum);
      if (processed) {
        contentElements.push(...processed);
      }
    }

    const consolidated = this.consolidateTextElements(contentElements);
    
    // Add hierarchical IDs to content elements using sequential indexing starting from 1
    return consolidated.map((element, index) => {
      const contentElement = { ...element } as any;
      
      // Generate ID for the content element based on its position (1-indexed)
      contentElement.id = this.generateHierarchicalId(
        chapterNum, 
        sectionNum, 
        paragraphNum, 
        subparagraphNum, 
        element.type, 
        index + 1
      );
      
      // If this is an ordered list, assign IDs to its list items using the list ID as prefix (1-indexed)
      if (element.type === 'ordered_list') {
        const orderedList = contentElement as OrderedListElement;
        if (orderedList.children) {
          orderedList.children = orderedList.children.map((listItem, listIndex) => ({
            ...listItem,
            id: `${contentElement.id}_LI${listIndex + 1}`
          }));
        }
      }
      
      return contentElement;
    });
  }

  private processContentNode(node: Node, chapterNum?: string, sectionNum?: string, paragraphNum?: string, subparagraphNum?: string): ContentElement[] | null {
    if (!node) return null;

    switch (node.nodeType) {
      case 1: // Element node
        return this.processContentElement(node as Element, chapterNum, sectionNum, paragraphNum, subparagraphNum);
      case 3: // Text node
        const text = (node.nodeValue || '').trim();
        return text ? [{ type: 'text', text: text }] : null;
      default:
        return null;
    }
  }

  private processContentElement(element: Element, chapterNum?: string, sectionNum?: string, paragraphNum?: string, subparagraphNum?: string): ContentElement[] | null {
    const tagName = element.tagName;

    switch (tagName) {
      case 'DL':
        return [this.processDefinitionList(element, chapterNum, sectionNum, paragraphNum, subparagraphNum)];

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

  private processDefinitionList(dlElement: Element, chapterNum?: string, sectionNum?: string, paragraphNum?: string, subparagraphNum?: string): OrderedListElement {
    const type = dlElement.getAttribute('Type') || 'arabic';
    const listType = this.mapListType(type);
    
    // Don't generate ID here - it will be assigned by processElementContent based on position
    
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
        // Don't generate ID for list items here - they will be assigned later
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
      // ID will be assigned by processElementContent based on position
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
    const text = (node as any).textContent || (node as any).innerText || '';
    // Clean NBSP characters (0x00a0) and normalize spacing
    return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private normalizeNumber(text: string): string {
    if (!text) return text;
    // Clean NBSP characters (0x00a0) and normalize spacing for numbers
    return text
      .replace(/\u00a0/g, ' ')  // Replace NBSP with regular space
      .replace(/\s+/g, ' ')     // Normalize multiple spaces to single space
      .trim();
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
if (process.argv[1]?.endsWith('law-transformer.ts')) {
  const args = process.argv.slice(2);
  if (args.length >= 2) {
    transformLawFile(args[0], args[1]);
  } else {
    console.log('Usage: tsx law-transformer-hierarchical.ts <input.xml> <output.json>');
    console.log('Example: tsx law-transformer-hierarchical.ts data/BNatSchG/BJNR254210009.xml public/law/BNatSchG-hierarchical.json');
  }
}