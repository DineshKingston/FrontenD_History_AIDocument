// src/components/CSVGenerator.js
import React, { useState } from 'react';
import { API_BASE_URL } from '../config';

const CSVGenerator = ({ tableData, onClose }) => {
  const [filters, setFilters] = useState([]);
  const [filename, setFilename] = useState('export.csv');
  const [isGenerating, setIsGenerating] = useState(false);

  const addFilter = () => {
    setFilters([...filters, {
      column: '',
      operator: 'equals',
      value: ''
    }]);
  };

  const updateFilter = (index, field, value) => {
    const newFilters = [...filters];
    newFilters[index][field] = value;
    setFilters(newFilters);
  };

  const removeFilter = (index) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const generateCSV = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/csv/filter-and-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: tableData,
          filters: filters.filter(f => f.column && f.value),
          filename: filename
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        onClose();
      } else {
        throw new Error('Failed to generate CSV');
      }
    } catch (error) {
      console.error('CSV generation error:', error);
      alert('Failed to generate CSV: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const getAvailableColumns = () => {
    if (!tableData || tableData.length === 0) return [];
    return Object.keys(tableData[0]);
  };

  return (
    <div className="csv-generator-modal">
      <div className="csv-generator-content">
        <div className="csv-generator-header">
          <h3>📊 Generate Filtered CSV</h3>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        <div className="csv-generator-body">
          <div className="filename-section">
            <label>📄 Filename:</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="export.csv"
            />
          </div>

          <div className="filters-section">
            <div className="filters-header">
              <h4>🔍 Filters (Optional)</h4>
              <button onClick={addFilter} className="add-filter-btn">
                + Add Filter
              </button>
            </div>

            {filters.map((filter, index) => (
              <div key={index} className="filter-row">
                <select
                  value={filter.column}
                  onChange={(e) => updateFilter(index, 'column', e.target.value)}
                >
                  <option value="">Select Column</option>
                  {getAvailableColumns().map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>

                <select
                  value={filter.operator}
                  onChange={(e) => updateFilter(index, 'operator', e.target.value)}
                >
                  <option value="equals">Equals</option>
                  <option value="contains">Contains</option>
                  <option value="startsWith">Starts With</option>
                  <option value="endsWith">Ends With</option>
                  <option value="greaterThan">Greater Than</option>
                  <option value="lessThan">Less Than</option>
                </select>

                <input
                  type="text"
                  value={filter.value}
                  onChange={(e) => updateFilter(index, 'value', e.target.value)}
                  placeholder="Filter value"
                />

                <button
                  onClick={() => removeFilter(index)}
                  className="remove-filter-btn"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>

          <div className="data-preview">
            <h4>📋 Data Preview ({tableData?.length || 0} rows)</h4>
            {tableData && tableData.length > 0 && (
              <div className="table-preview">
                <strong>Columns:</strong> {getAvailableColumns().join(', ')}
              </div>
            )}
          </div>
        </div>

        <div className="csv-generator-footer">
          <button
            onClick={generateCSV}
            disabled={isGenerating}
            className="generate-btn"
          >
            {isGenerating ? '⏳ Generating...' : '📊 Generate CSV'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CSVGenerator;
