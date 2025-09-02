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
  assignAutomaticIds,
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
        // Extract identifier from marker based on list type
        let markerId: string | undefined;
        
        // Handle different marker formats: "1.", "(2)", "a)", etc.
        const numMatch = pendingMarker.match(/\d+/);
        const alphaMatch = pendingMarker.match(/[a-z]/i);
        
        if (numMatch) {
          markerId = numMatch[0];
        } else if (alphaMatch) {
          markerId = alphaMatch[0].toLowerCase();
        }
        
        if (markerId) {
          (li as any).id = `${idPrefix}.${markerId}`;
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
            // Generate nested list ID prefix using the current item's full ID
            let nestedPrefix = idPrefix;
            if (idPrefix && pendingMarker) {
              // Extract identifier from pending marker
              let markerId: string | undefined;
              const numMatch = pendingMarker.match(/\d+/);
              const alphaMatch = pendingMarker.match(/[a-z]/i);
              
              if (numMatch) {
                markerId = numMatch[0];
              } else if (alphaMatch) {
                markerId = alphaMatch[0].toLowerCase();
              }
              
              if (markerId) {
                nestedPrefix = `${idPrefix}.${markerId}`;
              }
            }
            // Recursive call for nested lists
            const nestedList = this.parse(element, nestedPrefix);
            if (nestedList) buf.push(nestedList);
          } else if (elementType === 'p') {
            flushText();
            // Generate nested paragraph ID prefix using the current item's full ID
            let nestedPrefix = idPrefix;
            if (idPrefix && pendingMarker) {
              // Extract identifier from pending marker
              let markerId: string | undefined;
              const numMatch = pendingMarker.match(/\d+/);
              const alphaMatch = pendingMarker.match(/[a-z]/i);
              
              if (numMatch) {
                markerId = numMatch[0];
              } else if (alphaMatch) {
                markerId = alphaMatch[0].toLowerCase();
              }
              
              if (markerId) {
                nestedPrefix = `${idPrefix}.${markerId}`;
              }
            }
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

    // Assign automatic IDs to list items that don't have explicit IDs
    assignAutomaticIds(items, idPrefix || 'list');

    // Also assign automatic IDs to children of each list item
    items.forEach((item) => {
      if (item.id) {
        assignAutomaticIds(item.children, item.id);
      }
    });

    const result: ListNode = {
      type: 'list',
      listType,
      children: items,
    };

    if (idPrefix) result.id = idPrefix;
    return result;
  }

  // Temporary solution for nested paragraph parsing - will be resolved with dependency injection
  private parseNestedParagraph?: (node: PONode, idPrefix: string) => ParagraphNode | null;

  setNestedParagraphParser(parser: (node: PONode, idPrefix: string) => ParagraphNode | null): void {
    this.parseNestedParagraph = parser;
  }
}
