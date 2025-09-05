import type { ImageNode } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  element: ImageNode;
  className?: string;
}

type Align = 'left' | 'center' | 'right';
const ALIGN_CLASSES: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

export function ImageRenderer({ element, className }: Props) {
  return (
    <div
      className={cn(
        'my-4',
        element.meta?.align && ALIGN_CLASSES[element.meta.align as Align],
        className
      )}
    >
      <img
        src={element.meta?.src || ''}
        alt={element.meta?.alt || ''}
        width={element.meta?.width}
        height={element.meta?.height}
        className="max-w-full h-auto border border-gray-200 rounded"
      />
    </div>
  );
}
