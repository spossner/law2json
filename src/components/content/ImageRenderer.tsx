import React from 'react';
import type { ImageElement } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  element: ImageElement;
  className?: string;
}

export function ImageRenderer({ element, className }: Props) {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  } as const;

  return (
    <div className={cn(
      'my-4',
      element.align && alignClasses[element.align],
      className
    )}>
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