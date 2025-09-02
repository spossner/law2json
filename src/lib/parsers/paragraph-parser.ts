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

    // Extract paragraph number first to build proper ID context
    let paragraphId = idPrefix;
    let paragraphNumber: string | undefined;

    // Check if first text starts with paragraph number
    for (const k of kids) {
      if (isTextNode(k)) {
        const text = textOf(k).trim();
        const m = text.match(/^\s*\((\d+)\)\s*/);
        if (m) {
          paragraphNumber = m[1];
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

    // Assign automatic IDs to children that don't have explicit IDs
    const finalId = paragraphNumber ? paragraphId : idPrefix || 'p';
    assignAutomaticIds(outChildren, finalId);

    if (outChildren.length && outChildren[0].type === 'md' && paragraphNumber) {
      const m = outChildren[0].md.match(/^\s*\((\d+)\)\s*/);
      if (m) {
        outChildren[0].md = outChildren[0].md.slice(m[0].length);
        return {
          type: 'p',
          label: `(${paragraphNumber})`,
          id: paragraphId,
          children: outChildren,
        };
      }
    }
    
    const result: ParagraphNode = { type: 'p', children: outChildren };
    if (finalId !== 'p') result.id = finalId;
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
