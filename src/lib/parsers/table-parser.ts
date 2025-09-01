import type { TableNode } from '../../types/index.ts';
import type { Parser } from './types.ts';
import type { PONode } from '../converter-utils.ts';
import { allChildren, childrenOf, renderInlineToMd } from '../converter-utils.ts';

/**
 * Parser for table elements ('<table>' tags)
 */
export class TableParser implements Parser<TableNode> {
  readonly elementName = 'table';

  parse(tbl: PONode, _idPrefix?: string): TableNode | null {
    const rows: string[][] = [];
    
    for (const row of allChildren(tbl, 'row')) {
      const cells: string[] = [];
      for (const entry of allChildren(row, 'entry')) {
        cells.push(renderInlineToMd(childrenOf(entry)).trim());
      }
      rows.push(cells);
    }
    
    return { type: 'table', rows };
  }
}