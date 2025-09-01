import type { 
  ListNode, 
  ListItemNode, 
  TextRun, 
  ParagraphNode 
} from '../../types/index.ts';
import type { Parser } from './types.ts';
import type { PONode } from '../converter-utils.ts';
import { 
  childrenOf, 
  lname, 
  isTextNode, 
  textOf, 
  renderInlineToMd,
  attrsOf 
} from '../converter-utils.ts';

/**
 * Parser for definition list elements ('<dl>' tags)
 */
export class ListParser implements Parser<ListNode> {
  readonly elementName = 'dl';

  parse(dl: PONode, idPrefix: string = ''): ListNode | null {
    const kids = childrenOf(dl);
    const items: ListItemNode[] = [];
    let pendingMarker: string | undefined;
    let buf: Array<TextRun | ParagraphNode | ListNode> = [];

    // Get the exact DTD Type value from XML attributes
    const attrs = attrsOf(dl);
    const listType = attrs.Type || attrs.type || 'arabic'; // Default to 'arabic' for legal docs

    const flush = () => {
      if (pendingMarker == null && buf.length === 0) return;
      const li: ListItemNode = { type: 'li', children: buf };

      // Always use the exact DT content as the label
      if (pendingMarker) li.label = pendingMarker;

      // Generate hierarchical ID for list item
      if (idPrefix && pendingMarker) {
        // Extract number from marker (e.g., "1." -> "1", "(2)" -> "2")
        const markerNum = pendingMarker.match(/\d+/)?.[0];
        if (markerNum) {
          (li as any).id = `${idPrefix}.${markerNum}`;
        }
      }

      items.push(li);
      pendingMarker = undefined;
      buf = [];
    };

    for (const node of kids) {
      const t = lname(node);
      if (t === 'dt') {
        flush();
        const markerText = renderInlineToMd(childrenOf(node)).trim();
        pendingMarker = markerText;
      } else if (t === 'dd' || t === 'la') {
        const parts = childrenOf(node);
        let textBuf = '';
        const flushText = () => {
          const md = textBuf.trim();
          if (md) buf.push({ type: 'md', md });
          textBuf = '';
        };
        for (const part of parts) {
          const pt = lname(part);
          if (!pt) {
            if (isTextNode(part)) textBuf += textOf(part);
          } else if (pt === 'dl') {
            flushText();
            // Generate nested list ID prefix
            const nestedPrefix =
              idPrefix && pendingMarker
                ? `${idPrefix}.${pendingMarker.match(/\d+/)?.[0] || '1'}`
                : idPrefix;
            // Recursive call for nested lists
            const nestedList = this.parse(part, nestedPrefix);
            if (nestedList) buf.push(nestedList);
          } else if (pt === 'p') {
            flushText();
            const nestedPrefix =
              idPrefix && pendingMarker
                ? `${idPrefix}.${pendingMarker.match(/\d+/)?.[0] || '1'}`
                : idPrefix;
            // Note: We'll need to get the paragraph parser from registry
            const paragraphResult = this.parseNestedParagraph?.(part, nestedPrefix);
            if (paragraphResult) buf.push(paragraphResult);
          } else {
            textBuf += renderInlineToMd([part]);
          }
        }
        flushText();
      }
    }
    flush();

    return {
      type: 'list',
      listType,
      children: items,
    };
  }

  // Temporary solution for nested paragraph parsing - will be resolved with dependency injection
  private parseNestedParagraph?: (node: PONode, idPrefix: string) => ParagraphNode | null;

  setNestedParagraphParser(parser: (node: PONode, idPrefix: string) => ParagraphNode | null): void {
    this.parseNestedParagraph = parser;
  }
}