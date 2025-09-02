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
    <div className={cn('my-4', element.align && ALIGN_CLASSES[element.align as Align], className)}>
      <img
        src={element.src}
        alt={element.alt || ''}
        width={element.width}
        height={element.height}
        className="max-w-full h-auto border border-gray-200 rounded"
      />
    </div>
  );
}
