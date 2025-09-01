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
    let headers: string[] | undefined;
    const rows: string[][] = [];
    
    // Handle DTD structure: <table> → <tgroup> → <thead>/<tbody> → <row> → <entry>
    for (const tgroup of allChildren(tbl, 'tgroup')) {
      // Process thead section first to extract headers
      const theadSections = allChildren(tgroup, 'thead');
      if (theadSections.length > 0 && !headers) {
        // Extract the first header row from the first thead section
        const firstThead = theadSections[0];
        const headerRows = allChildren(firstThead, 'row');
        if (headerRows.length > 0) {
          const headerCells: string[] = [];
          for (const entry of allChildren(headerRows[0], 'entry')) {
            headerCells.push(renderInlineToMd(childrenOf(entry)).trim());
          }
          if (headerCells.length > 0) {
            headers = headerCells;
          }
        }
      }
      
      // Process tbody sections for data rows
      const tbodySections = allChildren(tgroup, 'tbody');
      for (const tbody of tbodySections) {
        for (const row of allChildren(tbody, 'row')) {
          const cells: string[] = [];
          for (const entry of allChildren(row, 'entry')) {
            cells.push(renderInlineToMd(childrenOf(entry)).trim());
          }
          rows.push(cells);
        }
      }
    }
    
    return { 
      type: 'table', 
      ...(headers ? { headers } : {}),
      rows 
    };
  }
}