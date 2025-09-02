import React from 'react';
import { cn } from '../../lib/utils';
import { highlightText } from '../../lib/highlightText';
import type { TextRun } from '../../types';

interface Props {
  textElement: TextRun;
  className?: string;
  searchTerm?: string;
  handleClick?: (e: React.MouseEvent) => void;
}

export function FormattedTextRenderer({ textElement, className, searchTerm, handleClick }: Props) {
  const highlightedText = searchTerm ? highlightText(textElement.md, searchTerm) : textElement.md;
  return (
    <div
      className={cn('prose prose-lg max-w-none leading-relaxed', className)}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: highlightedText }}
    />
  );
}
