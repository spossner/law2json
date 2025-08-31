/**
 * TypeScript types for German Legal Document JSON structure
 */

export type ListType = 'arabic' | 'alpha' | 'Alpha' | 'roman' | 'Roman' | 'Dash' | 'Bullet' | 'Symbol' | 'None';
export type FormattingStyle = 'bold' | 'italic' | 'underline' | 'subscript' | 'superscript' | 'spacing';
export type CommentType = 'Stand' | 'Stand-Hinweis' | 'Hinweis' | 'Fundstelle' | 'Verarbeitung';

export interface TextElement {
  type: 'text';
  text: string;
}

export interface FormattedTextElement {
  type: 'formatted_text';
  style: FormattingStyle;
  text: string;
}

export interface LineBreakElement {
  type: 'line_break';
}

export interface PreformattedElement {
  type: 'preformatted';
  text: string;
}

export interface CommentElement {
  type: 'comment';
  commentType: CommentType;
  text: string;
}

export interface ListItemElement {
  type: 'list_item';
  text?: string;
  children?: ContentElement[];
}

export interface OrderedListElement {
  type: 'ordered_list';
  listType: ListType;
  symbol?: string;
  children: ListItemElement[];
}

export interface ImageElement {
  type: 'image';
  src: string;
  width?: number;
  height?: number;
  alt?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableElement {
  type: 'table';
  columns: number;
  headers?: string[];
  rows: (string | ContentElement)[][];
  frame?: 'none' | 'all' | 'top' | 'bottom' | 'topbot' | 'sides';
}

export type ContentElement = 
  | TextElement 
  | FormattedTextElement
  | LineBreakElement
  | PreformattedElement
  | CommentElement
  | ListItemElement
  | OrderedListElement
  | ImageElement
  | TableElement;

export interface StructuralElement {
  type: 'chapter' | 'section' | 'paragraph' | 'subparagraph';
  id: string;
  number?: string;
  title?: string;
  children: (StructuralElement | ContentElement)[];
}

export interface LawDocument {
  law: {
    title: string;
    abbreviation: string;
    structure: StructuralElement[];
  };
}