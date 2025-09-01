import type { LawNode } from '../../types/index.ts';
import type { PONode } from '../converter-utils.ts';

/**
 * Common interface for all XML content parsers
 */
export interface Parser<T extends LawNode = LawNode> {
  /** 
   * The XML element name this parser handles (e.g., 'p', 'dl', 'table')
   */
  readonly elementName: string;
  
  /**
   * Parse a PONode into a typed law node
   * @param node - The XML node to parse
   * @param idPrefix - Hierarchical ID context for nested elements
   * @returns The parsed law node or null if parsing failed
   */
  parse(node: PONode, idPrefix?: string): T | null;
}

/**
 * Registry for managing content parsers
 */
export class ParserRegistry {
  private parsers = new Map<string, Parser>();

  /**
   * Register a parser for a specific XML element name
   */
  register<T extends LawNode>(parser: Parser<T>): void {
    this.parsers.set(parser.elementName.toLowerCase(), parser);
  }

  /**
   * Parse a PONode using the appropriate registered parser
   */
  parse(elementName: string, node: PONode, idPrefix?: string): LawNode | null {
    const parser = this.parsers.get(elementName.toLowerCase());
    if (!parser) {
      // Silently ignore unregistered elements - they might be formatting elements
      // that don't need to be converted to content nodes
      return null;
    }
    return parser.parse(node, idPrefix);
  }

  /**
   * Check if a parser is registered for the given element name
   */
  hasParser(elementName: string): boolean {
    return this.parsers.has(elementName.toLowerCase());
  }

  /**
   * Get all registered element names
   */
  getRegisteredElements(): string[] {
    return Array.from(this.parsers.keys());
  }
}