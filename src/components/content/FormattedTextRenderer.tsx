import React from 'react';
import type { FormattedTextElement } from '../../types';
import { cn } from '../../lib/utils';
import { highlightText } from '../../lib/highlightText';

interface Props {
  element: FormattedTextElement;
  className?: string;
  searchTerm?: string;
}

export function FormattedTextRenderer({ element, className, searchTerm }: Props) {
  const styleClasses = {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    subscript: 'align-sub text-sm',
    superscript: 'align-super text-sm',
    spacing: 'font-mono',
  } as const;

  const displayText = searchTerm ? highlightText(element.text, searchTerm) : element.text;

  return (
    <span
      className={cn(styleClasses[element.style], className)}
      dangerouslySetInnerHTML={{ __html: displayText }}
    />
  );
}
