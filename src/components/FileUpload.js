import React, { useRef, useState } from 'react';

const FileUpload = ({ onFilesUpload, uploadedFiles, isLoading, onClear }) => {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesUpload(files, true); // true = append to existing files
    }
  };

  // FIXED: Combine new files with existing files
  const handleFileSelect = (e) => {
    const fileList = e.target.files;
    const files = Array.from(fileList);
    
    if (files.length > 0) {
      onFilesUpload(files, true); // true = append to existing files
    }
    
    // Reset input
    e.target.value = '';
  };

  const openFileDialog = () => {
    if (!isLoading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="file-upload-section">
      <div className="section-header">
        <h2>📁 Upload Documents</h2>
        <p>Upload multiple PDF, DOCX, DOC, or TXT files for searching</p>
      </div>
      
      <div 
        className={`upload-zone ${dragOver ? 'drag-active' : ''} ${isLoading ? 'loading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <div className="upload-content">
          <div className="upload-icon">
            {isLoading ? '⏳' : '📤'}
          </div>
          <h3>{isLoading ? 'Processing files...' : 'Drop files here or click to browse'}</h3>
          <p className="upload-text">
            {isLoading ? 
              `Processing ${uploadedFiles.length} files...` : 
              'Support: PDF, DOCX, DOC, TXT files'
            }
          </p>
          <div className="upload-features">
            <span className="feature">✅ Multiple files</span>
            <span className="feature">✅ Drag & Drop</span>
            <span className="feature">✅ Real text extraction</span>
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={isLoading}
        />
      </div>

      {/* Show upload progress */}
      {isLoading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
          <p>Reading and processing files...</p>
        </div>
      )}

      {/* Display uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="uploaded-files">
          <div className="files-header">
            <h3>📋 Uploaded Files ({uploadedFiles.length})</h3>
            <div className="header-actions">
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="add-more-btn"
                disabled={isLoading}
              >
                + Add More
              </button>
              <button onClick={onClear} className="clear-all-btn" disabled={isLoading}>
                Clear All
              </button>
            </div>
          </div>
          
          <div className="files-grid">
            {uploadedFiles.map((fileData) => (
              <div key={fileData.id} className="file-card">
                <div className="file-icon">
                  {fileData.name.toLowerCase().endsWith('.pdf') ? '📄' : 
                   fileData.name.toLowerCase().endsWith('.docx') ? '📝' : 
                   fileData.name.toLowerCase().endsWith('.doc') ? '📄' : '📋'}
                </div>
                <div className="file-info">
                  <h4 className="file-name">{fileData.name}</h4>
                  <p className="file-details">
                    <span className="file-size">{(fileData.size / 1024).toFixed(1)} KB</span>
                    <span className="file-status">✅ Ready</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
