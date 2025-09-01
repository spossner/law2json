import { useState, useEffect } from 'react';
import type { LawDocument, SelectableElement } from '../types';
import { StructuralElementRenderer } from './structural/StructuralElementRenderer';
import { ContentRenderer } from './content';
import { cn } from '../lib/utils';

interface Props {
  className?: string;
}

export function LawNavigator({ className }: Props) {
  const [lawData, setLawData] = useState<LawDocument | null>(null);
  const [selectedElement, setSelectedElement] = useState<SelectableElement | null>(null);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deepSearch, setDeepSearch] = useState(false);

  // Handle fine-grained content selection
  const handleContentSelect = (contentId: string) => {
    setSelectedContentId(contentId);
    console.log('Selected content ID:', contentId);
  };

  // Helper function to find element by ID in the new structure
  const findElementById = (elements: SelectableElement[], id: string): SelectableElement | null => {
    for (const element of elements) {
      if ((element as any).id === id) {
        return element;
      }

      // Check children if they exist and are navigable
      if ('children' in element && element.children) {
        const navigableChildren = element.children.filter(
          child => 'id' in child && (child as any).id !== undefined
        ) as SelectableElement[];

        if (navigableChildren.length > 0) {
          const found = findElementById(navigableChildren, id);
          if (found) return found;
        }
      }
    }
    return null;
  };

  // Handle element selection - always use the original unfiltered element
  const handleElementSelect = (filteredElement: SelectableElement) => {
    if (!lawData) return;

    // Get all navigable children from the document
    const allElements = lawData.children.filter(
      child => 'id' in child && (child as any).id !== undefined
    ) as SelectableElement[];

    const originalElement = findElementById(allElements, (filteredElement as any).id!);
    if (originalElement) {
      setSelectedElement(originalElement);
    }
  };

  // Search within content elements recursively
  const searchInContent = (children: any[], searchTerm: string): boolean => {
    return children.some(child => {
      if (
        child.type === 'md' &&
        child.md &&
        child.md.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return true;
      }
      if (child.children) {
        return searchInContent(child.children, searchTerm);
      }
      return false;
    });
  };

  // Load law data
  useEffect(() => {
    const loadLawData = async () => {
      try {
        // const response = await fetch('law/BNatSchG.json');
        const response = await fetch('law/BGB.json');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data: LawDocument = await response.json();
        setLawData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load law data');
        console.error('Error loading law data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLawData();
  }, []);

  // Count elements for stats
  const countElements = (elements: SelectableElement[], type: string): number => {
    let count = 0;
    elements.forEach(el => {
      if (el.type === type) count++;
      if ('children' in el && el.children) {
        const selectableChildren = el.children.filter(
          child => 'type' in child && 'id' in child && child.id !== undefined
        ) as SelectableElement[];
        count += countElements(selectableChildren, type);
      }
    });
    return count;
  };

  // Count all matching elements recursively
  const countMatches = (elements: SelectableElement[], searchTerm: string): number => {
    if (!searchTerm) return 0;

    let count = 0;

    elements.forEach(element => {
      // Check if current element matches in title/label
      const matchesStructure =
        (element as any).title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (element as any).label?.toLowerCase().includes(searchTerm.toLowerCase());

      // Check if content matches (when deep search is enabled)
      let matchesContent = false;
      if (deepSearch && 'children' in element && element.children) {
        const contentChildren = element.children.filter(
          child => child.type === 'md' || child.type === 'list' || child.type === 'table'
        );
        matchesContent = contentChildren.length > 0 && searchInContent(contentChildren, searchTerm);
      }

      if (matchesStructure || matchesContent) {
        count++;
      }

      // Recursively count matches in navigable children
      if ('children' in element && element.children) {
        const navigableChildren = element.children.filter(
          child => 'id' in child && (child as any).id !== undefined
        ) as SelectableElement[];

        if (navigableChildren.length > 0) {
          count += countMatches(navigableChildren, searchTerm);
        }
      }
    });

    return count;
  };

  // Filter structure based on search (recursive)
  const filterStructure = (
    elements: SelectableElement[],
    searchTerm: string
  ): SelectableElement[] => {
    if (!searchTerm) return elements;

    const filtered: SelectableElement[] = [];

    elements.forEach(element => {
      // Check if current element matches in title/label
      const matchesStructure =
        (element as any).title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (element as any).label?.toLowerCase().includes(searchTerm.toLowerCase());

      // Check if content matches (when deep search is enabled)
      let matchesContent = false;
      let contentChildren: any[] = [];

      if (deepSearch && 'children' in element && element.children) {
        contentChildren = element.children.filter(
          child => child.type === 'md' || child.type === 'list' || child.type === 'table'
        );
        matchesContent = contentChildren.length > 0 && searchInContent(contentChildren, searchTerm);
      }

      const matchesSearch = matchesStructure || matchesContent;

      // Get navigable children for recursive search
      let navigableChildren: SelectableElement[] = [];
      let filteredChildren: SelectableElement[] = [];

      if ('children' in element && element.children) {
        navigableChildren = element.children.filter(
          child => 'id' in child && child.id !== undefined
        ) as SelectableElement[];

        // Recursively filter children
        filteredChildren =
          navigableChildren.length > 0 ? filterStructure(navigableChildren, searchTerm) : [];
      }

      // Include element if it matches or has matching children
      if (matchesSearch || filteredChildren.length > 0) {
        // For navigation: keep all children if current element matches, otherwise only filtered children + content
        const allChildren = matchesSearch
          ? (element as any).children
          : [...contentChildren, ...filteredChildren];

        filtered.push({
          ...element,
          children: allChildren,
        } as SelectableElement);
      }
    });

    return filtered;
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center min-h-screen', className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-700">Loading...</h3>
          <p className="text-gray-500">Please wait while the law structure is loaded.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex items-center justify-center min-h-screen', className)}>
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-6 max-w-md">
          <h3 className="font-semibold text-lg mb-2">Error Loading Data</h3>
          <p className="mb-4">{error}</p>
          <p className="text-sm opacity-75">
            Make sure you've run the transformation and the JSON file is available.
          </p>
          <code className="text-xs bg-red-100 px-2 py-1 rounded mt-2 block">
            npm run transform:bnatschg
          </code>
        </div>
      </div>
    );
  }

  if (!lawData) {
    return null;
  }

  // Get all navigable elements from the document
  const allElements = lawData.children.filter(
    child => 'id' in child && child.id !== undefined
  ) as SelectableElement[];

  const stats = {
    outlines: countElements(allElements, 'outline'),
    articles: countElements(allElements, 'article'),
    sections: countElements(allElements, 'section'),
    paragraphs: countElements(allElements, 'p'),
  };

  const filteredStructure = filterStructure(allElements, searchTerm);
  const matchCount = countMatches(allElements, searchTerm);

  return (
    <div className={cn('min-h-screen bg-gray-50', className)}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">German Law Navigator</h1>
          <p className="text-gray-600">Interactive visualization of German legal documents</p>
        </div>
      </div>

      {/* Law Info */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold mb-2">{lawData.title || 'German Legal Document'}</h2>
              <p className="opacity-90">{lawData.jurabk || 'BNatSchG'}</p>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.outlines}</div>
                <div className="text-white/70">Outlines</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.articles}</div>
                <div className="text-white/70">Articles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.sections}</div>
                <div className="text-white/70">Sections</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.paragraphs}</div>
                <div className="text-white/70">Paragraphs</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <div className="w-96 bg-white border-r border-gray-200 min-h-screen">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              {/* Search icon (left side) */}
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <input
                type="text"
                placeholder={
                  deepSearch
                    ? 'Deep search in titles and content...'
                    : 'Search paragraphs and sections...'
                }
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-20 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                  searchTerm ? 'pr-20' : 'pr-16'
                )}
              />

              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                {/* Clear button (when search has content) */}
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    title="Clear search"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}

                {/* Deep search toggle */}
                <button
                  onClick={() => setDeepSearch(!deepSearch)}
                  className={cn(
                    'p-1 rounded transition-colors',
                    deepSearch
                      ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  )}
                  title={
                    deepSearch
                      ? 'Deep search enabled - searches titles and content'
                      : 'Surface search - searches titles only'
                  }
                >
                  {/* Layers/depth icon for deep search toggle */}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={deepSearch ? 2.5 : 2}
                      d="M19 11H5m14-7H5m14 14H5"
                      opacity={deepSearch ? 1 : 0.6}
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
            {searchTerm && (
              <div className="p-4 text-sm text-gray-600 border-b border-gray-200">
                {matchCount} results found
              </div>
            )}

            {filteredStructure.map(element => (
              <StructuralElementRenderer
                key={(element as any).id}
                element={element}
                onSelect={handleElementSelect}
                isSelected={(selectedElement as any)?.id === (element as any).id}
                selectedElementId={(selectedElement as any)?.id}
              />
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6">
          {selectedElement ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {(selectedElement as any).label} {(selectedElement as any).title}
              </h1>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-700 mb-2">Element Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Type:</strong> {selectedElement.type}
                  </div>
                  <div>
                    <strong>ID:</strong> {(selectedElement as any).id}
                  </div>
                  <div>
                    <strong>Children:</strong>{' '}
                    {'children' in selectedElement ? selectedElement.children.length : 0}
                  </div>
                </div>
              </div>

              <div className="prose prose-lg max-w-none">
                <div className="space-y-6">
                  {selectedElement.children.map((child, index) => (
                    <div className="border-l-4 border-blue-200 pl-4" key={
                          child.type === 'md'
                            ? `md-${index}`
                            : (child as any).id || `content-${index}`
                        }>
                      <ContentRenderer
                        element={child}
                        searchTerm={searchTerm}
                        parentPath={(selectedElement as any).id || 'root'}
                        contentIndex={index}
                        simpleId={false}
                        onContentSelect={handleContentSelect}
                        selectedContentId={selectedContentId}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">⚖️</div>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">
                Select a paragraph to view details
              </h2>
              <p className="text-gray-500">
                Use the navigation panel on the left to explore the law structure.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
