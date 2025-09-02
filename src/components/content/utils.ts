import { highlightText } from "../../lib/highlightText";
import type { TableCell } from "../../types";

export const isOrderedListType = (listType: string) =>
  ['arabic', 'alpha', 'Alpha', 'a-alpha', 'a3-alpha', 'roman', 'Roman'].includes(listType);

// Helper function to render a cell (string or TableCell)
      export const renderCell = (cell: string | TableCell, searchTerm?: string) => {
        if (typeof cell === 'string') {
          return searchTerm ? highlightText(cell, searchTerm) : cell;
        }
        return searchTerm ? highlightText(cell.content, searchTerm) : cell.content;
      };

      // Helper function to get colspan value
      export const getColspan = (cell: string | TableCell): number => {
        return typeof cell === 'string' ? 1 : cell.colspan || 1;
      };