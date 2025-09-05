// src/components/SearchBar.js
import React, { useState, useEffect } from 'react';

const SearchBar = ({ searchTerm, onSearch, isLoading }) => {
  const [inputValue, setInputValue] = useState(searchTerm || '');

  useEffect(() => {
    setInputValue(searchTerm || '');
  }, [searchTerm]);

  const handleSearch = () => {
    if (!isLoading && inputValue.trim()) {
      onSearch(inputValue);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  return (
    <div className="search-container">
      <input
        type="text"
        className="search-input"
        placeholder="Enter your search term..."
        value={inputValue}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        disabled={isLoading}
      />
      <button
        className="search-btn"
        onClick={handleSearch}
        disabled={isLoading || !inputValue.trim()}
      >
        {isLoading ? (
          <>
            <div className="spinner" style={{ width: '20px', height: '20px', marginRight: '8px' }}></div>
            Searching...
          </>
        ) : (
          <>
            🔍 Search
          </>
        )}
      </button>
    </div>
  );
};

export default SearchBar;
