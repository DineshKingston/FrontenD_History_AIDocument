// src/components/SearchResults.js
import React from 'react';

const safeString = value => typeof value === 'string' ? value.trim() : String(value || '').trim();

// Highlight search term inside text
const highlightText = (text, term) => {
  if (!term || !text) return text;
  
  // Escape regex special characters
  const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safeTerm})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => 
    regex.test(part) ? <mark key={i}>{part}</mark> : part
  );
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const SearchResults = ({ results = [], searchTerm, isLoading, uploadedFiles }) => {
  // Loading state
  if (isLoading && searchTerm) {
    return (
      <div className="search-results">
        <div className="loading-message">
          <div className="spinner"></div>
          <h3>Searching...</h3>
          <p>Looking for "{searchTerm}" in your documents...</p>
        </div>
      </div>
    );
  }

  // No search term
  if (!searchTerm) {
    return null;
  }

  // No results found
  if (!results || results.length === 0) {
    return (
      <div className="search-results">
        <div className="no-results">
          <div className="no-results-icon">🔍</div>
          <h3>No Results Found</h3>
          <p>
            The word <span className="search-term-highlight">"{searchTerm}"</span> was not found in any uploaded document.
          </p>
        </div>
      </div>
    );
  }

  // Calculate total occurrences and files
  const totalOccurrences = results.reduce((total, result) => {
    return total + (result.totalOccurrences || 0);
  }, 0);
  
  const totalFiles = results.length;

  return (
    <div className="search-results">
      {/* Top Summary Bar */}
      <div style={{
        background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)',
        padding: 'var(--space-4) var(--space-6)',
        borderRadius: 'var(--radius-2xl)',
        marginBottom: 'var(--space-6)',
        textAlign: 'center',
        border: '1px solid #c7d2fe',
        fontWeight: '600',
        color: 'var(--primary-800)',
        fontSize: 'var(--text-lg)'
      }}>
        Found <strong>{totalOccurrences}</strong> occurrences in <strong>{totalFiles}</strong> file{totalFiles !== 1 ? 's' : ''}.
      </div>

      {/* Individual File Results */}
      {results.map((result, fileIndex) => {
        // Get file size from uploadedFiles if available
        const fileInfo = uploadedFiles?.find(f => f.name === result.filename);
        const fileSize = fileInfo?.size || result.fileSize;
        const totalMatches = result.sentences?.length || 0;
        
        return (
          <div key={fileIndex} className="result-file-container" style={{ marginBottom: 'var(--space-8)' }}>
            
            {/* File Header with gradient background */}
            <div style={{
              background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--secondary-600) 100%)',
              color: 'white',
              padding: 'var(--space-6)',
              borderRadius: 'var(--radius-2xl)',
              marginBottom: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              boxShadow: 'var(--shadow-lg)'
            }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--text-xl)'
              }}>
                📄
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  margin: 0,
                  fontSize: 'var(--text-xl)',
                  fontWeight: '900',
                  color: 'white',
                  wordBreak: 'break-word'
                }}>
                  {safeString(result.filename)}
                </h3>
                <div style={{
                  fontSize: 'var(--text-sm)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: '600',
                  marginTop: 'var(--space-2)'
                }}>
                  {fileSize ? formatFileSize(fileSize) : 'Unknown size'} — {totalMatches} match{totalMatches !== 1 ? 'es' : ''}
                </div>
              </div>
            </div>

            {/* Sentence Results */}
            {result.sentences && result.sentences.length > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, var(--gray-50) 0%, white 100%)',
                borderRadius: 'var(--radius-2xl)',
                padding: 'var(--space-6)',
                border: '1px solid var(--gray-200)',
                boxShadow: 'var(--shadow-md)'
              }}>
                
                <div className="sentence-list" style={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--gray-300) var(--gray-100)'
                }}>
                  {result.sentences.map((sentence, sentenceIndex) => (
                    <div key={sentenceIndex} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-4)',
                      marginBottom: 'var(--space-5)',
                      padding: 'var(--space-4)',
                      background: 'white',
                      borderRadius: 'var(--radius-xl)',
                      border: '1px solid var(--gray-200)',
                      borderLeft: '4px solid var(--primary-500)',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all var(--transition-normal)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(4px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}>
                      
                      {/* Number Badge */}
                      <div style={{
                        background: 'var(--primary-gradient)',
                        color: 'white',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'var(--text-sm)',
                        fontWeight: '900',
                        flexShrink: 0,
                        boxShadow: 'var(--shadow-md)'
                      }}>
                        {sentenceIndex + 1}
                      </div>

                      {/* Sentence Content */}
                      <div style={{
                        flex: 1,
                        lineHeight: '1.6',
                        fontSize: 'var(--text-base)',
                        fontWeight: '500',
                        color: 'var(--gray-700)'
                      }}>
                        {highlightText(safeString(sentence.text || sentence), searchTerm)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total count for this file */}
                <div style={{
                  textAlign: 'center',
                  marginTop: 'var(--space-6)',
                  paddingTop: 'var(--space-4)',
                  borderTop: '2px solid var(--gray-200)',
                  fontSize: 'var(--text-base)',
                  fontWeight: '700',
                  color: 'var(--gray-700)'
                }}>
                  Total: <strong style={{ color: 'var(--primary-700)' }}>{result.totalOccurrences || 0}</strong> occurrences of{' '}
                  <span className="search-term-highlight">"{searchTerm}"</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SearchResults;
