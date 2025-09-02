import type { ListNode, ListItemNode, TextRun, ParagraphNode } from '../../types/index.ts';
import type { Parser } from './types.ts';
import type { PONode } from '../converter-utils.ts';
import {
  childrenOf,
  lname,
  isTextNode,
  textOf,
  renderInlineToMd,
  attrsOf,
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
        // Helper function to recursively process content, looking for nested lists
        const processContentRecursively = (element: PONode) => {
          const elementType = lname(element);
          if (!elementType) {
            if (isTextNode(element)) textBuf += textOf(element);
            return;
          }

          if (elementType === 'dl') {
            flushText();
            // Generate nested list ID prefix
            const nestedPrefix =
              idPrefix && pendingMarker
                ? `${idPrefix}.${pendingMarker.match(/\d+/)?.[0] || '1'}`
                : idPrefix;
            // Recursive call for nested lists
            const nestedList = this.parse(element, nestedPrefix);
            if (nestedList) buf.push(nestedList);
          } else if (elementType === 'p') {
            flushText();
            const nestedPrefix =
              idPrefix && pendingMarker
                ? `${idPrefix}.${pendingMarker.match(/\d+/)?.[0] || '1'}`
                : idPrefix;
            const paragraphResult = this.parseNestedParagraph?.(element, nestedPrefix);
            if (paragraphResult) buf.push(paragraphResult);
          } else if (elementType === 'la') {
            // Process LA elements recursively to find nested structures
            for (const child of childrenOf(element)) {
              processContentRecursively(child);
            }
          } else {
            // For other elements, check if they contain nested DL elements first
            let foundNestedStructures = false;
            for (const child of childrenOf(element)) {
              const childType = lname(child);
              if (childType === 'dl' || childType === 'p') {
                flushText();
                processContentRecursively(child);
                foundNestedStructures = true;
              } else if (childType === 'la') {
                // Need to look deeper into LA elements
                for (const laChild of childrenOf(child)) {
                  if (lname(laChild) === 'dl' || lname(laChild) === 'p') {
                    flushText();
                    processContentRecursively(child);
                    foundNestedStructures = true;
                    break;
                  }
                }
              }
            }

            // If no nested structures found, render as inline markdown
            if (!foundNestedStructures) {
              textBuf += renderInlineToMd([element]);
            }
          }
        };

        for (const part of parts) {
          processContentRecursively(part);
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
