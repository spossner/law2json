/**
 * TypeScript types for German Legal Document JSON structure
 */

export type ListType = 'arabic' | 'alpha' | 'Alpha' | 'roman' | 'Roman' | 'Dash' | 'Bullet' | 'Symbol' | 'None';
export type FormattingStyle = 'bold' | 'italic' | 'underline' | 'subscript' | 'superscript' | 'spacing';
export type CommentType = 'Stand' | 'Stand-Hinweis' | 'Hinweis' | 'Fundstelle' | 'Verarbeitung';

export interface TextElement {
  type: 'text';
  text: string;
  id?: string;
}

export interface FormattedTextElement {
  type: 'formatted_text';
  style: FormattingStyle;
  text: string;
  id?: string;
}

export interface LineBreakElement {
  type: 'line_break';
  id?: string;
}

export interface PreformattedElement {
  type: 'preformatted';
  text: string;
  id?: string;
}

export interface CommentElement {
  type: 'comment';
  commentType: CommentType;
  text: string;
  id?: string;
}

export interface ListItemElement {
  type: 'list_item';
  text?: string;
  children?: ContentElement[];
  id?: string;
}

export interface OrderedListElement {
  type: 'ordered_list';
  listType: ListType;
  symbol?: string;
  children: ListItemElement[];
  id?: string;
}

export interface ImageElement {
  type: 'image';
  src: string;
  width?: number;
  height?: number;
  alt?: string;
  align?: 'left' | 'center' | 'right';
  id?: string;
}

export interface TableElement {
  type: 'table';
  columns: number;
  headers?: string[];
  rows: (string | ContentElement)[][];
  frame?: 'none' | 'all' | 'top' | 'bottom' | 'topbot' | 'sides';
  id?: string;
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