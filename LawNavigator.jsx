/**
 * React Component for visualizing German law structure
 * Uses the transformed JSON data from law-transformer.js
 */
import React, { useState, useMemo } from 'react';

const LawNavigator = ({ lawData }) => {
  const [selectedElement, setSelectedElement] = useState(null);
  const [expandedChapters, setExpandedChapters] = useState(new Set());
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Create lookup maps for efficient navigation
  const { elementMap, chapters, filteredStructure } = useMemo(() => {
    const elementMap = new Map();
    const chapters = [];
    
    lawData.law.structure.forEach(element => {
      elementMap.set(element.id, element);
      if (element.type === 'chapter') {
        chapters.push(element);
      }
    });

    // Filter structure based on search term
    const filteredStructure = searchTerm 
      ? lawData.law.structure.filter(element => 
          element.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          element.number.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : lawData.law.structure;

    return { elementMap, chapters, filteredStructure };
  }, [lawData, searchTerm]);

  const toggleChapter = (chapterId) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId);
    } else {
      newExpanded.add(chapterId);
    }
    setExpandedChapters(newExpanded);
  };

  const toggleSection = (sectionId) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getChildren = (elementId) => {
    const element = elementMap.get(elementId);
    return element ? element.children.map(childId => elementMap.get(childId)).filter(Boolean) : [];
  };

  const renderBreadcrumb = (element) => {
    if (!element?.breadcrumb) return null;
    
    return (
      <div className="breadcrumb">
        {element.breadcrumb.map((crumb, index) => (
          <span key={crumb.id}>
            {index > 0 && ' > '}
            <button 
              className="breadcrumb-item"
              onClick={() => setSelectedElement(elementMap.get(crumb.id))}
            >
              {crumb.number}
            </button>
          </span>
        ))}
      </div>
    );
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      active: { backgroundColor: '#10b981', color: 'white' },
      repealed: { backgroundColor: '#ef4444', color: 'white' },
      future: { backgroundColor: '#f59e0b', color: 'white' },
      amended: { backgroundColor: '#3b82f6', color: 'white' }
    };

    if (!status || status === 'active') return null;

    return (
      <span 
        className="status-badge"
        style={{
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 'bold',
          marginLeft: '8px',
          ...statusStyles[status]
        }}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  const renderStructureElement = (element, level = 0) => {
    const isExpanded = element.type === 'chapter' 
      ? expandedChapters.has(element.id)
      : expandedSections.has(element.id);
    
    const hasChildren = element.children && element.children.length > 0;
    const children = hasChildren ? getChildren(element.id) : [];

    const handleClick = () => {
      if (element.type === 'chapter') {
        toggleChapter(element.id);
      } else if (element.type === 'section') {
        toggleSection(element.id);
      } else if (element.hasContent) {
        setSelectedElement(element);
      }
    };

    const elementStyle = {
      marginLeft: `${level * 20}px`,
      padding: '8px 12px',
      cursor: 'pointer',
      borderLeft: level > 0 ? '2px solid #e5e7eb' : 'none',
      backgroundColor: selectedElement?.id === element.id ? '#f3f4f6' : 'transparent'
    };

    const titleStyle = {
      fontWeight: element.type === 'chapter' ? 'bold' : element.type === 'section' ? '600' : 'normal',
      fontSize: element.type === 'chapter' ? '16px' : element.type === 'section' ? '14px' : '13px',
      color: element.hasContent ? '#1f2937' : '#6b7280'
    };

    return (
      <div key={element.id}>
        <div 
          style={elementStyle}
          onClick={handleClick}
          className="structure-element"
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {hasChildren && (
              <span style={{ marginRight: '8px', fontSize: '12px' }}>
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            <span style={{ fontFamily: 'monospace', marginRight: '8px', color: '#374151' }}>
              {element.number}
            </span>
            <span style={titleStyle}>
              {element.title}
            </span>
            {getStatusBadge(element.status)}
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {children.map(child => renderStructureElement(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Left Panel - Structure Navigation */}
      <div style={{ width: '400px', borderRight: '1px solid #e5e7eb', overflow: 'auto' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
            {lawData.law.shortTitle}
          </h2>
          <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
            {lawData.law.jurabk} • {lawData.law.lastModified}
          </p>
          
          <input
            type="text"
            placeholder="Search paragraphs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              marginTop: '12px'
            }}
          />
        </div>

        <div>
          {searchTerm ? (
            // Search results
            <div>
              <div style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                {filteredStructure.length} results found
              </div>
              {filteredStructure.map(element => renderStructureElement(element, 0))}
            </div>
          ) : (
            // Normal hierarchical view
            chapters.map(chapter => renderStructureElement(chapter, 0))
          )}
        </div>
      </div>

      {/* Right Panel - Selected Element Details */}
      <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        {selectedElement ? (
          <div>
            {renderBreadcrumb(selectedElement)}
            
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '16px 0' }}>
              {selectedElement.number} {selectedElement.title}
              {getStatusBadge(selectedElement.status)}
            </h1>
            
            <div style={{ 
              backgroundColor: '#f9fafb', 
              padding: '16px', 
              borderRadius: '8px',
              border: '1px solid #e5e7eb' 
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
                Element Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                <div><strong>Type:</strong> {selectedElement.type}</div>
                <div><strong>Level:</strong> {selectedElement.level}</div>
                <div><strong>Has Content:</strong> {selectedElement.hasContent ? 'Yes' : 'No'}</div>
                <div><strong>Status:</strong> {selectedElement.status || 'active'}</div>
                {selectedElement.fullTitle && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Full Title:</strong> {selectedElement.fullTitle}
                  </div>
                )}
              </div>
            </div>

            {selectedElement.hasContent && (
              <div style={{ 
                marginTop: '24px', 
                padding: '16px', 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}>
                <p style={{ fontSize: '14px', color: '#6b7280', fontStyle: 'italic' }}>
                  Legal text content would be displayed here. 
                  This would require parsing the actual &lt;Content&gt; elements from the XML.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '100px' }}>
            <h2>Select a paragraph to view details</h2>
            <p>Use the navigation panel on the left to explore the law structure.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LawNavigator;