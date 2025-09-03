import type { ParagraphNode, TextRun, ListNode, TableNode, ImageNode } from '../../types/index.ts';
import type { Parser } from './types.ts';
import type { PONode } from '../converter-utils.ts';
import { childrenOf, lname, isTextNode, textOf, renderInlineToMd, assignAutomaticIds } from '../converter-utils.ts';

/**
 * Parser for paragraph elements ('<p>' tags)
 */
export class ParagraphParser implements Parser<ParagraphNode> {
  readonly elementName = 'p';

  parse(p: PONode, idPrefix: string = ''): ParagraphNode | null {
    const kids = childrenOf(p);
    const outChildren: Array<TextRun | ListNode | TableNode | ImageNode> = [];
    let textBuf = '';

    const flushText = () => {
      const md = textBuf.trim();
      if (md) outChildren.push({ type: 'md', md });
      textBuf = '';
    };

    // Extract paragraph number or Anlage identifier first to build proper ID context
    let paragraphId = idPrefix;
    let paragraphNumber: string | undefined;
    let paragraphLabel: string | undefined;

    // Check if first text starts with paragraph number or Anlage
    for (const k of kids) {
      if (isTextNode(k)) {
        const text = textOf(k).trim();
        
        // Check for numbered paragraphs like "(1)", "(2)"
        const numMatch = text.match(/^\s*\((\d+)\)\s*/);
        if (numMatch) {
          paragraphNumber = numMatch[1];
          paragraphLabel = `(${paragraphNumber})`;
          paragraphId = idPrefix ? `${idPrefix}.${paragraphNumber}` : paragraphNumber;
          break;
        }
        
        // Check for Anlage paragraphs like "Anlage 1", "Anlage 2"
        const anlageMatch = text.match(/^Anlage\s+(\d+)/);
        if (anlageMatch) {
          const anlageNumber = anlageMatch[1];
          paragraphNumber = `Anl${anlageNumber}`;
          paragraphLabel = `Anlage ${anlageNumber}`;
          paragraphId = idPrefix ? `${idPrefix}.${paragraphNumber}` : paragraphNumber;
          break;
        }
      }
    }

    for (const k of kids) {
      const t = lname(k);
      if (!t) {
        if (isTextNode(k)) textBuf += textOf(k);
      } else if (t === 'dl') {
        flushText();
        // Note: We'll need to get the list parser from registry
        // For now, we'll defer this to the main converter
        // This creates a circular dependency issue that we'll address
        const listResult = this.parseNestedList?.(k, paragraphId);
        if (listResult) outChildren.push(listResult);
      } else if (t === 'table') {
        flushText();
        // Handle table elements within paragraphs
        const tableResult = this.parseNestedTable?.(k, paragraphId);
        if (tableResult) outChildren.push(tableResult);
      } else if (t === 'img') {
        flushText();
        // Handle image elements within paragraphs
        const imageResult = this.parseNestedImage?.(k, paragraphId);
        if (imageResult) outChildren.push(imageResult);
      } else {
        textBuf += renderInlineToMd([k]);
      }
    }
    flushText();

    // For paragraphs with specific identifiers, assign IDs to children
    // For generic paragraphs, let parent handle both paragraph and child IDs
    const finalId = paragraphNumber ? paragraphId : idPrefix || 'p';
    if (paragraphNumber) {
      assignAutomaticIds(outChildren, finalId);
    }

    if (outChildren.length && outChildren[0].type === 'md' && paragraphNumber && paragraphLabel) {
      // Handle numbered paragraphs like "(1)", "(2)"
      const numMatch = outChildren[0].md.match(/^\s*\((\d+)\)\s*/);
      if (numMatch) {
        outChildren[0].md = outChildren[0].md.slice(numMatch[0].length);
        return {
          type: 'p',
          label: paragraphLabel,
          id: paragraphId,
          children: outChildren,
        };
      }
      
      // Handle Anlage paragraphs like "Anlage 1", "Anlage 2"
      const anlageMatch = outChildren[0].md.match(/^Anlage\s+\d+/);
      if (anlageMatch) {
        // Don't remove the Anlage text since it's the main content
        return {
          type: 'p',
          label: paragraphLabel,
          id: paragraphId,
          children: outChildren,
        };
      }
    }
    
    const result: ParagraphNode = { type: 'p', children: outChildren };
    // Only assign ID if we found a specific paragraph identifier (like paragraph number or Anlage label)
    // Don't assign idPrefix as ID to let parent handle automatic indexing
    if (paragraphNumber && finalId !== 'p') result.id = finalId;
    return result;
  }

  // Temporary solution for nested parsing - will be resolved with dependency injection
  private parseNestedList?: (node: PONode, idPrefix: string) => ListNode | null;
  private parseNestedTable?: (node: PONode, idPrefix: string) => TableNode | null;
  private parseNestedImage?: (node: PONode, idPrefix: string) => ImageNode | null;

  setNestedListParser(parser: (node: PONode, idPrefix: string) => ListNode | null): void {
    this.parseNestedList = parser;
  }

  setNestedTableParser(parser: (node: PONode, idPrefix: string) => TableNode | null): void {
    this.parseNestedTable = parser;
  }

  setNestedImageParser(parser: (node: PONode, idPrefix: string) => ImageNode | null): void {
    this.parseNestedImage = parser;
  }
}
