/* eslint-disable @typescript-eslint/no-explicit-any */

// Base types for XML content with preserveOrder=true (everything is wrapped in arrays)
export interface XmlAttributes {
  [key: string]: string | number | boolean;
}

export interface XmlTextNode {
  '#text': string;
}

export interface XmlAttributeNode {
  ':@': XmlAttributes;
}

// XML Element using union types to avoid TypeScript conflicts
export type XmlContent = string | XmlElement | (string | XmlElement)[];

export type XmlElement =
  | { [tagName: string]: XmlContent | XmlAttributes }
  | { ':@': XmlAttributes }
  | { '#text': string }
  | { ':@': XmlAttributes; '#text': string };

// Generic XML node that can contain text, attributes, and child elements
export type XmlNode<T = Record<string, unknown>> =
  | XmlTextNode
  | XmlAttributeNode
  | (XmlTextNode & XmlAttributeNode)
  | T;

// Array-wrapped versions for preserveOrder=true parsing
export type ArrayWrappedXmlNode<T = Record<string, unknown>> = [XmlNode<T>] | XmlNode<T>[];

// Helper functions to unwrap arrays and safely access first elements
export function unwrapArray<T>(arr: T[] | T): T {
  return Array.isArray(arr) ? arr[0] : arr;
}

export function unwrapArraySafe<T>(arr: T[] | T | undefined): T | undefined {
  if (!arr) return undefined;
  return Array.isArray(arr) ? arr[0] : arr;
}

export function getAllFromArray<T>(arr: T[] | T | undefined): T[] {
  if (!arr) return [];
  return Array.isArray(arr) ? arr : [arr];
}

// Deep unwrapping helper for heavily nested arrays
export function unwrapDeep(node: any): any {
  if (!node) return node;
  if (Array.isArray(node) && node.length === 1) {
    return unwrapDeep(node[0]);
  }
  return node;
}

// Type guard functions for runtime type checking
export function isTextNode(node: unknown): node is XmlTextNode {
  return typeof node === 'object' && node !== null && '#text' in node;
}

export function isAttributeNode(node: unknown): node is XmlAttributeNode {
  return typeof node === 'object' && node !== null && ':@' in node;
}

export function hasTag<T extends string>(
  node: unknown,
  tag: T
): node is Record<T, unknown> {
  return typeof node === 'object' && node !== null && tag in node;
}

// Enhanced hasTag that unwraps arrays first
export function hasTagUnwrapped<T extends string>(
  node: unknown,
  tag: T
): node is Record<T, unknown> {
  const unwrapped = unwrapDeep(node);
  return typeof unwrapped === 'object' && unwrapped !== null && tag in unwrapped;
}

// Helper functions to extract text from array-wrapped nodes
export function extractTextFromWrappedNode(node: ArrayWrappedXmlNode<{ '#text': string }> | undefined): string | undefined {
  if (!node) return undefined;
  const unwrapped = unwrapDeep(node);
  return isTextNode(unwrapped) ? unwrapped['#text'] : undefined;
}

// Specific types for legal document metadata structure (array-wrapped)
export interface Fundstelle {
  periodikum?: ArrayWrappedXmlNode<{ '#text': string }>;
  zitstelle?: ArrayWrappedXmlNode<{ '#text': string }>;
  ':@'?: { typ: string };
}

export interface Standangabe {
  standtyp?: ArrayWrappedXmlNode<{ '#text': string }>;
  standkommentar?: ArrayWrappedXmlNode<{ '#text': string }>;
  ':@'?: { checked: string };
}

export interface Preformatted {
  pre: ArrayWrappedXmlNode<{ '#text': string }> | ArrayWrappedXmlNode<{ BR: [] }>;
  ':@'?: { 'xml:space': string };
}

export interface Gliederungseinheit {
  gliederungskennzahl?: ArrayWrappedXmlNode<{ '#text': string }>;
  gliederungsbez?: ArrayWrappedXmlNode<{ '#text': string }>;
  gliederungstitel?: ArrayWrappedXmlNode<{ '#text': string }>;
}

export interface Metadaten {
  // Basic identification
  jurabk?: ArrayWrappedXmlNode<{ '#text': string }>;
  amtabk?: ArrayWrappedXmlNode<{ '#text': string }>;
  enbez?: ArrayWrappedXmlNode<{ '#text': string }>;
  titel?: ArrayWrappedXmlNode<{ '#text': string; ':@'?: { format: string } }>;

  // Publication information
  'ausfertigung-datum'?: ArrayWrappedXmlNode<{ '#text': string; ':@'?: { manuell: string } }>;
  fundstelle?: ArrayWrappedXmlNode<Fundstelle>;

  // Titles and descriptions
  kurzue?: ArrayWrappedXmlNode<{ '#text': string }>;
  langue?: ArrayWrappedXmlNode<{ '#text': string }>;

  // Status information
  standangabe?: ArrayWrappedXmlNode<Standangabe>;

  // Structural information
  gliederungseinheit?: ArrayWrappedXmlNode<Gliederungseinheit>;
}

// Forward declaration for recursive definition lists (array-wrapped)
export interface DefinitionList {
  DL: ArrayWrappedXmlNode<DefinitionListItem & {
    ':@'?: { Font: string; Type: string };
  }>;
}

export interface DefinitionListItem {
  DT: ArrayWrappedXmlNode<{ '#text': string }>;
  DD: ArrayWrappedXmlNode<{
    LA: ArrayWrappedXmlNode<{ '#text': string; ':@'?: { Size: string } }> |
      ArrayWrappedXmlNode<DefinitionList>;
    ':@'?: { Font: string };
  }>;
}

export interface Paragraph {
  P: ArrayWrappedXmlNode<{ '#text': string }> | ArrayWrappedXmlNode<DefinitionList>;
}

export interface Content {
  Content: ArrayWrappedXmlNode<Paragraph>;
}

export interface Text {
  text: ArrayWrappedXmlNode<Content>;
  ':@'?: { format: string };
}

export interface Textdaten {
  textdaten: ArrayWrappedXmlNode<Text>;
}

export interface Fussnoten {
  fussnoten: ArrayWrappedXmlNode<{
    Content: ArrayWrappedXmlNode<{
      P: ArrayWrappedXmlNode<{ '#text': string }> |
        ArrayWrappedXmlNode<{ BR: [] }> |
        ArrayWrappedXmlNode<Preformatted>;
    }>;
  }>;
}

export interface Norm {
  norm: ArrayWrappedXmlNode<{
    metadaten: ArrayWrappedXmlNode<Metadaten>;
  } | Textdaten | Fussnoten>;
  ':@'?: {
    builddate: string;
    doknr: string;
  };
}

// Root document interface (array-wrapped)
export interface Dokument {
  dokumente: ArrayWrappedXmlNode<Norm>;
  ':@'?: {
    builddate: string;
    doknr: string;
  };
}

// The parsed result is an array containing a single Dokument
export type ParsedXmlRoot = [Dokument];

// Union type for parsed XML
export type ParsedXml = ParsedXmlRoot | Dokument | Norm | XmlElement;

// Helper to safely access dokument from parsed root
export function extractDokument(parsed: ParsedXml): Dokument | undefined {
  if (Array.isArray(parsed)) {
    // Root array case
    return unwrapArraySafe(parsed);
  }
  if (typeof parsed === 'object' && parsed !== null && 'dokumente' in parsed) {
    // Direct Dokument case
    return parsed as Dokument;
  }
  return undefined;
}

// Helper type for objects that might have XML properties
type PossibleMetadataObject = Record<string, unknown> & {
  [K in keyof Metadaten]?: Metadaten[K];
};

// Generic helper to extract text from metadata fields (updated for deeply array-wrapped structure)
export function extractMetadataText<K extends keyof Metadaten>(
  norm: Norm,
  fieldName: K
): string | undefined {
  const normNodes = getAllFromArray(norm.norm);

  // Each norm node is wrapped in an array, so unwrap first
  const metadatenNode = normNodes
    .map(unwrapDeep)
    .find(item => hasTag(item, 'metadaten'));

  if (!metadatenNode || !hasTag(metadatenNode, 'metadaten')) return undefined;

  // metadaten is also array-wrapped
  const metadatenArray = getAllFromArray(metadatenNode.metadaten);
  if (metadatenArray.length === 0) return undefined;

  // Each metadata item is also wrapped
  const metadaten = unwrapDeep(metadatenArray[0]);

  // Type guard to ensure we have the right structure
  if (!metadaten || typeof metadaten !== 'object' || !hasTag(metadaten, fieldName)) {
    return undefined;
  }

  const metadataObj = metadaten as PossibleMetadataObject;
  const fieldArray = getAllFromArray(metadataObj[fieldName] as any);
  if (fieldArray.length === 0) return undefined;

  // Field node is also wrapped
  const fieldNode = unwrapDeep(fieldArray[0]);
  return isTextNode(fieldNode) ? fieldNode['#text'] : undefined;
}

// Convenient aliases using the generic helper
export const extractLegalCode = (norm: Norm) => extractMetadataText(norm, 'jurabk');
export const extractAbbreviation = (norm: Norm) => extractMetadataText(norm, 'amtabk');
export const extractShortTitle = (norm: Norm) => extractMetadataText(norm, 'kurzue');
export const extractFullTitle = (norm: Norm) => extractMetadataText(norm, 'langue');
export const extractPublicationDate = (norm: Norm) => extractMetadataText(norm, 'ausfertigung-datum');
export const extractSectionNumber = (norm: Norm) => extractMetadataText(norm, 'enbez');
export const extractTitle = (norm: Norm) => extractMetadataText(norm, 'titel');

// Complex extractors for nested structures (updated for deeply array-wrapped structure)
export function extractCitation(norm: Norm): { periodikum?: string; zitstelle?: string } | undefined {
  const normNodes = getAllFromArray(norm.norm);

  // Each norm node is wrapped in an array, so unwrap first
  const metadatenNode = normNodes
    .map(unwrapDeep)
    .find(item => hasTag(item, 'metadaten'));

  if (!metadatenNode || !hasTag(metadatenNode, 'metadaten')) return undefined;

  // metadaten is also array-wrapped
  const metadatenArray = getAllFromArray(metadatenNode.metadaten);
  if (metadatenArray.length === 0) return undefined;

  // Each metadata item is also wrapped
  const metadaten = unwrapDeep(metadatenArray[0]);

  // Type guard and safe access
  if (!metadaten || typeof metadaten !== 'object' || !hasTag(metadaten, 'fundstelle')) {
    return undefined;
  }

  const fundstelleArray = getAllFromArray((metadaten as any).fundstelle);
  if (fundstelleArray.length === 0) return undefined;

  // fundstelle node is also wrapped
  const fundstelleNode = unwrapDeep(fundstelleArray[0]);
  if (!fundstelleNode || typeof fundstelleNode !== 'object') return undefined;

  const periodikumArray = getAllFromArray((fundstelleNode as any).periodikum);
  const zitstelleArray = getAllFromArray((fundstelleNode as any).zitstelle);

  // These nodes are also wrapped
  const periodikumNode = unwrapDeep(periodikumArray[0]);
  const zitstelleNode = unwrapDeep(zitstelleArray[0]);

  return {
    periodikum: isTextNode(periodikumNode) ? periodikumNode['#text'] : undefined,
    zitstelle: isTextNode(zitstelleNode) ? zitstelleNode['#text'] : undefined
  };
}

export function extractStatusInfo(norm: Norm): Array<{ type?: string; comment?: string }> {
  const normNodes = getAllFromArray(norm.norm);

  // Each norm node is wrapped in an array, so unwrap first
  const metadatenNode = normNodes
    .map(unwrapDeep)
    .find(item => hasTag(item, 'metadaten'));

  if (!metadatenNode || !hasTag(metadatenNode, 'metadaten')) return [];

  // metadaten is also array-wrapped
  const metadatenArray = getAllFromArray(metadatenNode.metadaten);
  if (metadatenArray.length === 0) return [];

  // Each metadata item is also wrapped
  const metadaten = unwrapDeep(metadatenArray[0]);

  // Type guard and safe access
  if (!metadaten || typeof metadaten !== 'object' || !hasTag(metadaten, 'standangabe')) {
    return [];
  }

  const standangabenArray = getAllFromArray((metadaten as any).standangabe);

  return standangabenArray.map(standangabe => {
    // Each standangabe is also wrapped
    const unwrappedStandangabe = unwrapDeep(standangabe);
    if (!unwrappedStandangabe || typeof unwrappedStandangabe !== 'object') return {};

    const standtypArray = getAllFromArray((unwrappedStandangabe as any).standtyp);
    const standkommentarArray = getAllFromArray((unwrappedStandangabe as any).standkommentar);

    // These nodes are also wrapped
    const standtypNode = unwrapDeep(standtypArray[0]);
    const standkommentarNode = unwrapDeep(standkommentarArray[0]);

    return {
      type: isTextNode(standtypNode) ? standtypNode['#text'] : undefined,
      comment: isTextNode(standkommentarNode) ? standkommentarNode['#text'] : undefined
    };
  });
}

// Helper functions for Dokument structure (updated for deeply array-wrapped structure)
export function isDokument(data: ParsedXml): data is Dokument {
  const unwrapped = unwrapDeep(data);
  return typeof unwrapped === 'object' && unwrapped !== null && 'dokumente' in unwrapped;
}

export function isParsedXmlRoot(data: ParsedXml): data is ParsedXmlRoot {
  return Array.isArray(data) && data.length > 0 && isDokument(data[0]);
}

export function isNorm(data: ParsedXml): data is Norm {
  const unwrapped = unwrapDeep(data);
  return typeof unwrapped === 'object' && unwrapped !== null && 'norm' in unwrapped;
}

export function extractDokumentInfo(doc: Dokument): { builddate?: string; doknr?: string } {
  return {
    builddate: doc[':@']?.builddate,
    doknr: doc[':@']?.doknr
  };
}

export function getAllNorms(doc: Dokument): Norm[] {
  const normArray = getAllFromArray(doc.dokumente);
  // Each norm is also wrapped in an array, so unwrap each one
  return normArray.map(unwrapDeep);
}

export function findNormBySection(doc: Dokument, section: string): Norm | undefined {
  const norms = getAllNorms(doc);
  return norms.find(norm => extractSectionNumber(norm) === section);
}

export function findNormsByLegalCode(doc: Dokument, legalCode: string): Norm[] {
  const norms = getAllNorms(doc);
  return norms.filter(norm => extractLegalCode(norm) === legalCode);
}

// Enhanced extraction helpers that check for specific content types
export function isMetadatenNorm(norm: Norm): boolean {
  const normNodes = getAllFromArray(norm.norm);
  return normNodes.some(node => hasTagUnwrapped(node, 'metadaten'));
}

export function isTextdatenNorm(norm: Norm): boolean {
  const normNodes = getAllFromArray(norm.norm);
  return normNodes.some(node => hasTagUnwrapped(node, 'textdaten'));
}

export function isGliederungseinheitNorm(norm: Norm): boolean {
  const normNodes = getAllFromArray(norm.norm);
  const metadatenNode = normNodes
    .map(unwrapDeep)
    .find(item => hasTagUnwrapped(item, 'metadaten'));

  if (!metadatenNode) return false;

  const metadatenArray = getAllFromArray(metadatenNode.metadaten);
  if (metadatenArray.length === 0) return false;

  const metadaten = unwrapDeep(metadatenArray[0]);
  return hasTag(metadaten, 'gliederungseinheit');
}

// Helper to extract gliederungseinheit info
export function extractGliederungseinheit(norm: Norm): { kennzahl?: string; bezeichnung?: string; titel?: string } | undefined {
  const normNodes = getAllFromArray(norm.norm);
  const metadatenNode = normNodes
    .map(unwrapDeep)
    .find(item => hasTag(item, 'metadaten'));

  if (!metadatenNode || !hasTag(metadatenNode, 'metadaten')) return undefined;

  const metadatenArray = getAllFromArray(metadatenNode.metadaten);
  if (metadatenArray.length === 0) return undefined;

  const metadaten = unwrapDeep(metadatenArray[0]);

  if (!metadaten || typeof metadaten !== 'object' || !hasTag(metadaten, 'gliederungseinheit')) {
    return undefined;
  }

  const gliederungsArray = getAllFromArray((metadaten as any).gliederungseinheit);
  if (gliederungsArray.length === 0) return undefined;

  const gliederung = unwrapDeep(gliederungsArray[0]);
  if (!gliederung || typeof gliederung !== 'object') return undefined;

  const kennzahlArray = getAllFromArray((gliederung as any).gliederungskennzahl);
  const bezeichnungArray = getAllFromArray((gliederung as any).gliederungsbez);
  const titelArray = getAllFromArray((gliederung as any).gliederungstitel);

  const kennzahlNode = unwrapDeep(kennzahlArray[0]);
  const bezeichnungNode = unwrapDeep(bezeichnungArray[0]);
  const titelNode = unwrapDeep(titelArray[0]);

  return {
    kennzahl: isTextNode(kennzahlNode) ? kennzahlNode['#text'] : undefined,
    bezeichnung: isTextNode(bezeichnungNode) ? bezeichnungNode['#text'] : undefined,
    titel: isTextNode(titelNode) ? titelNode['#text'] : undefined
  };
}

// Main parsing helper function
export function parseDocument(xmlString: string, parser: any): Dokument | undefined {
  const parsed: ParsedXml = parser.parse(xmlString);

  if (isParsedXmlRoot(parsed)) {
    // Root array case - extract first element
    return unwrapArraySafe(parsed);
  }

  if (isDokument(parsed)) {
    // Direct document case
    return parsed;
  }

  return undefined;
}

// Alternative: More lenient type for initial parsing using union types
export type FlexibleXmlNode =
  | { [key: string]: string | number | boolean | FlexibleXmlNode | FlexibleXmlNode[] | XmlAttributes }
  | { '#text': string }
  | { ':@': XmlAttributes }
  | { '#text': string; ':@': XmlAttributes };

// Type assertion functions
export function assertNormStructure(data: FlexibleXmlNode): Norm {
  // Add runtime validation here if needed
  return data as Norm;
}

export function createXmlElement(data: Record<string, any>): XmlElement {
  return data as XmlElement;
}

// Helper type to extract text content safely
export type ExtractText<T> = T extends { '#text': infer U }
  ? U extends string ? U : never
  : never;

// Helper type to extract attributes safely
export type ExtractAttributes<T> = T extends { ':@': infer U }
  ? U extends XmlAttributes ? U : never
  : never;