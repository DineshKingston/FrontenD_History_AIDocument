import React, { useState, useEffect } from 'react';

const SearchBar = ({ searchTerm, onSearch, isLoading }) => {
  const [inputValue, setInputValue] = useState(searchTerm || '');

  useEffect(() => {
    setInputValue(searchTerm || '');
  }, [searchTerm]);

  const handleSearch = () => {
    if (!isLoading && inputValue.trim()) onSearch(inputValue);
  };
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <><div className='sea'><h1>🔍 Search in Documents
</h1></div><div className="search-container">
      <input
        className="search-input"
        type="text"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        placeholder="Search keyword"
        disabled={isLoading}
        onKeyPress={handleKeyPress}
        aria-label="search" />
      <button
        className="search-btn"
        onClick={handleSearch}
        disabled={isLoading || !inputValue.trim()}
        aria-label="search-button"
      >
        {isLoading ? "Searching..." : "Search"}
      </button>
    </div></>
  );
};

export default SearchBar;
