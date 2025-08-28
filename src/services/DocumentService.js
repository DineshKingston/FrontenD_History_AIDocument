// src/services/DocumentService.js

import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker - CRITICAL for PDF processing
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

class DocumentService {
  async readFileContent(file) {
    try {
      const fileName = file.name.toLowerCase();
      
      if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
        return await this.readPDF(file);
      } else if (fileName.endsWith('.docx')) {
        return await this.readDOCX(file);
      } else if (file.type === 'text/plain' || fileName.endsWith('.txt')) {
        return await this.readTextFile(file);
      } else {
        throw new Error(`Unsupported file type: ${file.type || 'unknown'}`);
      }
    } catch (error) {
      console.error(`Error reading ${file.name}:`, error);
      throw new Error(`Error reading ${file.name}: ${error.message}`);
    }
  }

  async readPDF(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map(item => item.str || '')
            .join(' ');
          fullText += pageText + '\n';
        } catch (pageError) {
          console.warn(`Error reading page ${pageNum}:`, pageError);
          fullText += `[Page ${pageNum}: Text extraction failed]\n`;
        }
      }

      if (!fullText.trim()) {
        throw new Error('No text content found in PDF');
      }

      return fullText.trim();
    } catch (error) {
      console.error('PDF reading error:', error);
      throw new Error(`Failed to read PDF: ${error.message}`);
    }
  }

  async readDOCX(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      
      if (!result.value || !result.value.trim()) {
        throw new Error('No text content found in DOCX file');
      }
      
      return result.value.trim();
    } catch (error) {
      console.error('DOCX reading error:', error);
      throw new Error(`Failed to read DOCX: ${error.message}`);
    }
  }

  async readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const text = e.target.result;
        if (!text || !text.trim()) {
          reject(new Error('Text file is empty'));
        } else {
          resolve(text.trim());
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read text file'));
      };
      
      reader.readAsText(file, 'UTF-8');
    });
  }

  // Enhanced search functionality
  searchInText(text, searchTerm) {
    if (!text || !searchTerm) {
      return {
        sentences: [],
        totalMatches: 0,
        totalOccurrences: 0
      };
    }

    const sentences = text
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim());

    const matchingSentences = [];
    let occurrenceCount = 0;

    sentences.forEach((sentence, index) => {
      if (sentence.toLowerCase().includes(searchTerm.toLowerCase())) {
        occurrenceCount++;
        matchingSentences.push({
          id: index,
          number: occurrenceCount,
          text: sentence,
          originalIndex: index
        });
      }
    });

    // Count word occurrences (not just sentence matches)
    const regex = new RegExp(`\\b${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const totalOccurrences = (text.match(regex) || []).length;

    return {
      sentences: matchingSentences,
      totalMatches: matchingSentences.length,
      totalOccurrences: totalOccurrences
    };
  }

  // File validation
  validateFileType(file) {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    const allowedExtensions = ['.pdf', '.docx', '.txt'];
    
    return allowedTypes.includes(file.type) || 
           allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }
}

// Export singleton instance
// eslint-disable-next-line import/no-anonymous-default-export
export default new DocumentService();
