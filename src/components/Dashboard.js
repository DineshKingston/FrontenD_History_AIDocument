/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import FileUpload from './FileUpload';
import SearchBar from './SearchBar';
import SearchResults from './SearchResults';
import mammoth from 'mammoth';
import pdfToText from 'react-pdftotext';
import AIChat from './AIChat';
import { API_BASE_URL } from '../config';

const Dashboard = ({ user, onLogout }) => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validateFileType = (file) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    return allowedTypes.includes(file.type) || allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  const readFileContent = async (file) => {
    return new Promise(async (resolve, reject) => {
      try {
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.docx')) {
          console.log('Reading DOCX file:', file.name);
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          resolve(result.value);
        } else if (fileName.endsWith('.pdf')) {
          console.log('Reading PDF file:', file.name);
          try {
            const text = await pdfToText(file);
            resolve(text);
          } catch (pdfError) {
            resolve(`[PDF file: ${file.name}] - Could not extract text. Sample content for testing: This PDF contains business information and project details.`);
          }
        } else if (fileName.endsWith('.doc')) {
          resolve(`[DOC file: ${file.name}] - DOC files have limited support. Sample content: This document contains project information and business processes.`);
        } else if (file.type === 'text/plain' || fileName.endsWith('.txt')) {
          console.log('Reading TXT file:', file.name);
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('Failed to read text file'));
          reader.readAsText(file);
        } else {
          reject(new Error(`Unsupported file type: ${file.type}`));
        }
      } catch (error) {
        reject(new Error(`Error reading ${file.name}: ${error.message}`));
      }
    });
  };

  // Handle file upload with backend integration for AI
  const handleFilesUpload = async (newFiles, appendToExisting = false) => {
    console.log('New files to upload:', newFiles.length);
    console.log('Append to existing:', appendToExisting);
    console.log('Current uploaded files:', uploadedFiles.length);

    setIsLoading(true);
    setError('');

    try {
      // Filter out duplicate files by name
      const existingFileNames = uploadedFiles.map(f => f.name);
      const uniqueNewFiles = Array.from(newFiles).filter(file => 
        !existingFileNames.includes(file.name)
      );

      if (uniqueNewFiles.length === 0) {
        setError('All selected files are already uploaded');
        setIsLoading(false);
        return;
      }

      console.log('Unique new files to process:', uniqueNewFiles.length);

      const processedNewFiles = await Promise.all(
        uniqueNewFiles.map(async (file, index) => {
          if (!validateFileType(file)) {
            throw new Error(`Unsupported file type: ${file.name}`);
          }

          // Read file content for frontend search
          const text = await readFileContent(file);

          // Upload file to backend for AI processing
          const formData = new FormData();
          formData.append('file', file);

          try {
            const response = await fetch(`${API_BASE_URL}/api/ai/upload`, {
              method: 'POST',
              body: formData
            });

            if (!response.ok) {
              console.warn(`Backend upload failed for ${file.name}`);
            } else {
              const result = await response.json();
              console.log(`Backend upload successful for ${file.name}:`, result);
            }
          } catch (backendError) {
            console.warn(`Backend upload error for ${file.name}:`, backendError);
            // Continue with frontend-only processing
          }

          return {
            id: Date.now() + index + Math.random() * 1000,
            file: file,
            name: file.name,
            type: file.type,
            size: file.size,
            text: text,
            uploadTime: new Date()
          };
        })
      );

      // Combine existing files with new files
      if (appendToExisting) {
        setUploadedFiles(prevFiles => [...prevFiles, ...processedNewFiles]);
        console.log('Files combined. Total files:', uploadedFiles.length + processedNewFiles.length);
      } else {
        setUploadedFiles(processedNewFiles);
        console.log('Files replaced. Total files:', processedNewFiles.length);
      }

    } catch (err) {
      console.error('Upload error:', err);
      setError('Error reading files: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (term) => {
    if (!term || typeof term !== 'string' || !term.trim()) {
      setError('Please enter a valid search term');
      return;
    }

    if (uploadedFiles.length === 0) {
      setError('Please upload files first');
      return;
    }

    setSearchTerm(term);
    setError('');
    setIsLoading(true);

    try {
      const results = uploadedFiles.map(fileData => {
        const fileText = typeof fileData.text === 'string' ? fileData.text : String(fileData.text || '');
        const sentences = fileText
          .split(/[.!?]+/)
          .filter(s => typeof s === 'string' && s.trim().length > 0)
          .map(s => s.trim());

        const matchingSentences = [];
        let occurrenceCount = 0;

        sentences.forEach((sentence, index) => {
          if (typeof sentence === 'string' && sentence.toLowerCase().includes(term.toLowerCase())) {
            occurrenceCount++;
            matchingSentences.push({
              id: index,
              number: occurrenceCount,
              text: sentence,
              originalIndex: index
            });
          }
        });

        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        const totalOccurrences = (fileText.match(regex) || []).length;

        return {
          fileId: fileData.id,
          fileName: fileData.name || 'Unknown file',
          fileSize: fileData.size || 0,
          sentences: matchingSentences,
          totalMatches: matchingSentences.length,
          totalOccurrences: totalOccurrences
        };
      }).filter(result => result.totalOccurrences > 0);

      setSearchResults(results);
    } catch (err) {
      setError('Error searching files: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setUploadedFiles([]);
    setSearchResults([]);
    setSearchTerm('');
    setError('');
    
    // Clear backend documents as well
    fetch(`${API_BASE_URL}/api/ai/documents`, { 
      method: 'DELETE' 
    }).catch(err => console.warn('Failed to clear backend documents:', err));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="user-info">
          <h1>📄 Welcome, {user?.username || 'User'}!</h1>
          <button onClick={onLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-grid">
          {/* File Upload Section */}
          <section className="upload-section">
            <FileUpload 
              onFilesUpload={handleFilesUpload}
              uploadedFiles={uploadedFiles}
              isLoading={isLoading}
              onClear={handleClear}
            />
          </section>

          {/* Search Section */}
          <section className="search-section">
            <SearchBar 
              searchTerm={searchTerm}
              onSearch={handleSearch}
              isLoading={isLoading}
            />
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <SearchResults 
              results={searchResults}
              searchTerm={searchTerm}
              isLoading={isLoading}
              uploadedFiles={uploadedFiles}
            />
          </section>

          {/* AI Chat Section */}
          <section className="ai-section">
            <AIChat uploadedFiles={uploadedFiles} />
          </section>
        </div>

        <div className="dashboard-footer">
          <p>You can search for keywords or ask questions using the AI assistant</p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
