import type { TableNode, TableCell } from '../../types/index.ts';
import type { Parser } from './types.ts';
import type { PONode } from '../converter-utils.ts';
import { allChildren, childrenOf, renderInlineToMd, attrsOf } from '../converter-utils.ts';

/**
 * Parser for table elements ('<table>' tags)
 */
export class TableParser implements Parser<TableNode> {
  readonly elementName = 'table';

  parse(tbl: PONode): TableNode | null {
    let headers: Array<string | TableCell> | undefined;
    const rows: Array<Array<string | TableCell>> = [];

    // Handle DTD structure: <table> → <tgroup> → <thead>/<tbody> → <row> → <entry>
    for (const tgroup of allChildren(tbl, 'tgroup')) {
      // Extract column specifications to build name-to-index mapping
      const colSpecs = allChildren(tgroup, 'colspec');
      const colNameToIndex = new Map<string, number>();
      colSpecs.forEach((colspec, index) => {
        const attrs = attrsOf(colspec);
        const colname = attrs.colname;
        if (colname) {
          colNameToIndex.set(colname, index);
        }
      });

      // Helper function to parse a row and handle colspan
      const parseRow = (row: PONode): Array<string | TableCell> => {
        const cells: Array<string | TableCell> = [];
        for (const entry of allChildren(row, 'entry')) {
          const attrs = attrsOf(entry);
          const content = renderInlineToMd(childrenOf(entry)).trim();

          // Calculate colspan from namest/nameend
          let colspan = 1;
          if (attrs.namest && attrs.nameend) {
            const startIndex = colNameToIndex.get(attrs.namest);
            const endIndex = colNameToIndex.get(attrs.nameend);
            if (startIndex !== undefined && endIndex !== undefined) {
              colspan = endIndex - startIndex + 1;
            }
          }

          // Create cell object if colspan > 1, otherwise use simple string
          if (colspan > 1) {
            cells.push({ content, colspan });
          } else {
            cells.push(content);
          }
        }
        return cells;
      };

      // Process thead section first to extract headers
      const theadSections = allChildren(tgroup, 'thead');
      if (theadSections.length > 0 && !headers) {
        const firstThead = theadSections[0];
        const headerRows = allChildren(firstThead, 'row');
        if (headerRows.length > 0) {
          const headerCells = parseRow(headerRows[0]);
          if (headerCells.length > 0) {
            headers = headerCells;
          }
        }
      }

      // Process tbody sections for data rows
      const tbodySections = allChildren(tgroup, 'tbody');
      for (const tbody of tbodySections) {
        for (const row of allChildren(tbody, 'row')) {
          const cells = parseRow(row);
          rows.push(cells);
        }
      }
    }

    return {
      type: 'table',
      ...(headers ? { headers } : {}),
      rows,
    };
  }
}
