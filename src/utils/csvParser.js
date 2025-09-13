// src/utils/csvParser.js

export const parseCSV = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], data: [] };

  const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(value => value.trim().replace(/"/g, ''));
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }
  }

  return { headers, data };
};

export const jsonToCsv = (jsonData, filename = 'export.csv') => {
  if (!jsonData || jsonData.length === 0) return;

  // Get headers from first object
  const headers = Object.keys(jsonData[0]);
  
  // Create CSV content
  let csvContent = headers.join(',') + '\n';
  
  jsonData.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in values
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvContent += values.join(',') + '\n';
  });

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const filterJsonData = (data, filterConditions) => {
  return data.filter(row => {
    return filterConditions.every(condition => {
      const { column, operator, value } = condition;
      const rowValue = row[column];
      
      switch (operator) {
        case 'equals':
          return rowValue === value;
        case 'contains':
          return rowValue && rowValue.toLowerCase().includes(value.toLowerCase());
        case 'startsWith':
          return rowValue && rowValue.toLowerCase().startsWith(value.toLowerCase());
        case 'endsWith':
          return rowValue && rowValue.toLowerCase().endsWith(value.toLowerCase());
        case 'greaterThan':
          return parseFloat(rowValue) > parseFloat(value);
        case 'lessThan':
          return parseFloat(rowValue) < parseFloat(value);
        default:
          return true;
      }
    });
  });
};
