// src/utils/fileReader.js
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const readFileContent = async (file) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (file.type === 'application/pdf') {
        // Read PDF files
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
        
        resolve(fullText);
      } 
      else if (file.name.endsWith('.docx')) {
        // Read DOCX files
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        resolve(result.value);
      }
      else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        // Read text files
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read text file'));
        reader.readAsText(file);
      }
      else {
        reject(new Error(`Unsupported file type: ${file.type}`));
      }
    } catch (error) {
      reject(new Error(`Error reading ${file.name}: ${error.message}`));
    }
  });
};

// Additional utility functions
export const validateFileType = (file) => {
  const allowedTypes = ['application/pdf', 'text/plain'];
  const allowedExtensions = ['.pdf', '.docx', '.txt'];
  
  return allowedTypes.includes(file.type) || 
         allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
