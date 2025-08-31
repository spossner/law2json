import React from 'react';
import type { TextElement } from '../../types';
import { highlightText } from '../../lib/highlightText';

interface Props {
  element: TextElement;
  searchTerm?: string;
}

export function TextRenderer({ element, searchTerm }: Props) {
  const displayText = searchTerm ? highlightText(element.text, searchTerm) : element.text;
  
  return (
    <span 
      className="text-gray-900"
      dangerouslySetInnerHTML={{ __html: displayText }}
    />
  );
}