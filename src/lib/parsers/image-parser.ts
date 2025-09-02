import type { ImageNode } from '../../types/index.ts';
import type { Parser } from './types.ts';
import type { PONode } from '../converter-utils.ts';
import { attrsOf } from '../converter-utils.ts';

/**
 * Parser for image elements ('<img>' tags)
 */
export class ImageParser implements Parser<ImageNode> {
  readonly elementName = 'img';

  parse(img: PONode): ImageNode | null {
    const attrs = attrsOf(img);

    // Extract basic image information
    const src = attrs.SRC || attrs.src;
    if (!src) return null; // Invalid image without source

    const alt = attrs.alt || '';
    const align = attrs.Align || attrs.align;
    const position = attrs.Pos || attrs.position;

    // Parse dimensions - handle both numeric and string values
    const width = attrs.Width || attrs.width;
    const height = attrs.Height || attrs.height;

    const imageNode: ImageNode = {
      type: 'image',
      src,
      ...(alt ? { alt } : {}),
      ...(width ? { width: parseInt(String(width), 10) } : {}),
      ...(height ? { height: parseInt(String(height), 10) } : {}),
      ...(align ? { align: String(align).toLowerCase() } : {}),
      ...(position ? { position: String(position).toLowerCase() as 'block' | 'inline' } : {}),
    };

    return imageNode;
  }
}
