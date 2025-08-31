import React from 'react';
import type { TextElement } from '../../types';

interface Props {
  element: TextElement;
}

export function TextRenderer({ element }: Props) {
  return <span className="text-gray-900">{element.text}</span>;
}