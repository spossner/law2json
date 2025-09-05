import { highlightText } from '../../lib/highlightText';
// Table cell type for backward compatibility
export type TableCell = {
  content: string;
  colspan?: number;
};

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

export function alignmentClass(align: 'left' | 'center' | 'right' | undefined) {
  switch (align) {
    case 'left':
      return 'mr-auto';
    case 'center':
      return 'mx-auto';
    case 'right':
      return 'ml-auto';
    default:
      return 'mx-auto'; // default to center
  }
}
