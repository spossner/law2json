import React, { useState, useEffect } from 'react';
import type { LawDocument, StructuralElement, ContentElement } from '../types';
import { StructuralElementRenderer } from './structural/StructuralElementRenderer';
import { ContentRenderer } from './content';
import { cn } from '../lib/utils';
import { highlightText } from '../lib/highlightText';

interface Props {
  className?: string;
}

export function LawNavigator({ className }: Props) {
  const [lawData, setLawData] = useState<LawDocument | null>(null);
  const [selectedElement, setSelectedElement] = useState<StructuralElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deepSearch, setDeepSearch] = useState(false);

  // Search within content elements recursively
  const searchInContent = (children: any[], searchTerm: string): boolean => {
    return children.some(child => {
      if (child.text && child.text.toLowerCase().includes(searchTerm.toLowerCase())) {
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
        const response = await fetch('law/BNatSchG.json');
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
  const countElements = (elements: StructuralElement[], type: string): number => {
    let count = 0;
    elements.forEach(el => {
      if (el.type === type) count++;
      if (el.children) {
        count += countElements(el.children as StructuralElement[], type);
      }
    });
    return count;
  };

  // Count all matching elements recursively
  const countMatches = (elements: StructuralElement[], searchTerm: string): number => {
    if (!searchTerm) return 0;
    
    let count = 0;
    
    elements.forEach(element => {
      // Check if current element matches in title/number
      const matchesStructure = element.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              element.number?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Check if content matches (when deep search is enabled)
      const contentChildren = element.children.filter(child => 
        !('type' in child) || 
        !['chapter', 'section', 'paragraph', 'subparagraph'].includes((child as StructuralElement).type)
      );
      
      const matchesContent = deepSearch && contentChildren.length > 0 && 
                            searchInContent(contentChildren, searchTerm);
      
      if (matchesStructure || matchesContent) {
        count++;
      }
      
      // Recursively count matches in structural children
      const structuralChildren = element.children.filter(child => 
        'type' in child && 
        ['chapter', 'section', 'paragraph', 'subparagraph'].includes((child as StructuralElement).type)
      ) as StructuralElement[];
      
      if (structuralChildren.length > 0) {
        count += countMatches(structuralChildren, searchTerm);
      }
    });
    
    return count;
  };

  // Filter structure based on search (recursive)
  const filterStructure = (elements: StructuralElement[], searchTerm: string): StructuralElement[] => {
    if (!searchTerm) return elements;
    
    const filtered: StructuralElement[] = [];
    
    elements.forEach(element => {
      // Check if current element matches in title/number
      const matchesStructure = element.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              element.number?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Check if content matches (when deep search is enabled)
      const contentChildren = element.children.filter(child => 
        !('type' in child) || 
        !['chapter', 'section', 'paragraph', 'subparagraph'].includes((child as StructuralElement).type)
      );
      
      const matchesContent = deepSearch && contentChildren.length > 0 && 
                            searchInContent(contentChildren, searchTerm);
      
      const matchesSearch = matchesStructure || matchesContent;
      
      // Get structural children for recursive search
      const structuralChildren = element.children.filter(child => 
        'type' in child && 
        ['chapter', 'section', 'paragraph', 'subparagraph'].includes((child as StructuralElement).type)
      ) as StructuralElement[];
      
      // Recursively filter children
      const filteredChildren = structuralChildren.length > 0 ? 
        filterStructure(structuralChildren, searchTerm) : [];
      
      // Include element if it matches or has matching children
      if (matchesSearch || filteredChildren.length > 0) {
        // Keep all children if current element matches, otherwise only keep filtered structural children + content
        const contentChildren = element.children.filter(child => 
          !('type' in child) || 
          !['chapter', 'section', 'paragraph', 'subparagraph'].includes((child as StructuralElement).type)
        );
        
        filtered.push({
          ...element,
          children: matchesSearch ? element.children : [...contentChildren, ...filteredChildren]
        });
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

  const stats = {
    chapters: countElements(lawData.law.structure, 'chapter'),
    sections: countElements(lawData.law.structure, 'section'),
    paragraphs: countElements(lawData.law.structure, 'paragraph'),
    subparagraphs: countElements(lawData.law.structure, 'subparagraph')
  };

  const filteredStructure = filterStructure(lawData.law.structure, searchTerm);
  const matchCount = countMatches(lawData.law.structure, searchTerm);

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
              <h2 className="text-xl font-bold mb-2">{lawData.law.title}</h2>
              <p className="opacity-90">{lawData.law.abbreviation}</p>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.chapters}</div>
                <div className="text-white/70">Chapters</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.sections}</div>
                <div className="text-white/70">Sections</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.paragraphs}</div>
                <div className="text-white/70">Paragraphs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.subparagraphs}</div>
                <div className="text-white/70">Subparagraphs</div>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              <input
                type="text"
                placeholder={deepSearch ? "Deep search in titles and content..." : "Search paragraphs and sections..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "w-full pl-10 pr-20 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  searchTerm ? "pr-20" : "pr-16"
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                
                {/* Deep search toggle */}
                <button
                  onClick={() => setDeepSearch(!deepSearch)}
                  className={cn(
                    "p-1 rounded transition-colors",
                    deepSearch 
                      ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  )}
                  title={deepSearch ? "Deep search enabled - searches titles and content" : "Surface search - searches titles only"}
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
            
            {filteredStructure.map((element) => (
              <StructuralElementRenderer
                key={element.id}
                element={element}
                onSelect={setSelectedElement}
                isSelected={selectedElement?.id === element.id}
              />
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6">
          {selectedElement ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {selectedElement.number} {selectedElement.title}
              </h1>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-700 mb-2">Element Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Type:</strong> {selectedElement.type}</div>
                  <div><strong>ID:</strong> {selectedElement.id}</div>
                  <div><strong>Children:</strong> {selectedElement.children.length}</div>
                </div>
              </div>

              <div className="prose prose-lg max-w-none">
                <div className="space-y-6">
                  {selectedElement.children.map((child) => {
                    if ('type' in child && ['chapter', 'section', 'paragraph', 'subparagraph'].includes((child as StructuralElement).type)) {
                      const structChild = child as StructuralElement;
                      return (
                        <div key={structChild.id} className="border-l-4 border-blue-200 pl-4">
                          {structChild.title && (
                            <h4 
                              className="font-semibold text-lg text-blue-800 mb-2"
                              dangerouslySetInnerHTML={{
                                __html: searchTerm ? 
                                  `${highlightText(structChild.number, searchTerm)} ${highlightText(structChild.title, searchTerm)}` :
                                  `${structChild.number} ${structChild.title}`
                              }}
                            />
                          )}
                          {structChild.children.length > 0 && (
                            <div className="space-y-3">
                              {structChild.children.map((grandchild, gIndex) => (
                                <div key={gIndex}>
                                  <ContentRenderer element={grandchild as ContentElement} searchTerm={searchTerm} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">⚖️</div>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">Select a paragraph to view details</h2>
              <p className="text-gray-500">Use the navigation panel on the left to explore the law structure.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}