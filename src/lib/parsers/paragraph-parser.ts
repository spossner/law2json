import type { ParagraphNode, TextRun, ListNode } from '../../types/index.ts';
import type { Parser } from './types.ts';
import type { PONode } from '../converter-utils.ts';
import { 
  childrenOf, 
  lname, 
  isTextNode, 
  textOf, 
  renderInlineToMd 
} from '../converter-utils.ts';

/**
 * Parser for paragraph elements ('<p>' tags)
 */
export class ParagraphParser implements Parser<ParagraphNode> {
  readonly elementName = 'p';

  parse(p: PONode, idPrefix: string = ''): ParagraphNode | null {
    const kids = childrenOf(p);
    const outChildren: Array<TextRun | ListNode> = [];
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
      } else {
        textBuf += renderInlineToMd([k]);
      }
    }
    flushText();

    if (outChildren.length && outChildren[0].type === 'md' && paragraphNumber) {
      const m = outChildren[0].md.match(/^\s*\((\d+)\)\s*/);
      if (m) {
        outChildren[0].md = outChildren[0].md.slice(m[0].length);
        return { 
          type: 'p', 
          label: `(${paragraphNumber})`, 
          id: paragraphId, 
          children: outChildren 
        };
      }
    }
    return { type: 'p', children: outChildren };
  }

  // Temporary solution for nested list parsing - will be resolved with dependency injection
  private parseNestedList?: (node: PONode, idPrefix: string) => ListNode | null;

  setNestedListParser(parser: (node: PONode, idPrefix: string) => ListNode | null): void {
    this.parseNestedList = parser;
  }
}