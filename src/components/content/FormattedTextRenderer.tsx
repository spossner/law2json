import React from 'react';
import type { FormattedTextElement } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  element: FormattedTextElement;
  className?: string;
}

export function FormattedTextRenderer({ element, className }: Props) {
  const styleClasses = {
    bold: 'font-bold',
    italic: 'italic', 
    underline: 'underline',
    subscript: 'align-sub text-sm',
    superscript: 'align-super text-sm',
    spacing: 'font-mono'
  } as const;

  return (
    <span className={cn(styleClasses[element.style], className)}>
      {element.text}
    </span>
  );
}