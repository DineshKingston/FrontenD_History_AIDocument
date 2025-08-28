import React from 'react';

const safeString = value => typeof value === 'string' ? value.trim() : String(value || '').trim();

// Highlight search term inside text
const highlightText = (text, term) => {
  if (!term || !text) return text;
  // Escape regex
  const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safeTerm})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ?
      <span className="highlight" key={i}>{part}</span> :
      part
  );
};

const SearchResults = ({ results = [], searchTerm, isLoading, uploadedFiles }) => {
  if (isLoading && searchTerm)
    return (
      <div className="search-results loading-message">
        <div className="spinner" />
        <h3>Searching in {uploadedFiles.length} document{uploadedFiles.length !== 1 ? 's' : ''}…</h3>
      </div>
    );
  if (!searchTerm)
    return null;
  if (results.length === 0)
    return (
      <div className="search-results no-results">
        <h3>No results found</h3>
        <p>The word <b>"{searchTerm}"</b> was not found in any uploaded document.</p>
      </div>
    );

  // Calculate totals
  const totalOccurrences = results.reduce((acc, r) => acc + r.totalOccurrences, 0);

  return (
    <div className="search-results">
      <div className="results-summary">
        Found <b>{totalOccurrences}</b> occurrence{totalOccurrences !== 1 ? 's' : ''} in <b>{results.length}</b> file{results.length !== 1 ? 's' : ''}.
      </div>
      <div
        className={
          "results-grid " +
          (results.length === 1 ? "single-document" : "multiple-documents")
        }
      >
        {results.map((result, idx) => (
          <div key={result.fileId || idx} className="result-file">
            <div className="result-file-header">
              <div className="result-file-icon">📄</div>
              <div className="result-file-details">
                <h4>{safeString(result.fileName)}</h4>
                <div className="result-file-meta">
                  {result.fileSize ? `${(result.fileSize / 1024).toFixed(1)} KB` : ''} — {result.sentences.length} matches
                </div>
              </div>
            </div>
            <div className="result-sentences">
              {result.sentences.map((sentence, sidx) => (
                <div key={sentence.id + '' + sidx} className="sentence-item">
                  <div className="sentence-number">{sentence.number || sidx + 1}</div>
                  <div className="sentence-content">
                    {highlightText(sentence.text, searchTerm)}
                  </div>
                </div>
              ))}
            </div>
            <div className="result-file-footer">
              <p>
                Total: <b>{result.totalOccurrences || 0}</b> occurrence{result.totalOccurrences !== 1 ? 's' : ''} of "<b>{searchTerm}</b>"
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchResults;
