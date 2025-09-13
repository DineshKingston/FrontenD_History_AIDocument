/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from 'react';
import FileUpload from './FileUpload';
import SearchBar from './SearchBar';
import SearchResults from './SearchResults';
import mammoth from 'mammoth';
import pdfToText from 'react-pdftotext';
import AIChat from './AIChat';
import HistorySidebar from './HistorySidebar';
import CSVGenerator from './CSVGenerator';
import { API_BASE_URL } from '../config';

const Dashboard = ({ user, onLogout }) => {
  // ONE SESSION FOR ALL ACTIVITIES
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentSessionData, setCurrentSessionData] = useState(null);
  const [currentDayKey, setCurrentDayKey] = useState(null);
  
  // All activities in the same session
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSessionMessages, setCurrentSessionMessages] = useState([]);
  const [tableData, setTableData] = useState([]); // For CSV/Excel data
  const [showCSVGenerator, setShowCSVGenerator] = useState(false);
  const [currentTableFile, setCurrentTableFile] = useState(null);
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

const initializeUnifiedSession = useCallback(async (forceNew = false) => {
    // ✅ Modified guard - allow forced new sessions
    if (!forceNew && (isInitializing || isInitialized)) {
        console.log('⚠️ Session initialization already in progress or completed');
        return;
    }
    
    setIsInitializing(true);
    setSessionLoading(true);
    setError('');
    
    try {
        // ✅ Skip existing session check if forced new session
        if (!forceNew) {
            console.log('🔍 Checking for existing active session for user:', user.userId);
            
            const todayKey = new Date().toISOString().split('T')[0];
            const existingResponse = await fetch(`${API_BASE_URL}/api/history/day/${user.userId}/${todayKey}`);
            const existingData = await existingResponse.json();
            
            if (existingData.success && existingData.sessions && existingData.sessions.length > 0) {
                const recentSession = existingData.sessions
                    .filter(session => session.sessionType === 'UNIFIED_SESSION')
                    .sort((a, b) => new Date(b.lastAccessedAt) - new Date(a.lastAccessedAt))[0];
                    
                if (recentSession) {
                    console.log('✅ Found existing session, restoring:', recentSession.id);
                    setIsInitialized(true);
                    await handleSelectSession(recentSession);
                    return;
                }
            }
        }
        
        // ✅ Create new session
        console.log('🆕 Creating new unified session');
        const response = await fetch(`${API_BASE_URL}/api/history/session/new`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.userId,
                sessionType: 'UNIFIED_SESSION',
                sessionTitle: `Work Session ${new Date().toLocaleString()}`
            })
        });

        if (response.ok) {
            const data = await response.json();
            setCurrentSessionId(data.sessionId || data.session?.id);
            setCurrentSessionData(data.session);
            setCurrentDayKey(data.session?.dayKey);
            clearAllSessionData();

            const welcomeMessage = {
                id: Date.now(),
                type: 'ai',
                content: forceNew ? 
                    `🆕 **New Session Created!**\n\nFresh start ready!` :
                    `🎯 **Welcome back, ${user?.username || 'User'}!**\n\nYour unified work session has started.`,
                timestamp: new Date()
            };
            setCurrentSessionMessages([welcomeMessage]);
            setIsInitialized(true);
            console.log('✅ New unified session created:', data.sessionId || data.session?.id);
        } else {
            throw new Error('Failed to create unified session');
        }
        
    } catch (error) {
        console.error('Error initializing session:', error);
        setError('Failed to initialize session');
        setIsInitialized(false);
    } finally {
        setIsInitializing(false);
        setSessionLoading(false);
    }
}, [user?.userId, user?.username, isInitializing, isInitialized]);


  // ✅ FIXED: Enhanced handleSelectSession function in Dashboard.js
const handleSelectSession = async (session) => {
  if (session.id === currentSessionId) {
    setShowHistory(false);
    closeMobileDrawer();
    return;
  }

  if (sessionLoading) {
        console.log('⚠️ Session switch already in progress');
        return;
    }

  setSessionLoading(true);
  setError('');

  // ✅ FIX: Declare variables outside try block to avoid scope issues
  let sessionFiles = [];
  let lastSearchQuery = null;

  try {
    console.log('🔄 Switching to unified session:', session.id);
    
    // ✅ STEP 1: Clear AI backend cache to prevent stale responses
    await clearAIBackendCache();
    
    // ✅ STEP 2: Complete state reset BEFORE restoration
    clearAllSessionData();
    
    // ✅ STEP 3: Set session context IMMEDIATELY
    setCurrentSessionId(session.id);
    setCurrentSessionData(session);
    setCurrentDayKey(session.dayKey);

    console.log('✅ Session context set, starting restoration...');

    // ✅ STEP 4: Restore session from backend
    const response = await fetch(`${API_BASE_URL}/api/history/session/${session.id}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      if (response.status === 404) {
        setError('Session no longer exists.');
        setTimeout(() => {
          setError('');
          window.location.reload();
        }, 3000);
        setShowHistory(false);
        return;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    const data = await response.json();
    if (data.success) {
      const restoredSession = data.session;

      // ✅ STEP 5: Restore documents with content validation
      if (restoredSession.documentDetails && restoredSession.documentDetails.length > 0) {
        console.log(`🔄 Restoring ${restoredSession.documentDetails.length} documents...`);
        
        sessionFiles = await Promise.all(restoredSession.documentDetails.map(async (doc, index) => {
          let documentText = '';
          
          if (doc.textContent && doc.textContent.length > 50) {
            documentText = doc.textContent;
            console.log(`✅ Found stored content for ${doc.fileName}: ${documentText.length} chars`);
          } else {
            documentText = `DOCUMENT: ${doc.fileName}\nUPLOADED: ${doc.uploadTime || new Date()}\nSTATUS: Restored from previous session\n\nThis document was restored from a previous session. For full search and AI analysis capabilities, please re-upload the original file.\n\nDocument ID: ${doc.documentId}\nFile Type: ${doc.fileType}\nOriginal Size: ${doc.fileSize || 0} bytes`;
            console.log(`⚠️ Limited content for ${doc.fileName}, using placeholder`);
          }

          return {
            id: doc.documentId || `restored_${session.id}_${index}`,
            file: null,
            name: doc.fileName,
            type: doc.fileType,
            size: doc.fileSize || documentText.length,
            text: documentText,
            uploadTime: new Date(doc.uploadTime || Date.now()),
            sessionId: session.id,
            isFromSession: true,
            hasFullContent: doc.textContent && doc.textContent.length > 50
          };
        }));

        // ✅ CRITICAL: Set uploadedFiles IMMEDIATELY and WAIT for state update
        setUploadedFiles(sessionFiles);
        console.log(`✅ Restored ${sessionFiles.length} documents with content`);
        
        // Re-upload documents to AI backend
        reuploadSessionDocumentsToAI(sessionFiles);
      }

      // ✅ STEP 6: Get last search query BEFORE restoring messages
      if (restoredSession.searchQueries && restoredSession.searchQueries.length > 0) {
        lastSearchQuery = restoredSession.searchQueries[restoredSession.searchQueries.length - 1];
        console.log('🔍 Found last search query:', lastSearchQuery.query);
        setSearchTerm(lastSearchQuery.query);
      }

      // ✅ STEP 7: Restore complete message history
      const completeMessages = await restoreCompleteSessionHistory(session.id);
      if (completeMessages.length > 0) {
        setCurrentSessionMessages([]);
        
        const statusMessage = {
          id: `restoration_status_${Date.now()}`,
          type: 'ai',
          content: `✅ **Session Restored Successfully!**\n\n📁 **Documents**: ${restoredSession.documentDetails?.length || 0} files loaded\n🔍 **Search**: Ready for new searches\n💬 **Chat**: ${completeMessages.length} messages restored\n\n**Your session is fully restored!**`,
          timestamp: new Date(),
          isRestored: false
        };

        const allMessages = [statusMessage, ...completeMessages];
        
        // ✅ FIX: Move deduplicateMessages inside try block
        const deduplicateMessages = (messages) => {
          const seen = new Set();
          return messages.filter(msg => {
            const key = `${msg.content}|${msg.timestamp}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        };

        const uniqueMessages = deduplicateMessages(allMessages);
        console.log(`✅ Setting ${uniqueMessages.length} unique session messages`);
        setCurrentSessionMessages(uniqueMessages);
      }

      console.log('✅ Unified session switched successfully:', session.id);
    } else {
      setError(data.error || 'Failed to restore session data');
    }

    setShowHistory(false);
    closeMobileDrawer();

  } catch (error) {
    console.error('❌ Error in session restoration:', error);
    setError('Error loading session: ' + error.message);
    setShowHistory(false);
    closeMobileDrawer();
  } finally {
    setSessionLoading(false);
    
    // ✅ FIXED: Now variables are in scope
    if (sessionFiles.length > 0 && lastSearchQuery?.query) {
      setTimeout(() => {
        console.log('🔍 Executing restored search with loaded files:', lastSearchQuery.query);
        console.log('📁 Available files for search:', sessionFiles.map(f => f.name));
        setUploadedFiles(sessionFiles);
        setTimeout(() => {
          executeSearchWithFiles(lastSearchQuery.query, sessionFiles);
        }, 500);
      }, 2000);
    }
  }
};

  // Handle dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Handle mobile drawer
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.classList.add('drawer-open');
    } else {
      document.body.classList.remove('drawer-open');
    }
    return () => {
      document.body.classList.remove('drawer-open');
    };
  }, [mobileDrawerOpen]);


// ✅ FIXED: useEffect with proper dependency
useEffect(() => {
  if (user?.userId) {
    initializeUnifiedSession();
  }
}, [user?.userId, initializeUnifiedSession]);

  // Clear all session data
const clearAllSessionData = () => {
    setUploadedFiles([]);
    setSearchResults([]);
    setSearchTerm('');
    setCurrentSessionMessages([]);
    setTableData([]);
    setCurrentTableFile(null);
    setError('');
    
    // ✅ Clear session storage for search deduplication tracking
    Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('search_') || key.startsWith('chat_')) {
            sessionStorage.removeItem(key);
        }
    });
    
    // Clear AI backend
    fetch(`${API_BASE_URL}/api/ai/documents`, { method: 'DELETE' })
        .catch(err => console.warn('Failed to clear AI backend:', err));
        
    console.log('🗑️ All session data cleared completely');
};

  // Sanitize metadata for Java backend
  const sanitizeMetadata = (metadata) => {
    const sanitized = { ...metadata };
    
    // Convert numbers to proper types
    if (typeof sanitized.fileSize === 'number') {
      sanitized.fileSize = Math.floor(sanitized.fileSize);
    }
    if (typeof sanitized.documentId !== 'string') {
      sanitized.documentId = String(sanitized.documentId);
    }
    if (typeof sanitized.userId !== 'string') {
      sanitized.userId = String(sanitized.userId);
    }
    
    // Remove undefined values
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === undefined || sanitized[key] === null) {
        delete sanitized[key];
      }
    });
    
    return sanitized;
  };

  // Validate file types
  const validateFileType = (file) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.csv', '.xlsx', '.xls'];
    return allowedTypes.includes(file.type) || 
           allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

 const readFileContent = async (file) => {
    return new Promise(async (resolve, reject) => {
      try {
        const fileName = file.name.toLowerCase();
        
        // ✅ NEW: Handle CSV files
        if (fileName.endsWith('.csv') || file.type === 'text/csv') {
          const reader = new FileReader();
          reader.onload = (e) => {
            const csvText = e.target.result;
            const parsedData = parseCSVContent(csvText, file.name);
            resolve(parsedData.content);
          };
          reader.onerror = () => reject(new Error('Failed to read CSV file'));
          reader.readAsText(file);
          return;
        }

        // ✅ NEW: Handle Excel files (basic text extraction)
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          // For now, we'll let the backend handle Excel parsing
          // Frontend will show a message that Excel processing is happening on backend
          resolve(`Excel file: ${file.name} - Processing on server for table analysis and AI queries.`);
          return;
        }

        // ✅ EXISTING: Handle other file types
        if (fileName.endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          resolve(result.value);
        } else if (fileName.endsWith('.pdf')) {
          try {
            const text = await pdfToText(file);
            resolve(text);
          } catch (pdfError) {
            resolve(`[PDF file: ${file.name}] - Could not extract text.`);
          }
        } else if (fileName.endsWith('.doc')) {
          resolve(`[DOC file: ${file.name}] - DOC files have limited support.`);
        } else if (file.type === 'text/plain' || fileName.endsWith('.txt')) {
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
// In your CSV processing section
const parseCSVContent = (csvText, filename) => {
    try {
        console.log(`📊 Starting CSV parsing for: ${filename}`);
        
        // ✅ Enhanced line processing with better CSV handling
        const lines = csvText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        if (lines.length === 0) {
            console.warn('⚠️ Empty CSV file detected');
            return { content: csvText, data: [], headers: [], isTable: false };
        }

        console.log(`📄 Processing ${lines.length} lines from CSV`);

        // ✅ Enhanced header parsing with quote handling
        const headerLine = lines[0];
        let headers = [];
        
        // Handle comma-separated values with potential quotes
        if (headerLine.includes('"')) {
            // Complex parsing for quoted headers
            const headerMatch = headerLine.match(/("([^"]*)"|[^,]+)/g);
            headers = headerMatch ? headerMatch.map(h => h.replace(/"/g, '').trim()) : headerLine.split(',').map(h => h.trim());
        } else {
            headers = headerLine.split(',').map(h => h.trim());
        }

        console.log(`📋 Detected headers:`, headers);

        const data = [];
        const parseErrors = [];

        // ✅ Enhanced data parsing with error tracking
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;

            let values = [];
            
            // Handle comma-separated values with potential quotes
            if (line.includes('"')) {
                const valueMatch = line.match(/("([^"]*)"|[^,]+)/g);
                values = valueMatch ? valueMatch.map(v => v.replace(/"/g, '').trim()) : line.split(',').map(v => v.trim());
            } else {
                values = line.split(',').map(v => v.trim());
            }

            // ✅ Validate row structure
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    const value = values[index] || '';
                    
                    // ✅ Enhanced value processing - detect and convert data types
                    let processedValue = value;
                    
                    // Try to convert numeric values
                    if (/^\d+$/.test(value)) {
                        processedValue = parseInt(value);
                    } else if (/^\d+\.\d+$/.test(value)) {
                        processedValue = parseFloat(value);
                    }
                    
                    row[header] = processedValue;
                });
                data.push(row);
            } else {
                parseErrors.push(`Line ${i + 1}: Expected ${headers.length} columns, got ${values.length}`);
                console.warn(`⚠️ Skipping malformed line ${i + 1}: ${line}`);
            }
        }

        console.log(`✅ Successfully parsed ${data.length} data rows`);
        if (parseErrors.length > 0) {
            console.warn(`⚠️ ${parseErrors.length} parsing errors:`, parseErrors.slice(0, 3));
        }

        // ✅ Data validation and analysis
        if (data.length === 0) {
            return { 
                content: `CSV file "${filename}" parsed but contains no valid data rows.`, 
                data: [], 
                headers: headers, 
                isTable: false 
            };
        }

        // ✅ Detect primary identifier columns
        const idColumns = headers.filter(header => 
            /^(id|customer.*id|customerid|index|primary.*key)$/i.test(header.replace(/\s+/g, ''))
        );

        const primaryIdColumn = idColumns[0] || headers[0]; // Use first ID column or first column
        console.log(`🔑 Primary ID column detected: ${primaryIdColumn}`);

        // ✅ Generate comprehensive AI-optimized content
        const aiContent = `=== CSV CUSTOMER DATABASE: ${filename} ===
FILE_TYPE: Comma Separated Values
TOTAL_RECORDS: ${data.length}
HEADERS: ${headers.join(' | ')}
PRIMARY_ID_COLUMN: ${primaryIdColumn}
PARSING_ERRORS: ${parseErrors.length}

COLUMN_ANALYSIS:
${headers.map(header => {
    const values = data.map(row => row[header]).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    const sampleValues = values.slice(0, 3);
    const dataType = typeof values[0];
    const uniqueCount = new Set(values).size;
    
    return `${header}: ${values.length} values, Type: ${dataType}, Unique: ${uniqueCount}, Examples: [${sampleValues.join(', ')}]`;
}).join('\n')}

CUSTOMER_LOOKUP_INDEX:
${data.map((row, index) => {
    const customerId = row[primaryIdColumn] || row.CustomerID || row['Customer Id'] || row.customerId || row.ID || row.Index || (index + 1);
    return `CUSTOMER_${customerId}: ${headers.slice(0, 5).map(h => `${h}="${row[h]}"`).join(', ')}`;
}).join('\n')}

STRUCTURED_DATA_FOR_AI_PROCESSING:
${data.map((row, index) => {
    return `RECORD_${index + 1}: ${headers.map(h => `${h.replace(/\s+/g, '_')}="${row[h] || 'N/A'}"`).join(', ')}`;
}).join('\n')}

NLP_QUERY_EXAMPLES:
- "Customer Id [ID] details" - Get specific customer information
- "age > [NUMBER]" - Filter customers by age greater than value
- "income < [NUMBER]" - Filter customers by income less than value
- "genre = [GENDER]" - Filter customers by gender/genre
- "score >= [NUMBER]" - Filter customers by spending score

SEARCHABLE_CONTENT:
${data.map(row => {
    return Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(' | ');
}).join('\n')}

DATA_STATISTICS:
- Total Customers: ${data.length}
- Available Fields: ${headers.length}
- Data Quality: ${((data.length / (lines.length - 1)) * 100).toFixed(1)}% success rate
- Customer ID Range: ${data[0] ? (data[0][primaryIdColumn] || 1) : 1} to ${data[data.length - 1] ? (data[data.length - 1][primaryIdColumn] || data.length) : data.length}

=== END CSV CUSTOMER DATABASE ===`;

        // ✅ Enhanced return object with comprehensive metadata
        const result = {
            content: aiContent,
            data: data,
            headers: headers,
            isTable: true,
            metadata: {
                filename: filename,
                totalRows: data.length,
                totalColumns: headers.length,
                primaryIdColumn: primaryIdColumn,
                parseErrors: parseErrors.length,
                dataTypes: headers.reduce((types, header) => {
                    const sampleValue = data[0] ? data[0][header] : null;
                    types[header] = typeof sampleValue;
                    return types;
                }, {}),
                sampleData: data.slice(0, 3),
                columnStats: headers.map(header => ({
                    name: header,
                    nonNullCount: data.filter(row => row[header] !== null && row[header] !== undefined && String(row[header]).trim() !== '').length,
                    uniqueCount: new Set(data.map(row => row[header])).size,
                    dataType: typeof (data[0] ? data[0][header] : 'undefined')
                }))
            }
        };

        console.log('✅ CSV parsing completed successfully');
        console.log('📊 Data sample:', result.metadata.sampleData);
        console.log('📋 Column statistics:', result.metadata.columnStats);

        return result;

    } catch (error) {
        console.error('❌ CSV parsing error for', filename, ':', error);
        
        // ✅ Enhanced error handling with partial data recovery
        try {
            // Attempt basic parsing as fallback
            const lines = csvText.split('\n').filter(line => line.trim());
            const headers = lines[0] ? lines[0].split(',').map(h => h.trim().replace(/"/g, '')) : [];
            
            return {
                content: `CSV parsing error for ${filename}: ${error.message}\n\nAttempted basic parsing:\nHeaders detected: ${headers.join(', ')}\nTotal lines: ${lines.length}\n\nPlease check the file format and try re-uploading.`,
                data: [],
                headers: headers,
                isTable: false,
                error: error.message,
                metadata: {
                    filename: filename,
                    hasError: true,
                    errorMessage: error.message,
                    totalLines: lines.length,
                    detectedHeaders: headers
                }
            };
        } catch (fallbackError) {
            console.error('❌ Fallback parsing also failed:', fallbackError);
            
            return {
                content: `Critical CSV parsing error for ${filename}: ${error.message}\n\nFallback parsing failed: ${fallbackError.message}\n\nThe file may be corrupted or in an unsupported format.`,
                data: [],
                headers: [],
                isTable: false,
                error: error.message,
                metadata: {
                    filename: filename,
                    hasError: true,
                    criticalError: true,
                    errorMessage: error.message,
                    fallbackError: fallbackError.message
                }
            };
        }
    }
};

const recordInUnifiedSession = async (activityType, activityData) => {
    // ✅ VALIDATION: Ensure we have session context
    const sessionIdToUse = activityData.sessionId || currentSessionId;
    const userIdToUse = activityData.userId || user?.userId;
    
    if (!userIdToUse || !sessionIdToUse) {
        console.error('❌ Cannot record activity: missing session context', {
            activityType,
            sessionId: sessionIdToUse,
            userId: userIdToUse,
            currentSessionId: currentSessionId
        });
        return;
    }

    try {
        if (activityType === 'DOCUMENT_UPLOAD') {
            const metadata = sanitizeMetadata({
                userId: userIdToUse,
                sessionId: sessionIdToUse,          // ✅ Include session ID
                documentId: activityData.documentId,
                fileName: activityData.fileName,
                fileType: activityData.fileType,
                fileSize: activityData.fileSize,
                textContent: activityData.textContent,
                contentLength: activityData.textContent ? activityData.textContent.length : 0,
                isTableData: activityData.isTableData || false
            });

            console.log(`📤 Recording document upload in session: ${sessionIdToUse}`);
            
            await fetch(`${API_BASE_URL}/api/history/document/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(metadata)
            });
            
            console.log(`✅ Document upload recorded in session: ${sessionIdToUse}`);
        }
        
        else if (activityType === 'SEARCH') {
            const searchData = {
                userId: userIdToUse,
                sessionId: sessionIdToUse,          // ✅ Include session ID
                query: activityData.query,
                queryType: activityData.queryType,
                resultsCount: activityData.resultsCount
            };

            console.log(`📤 Recording search in session: ${sessionIdToUse}`);
            
            await fetch(`${API_BASE_URL}/api/history/search/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(searchData)
            });
            
            console.log(`✅ Search recorded in session: ${sessionIdToUse}`);
        }
        
        else if (activityType === 'AI_CHAT') {
            const chatData = {
                userId: userIdToUse,
                sessionId: sessionIdToUse,          // ✅ CRITICAL: Include session ID
                question: activityData.question,
                aiResponse: activityData.aiResponse,
                metadata: activityData.metadata ? JSON.stringify({
                    ...JSON.parse(activityData.metadata),
                    recordedAt: new Date().toISOString(),
                    targetSessionId: sessionIdToUse   // ✅ Track target session
                }) : JSON.stringify({
                    recordedAt: new Date().toISOString(),
                    targetSessionId: sessionIdToUse
                })
            };

            console.log(`📤 Recording AI chat in session: ${sessionIdToUse}`, {
                question: activityData.question?.substring(0, 50) + '...',
                responseLength: activityData.aiResponse?.length
            });
            
            await fetch(`${API_BASE_URL}/api/history/ai/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatData)
            });
            
            console.log(`✅ AI chat recorded in session: ${sessionIdToUse}`);
        }
        
        // ✅ NEW: Handle other activity types
        else if (activityType === 'SESSION_ACTION') {
            const actionData = {
                userId: userIdToUse,
                sessionId: sessionIdToUse,
                action: activityData.action,
                metadata: JSON.stringify({
                    ...activityData,
                    recordedAt: new Date().toISOString()
                })
            };

            console.log(`📤 Recording session action: ${activityData.action} in session: ${sessionIdToUse}`);
            
            // You can add a new endpoint for session actions if needed
            // await fetch(`${API_BASE_URL}/api/history/session/action`, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(actionData)
            // });
        }
        
        else {
            console.warn(`⚠️ Unknown activity type: ${activityType}`);
        }
        
    } catch (error) {
        console.error(`❌ Error recording ${activityType} in session ${sessionIdToUse}:`, error);
        
        // ✅ Optional: Try to record the error for debugging
        try {
            await fetch(`${API_BASE_URL}/api/history/error/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userIdToUse,
                    sessionId: sessionIdToUse,
                    activityType: activityType,
                    error: error.message,
                    timestamp: new Date().toISOString()
                })
            }).catch(() => {}); // Silent fail for error logging
        } catch (logError) {
            // Silent fail for error logging
        }
    }
};

  const handleFilesUpload = async (newFiles, appendToExisting = false) => {
    if (!currentSessionId) {
      setError('No active session. Please refresh the page.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const existingFileNames = uploadedFiles.map(f => f.name);
      const uniqueNewFiles = Array.from(newFiles).filter(file => 
        !existingFileNames.includes(file.name)
      );

      if (uniqueNewFiles.length === 0) {
        setError('All selected files are already uploaded');
        setIsLoading(false);
        return;
      }
      console.log('🔍 Uploading files to AI backend:', {
        fileCount: uniqueNewFiles.length,
        sessionId: currentSessionId,
        endpoint: `${API_BASE_URL}/api/ai/upload/multiple`
    });

      // ✅ NEW: Upload to AI backend first
      const formData = new FormData();
      uniqueNewFiles.forEach(file => {
        formData.append('files', file);
      });

      const aiUploadResponse = await fetch(`${API_BASE_URL}/api/ai/upload/multiple`, {
        method: 'POST',
        body: formData
      });

      if (!aiUploadResponse.ok) {
        throw new Error(`AI backend upload failed: ${aiUploadResponse.status}`);
      }

      const processedNewFiles = await Promise.all(
        uniqueNewFiles.map(async (file, index) => {
          if (!validateFileType(file)) {
            throw new Error(`Unsupported file type: ${file.name}`);
          }

          const contentResult = await readFileContent(file);
          let text, tableData = null, isTable = false;

          // ✅ NEW: Handle structured content from CSV parsing
          if (typeof contentResult === 'object' && contentResult.content) {
            text = contentResult.content;
            tableData = contentResult.data;
            isTable = contentResult.isTable;
            if (isTable && file.name.toLowerCase().endsWith('.csv')) {
                    console.log(`📊 CSV processed: ${tableData?.length || 0} rows, ${text.length} chars`);
                    
                    // Validate that we have actual data
                    if (!text.includes('COMPLETE TABLE DATA:') || !tableData || tableData.length === 0) {
                        console.error('❌ CSV processing failed - no table data found');
                        throw new Error(`CSV processing failed for ${file.name}`);
                    }
                }
          } else {
            text = contentResult;
          }

          console.log(`📄 Extracted ${text.length} characters from ${file.name}`);

          const fileData = {
            id: `${currentSessionId}_doc_${Date.now()}_${index}`,
            file: file,
            name: file.name,
            type: file.type,
            size: file.size,
            text: text,
            tableData: tableData, // ✅ NEW: Store table data
            isTable: isTable, // ✅ NEW: Mark as table
            uploadTime: new Date(),
            sessionId: currentSessionId,
            isFromSession: false,
            hasFullContent: true
          };

          // ✅ NEW: If this is table data, set it as current table
          if (isTable && tableData && tableData.length > 0) {
            setTableData(tableData);
            setCurrentTableFile(fileData);
            console.log(`📊 Table data loaded: ${tableData.length} rows from ${file.name}`);
          }

          // Record in session
          await recordInUnifiedSession('DOCUMENT_UPLOAD', {
            documentId: fileData.id,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            textContent: text,
            contentLength: text.length,
            isTableData: isTable
          });

          return fileData;
        })
      );

      if (appendToExisting) {
        setUploadedFiles(prevFiles => [...prevFiles, ...processedNewFiles]);
      } else {
        setUploadedFiles(processedNewFiles);
      }

      // ✅ NEW: Show message about table capabilities
      const hasTableFiles = processedNewFiles.some(f => f.isTable);
      if (hasTableFiles) {
        const tableMessage = {
          id: Date.now(),
          type: 'ai',
          content: `📊 **Table Data Uploaded Successfully!**\n\nYour CSV/Excel files are now available for:\n• 🔍 **Smart Search** - Find specific rows and data\n• 💬 **AI Analysis** - Ask questions about your data\n• 📊 **CSV Generation** - Filter and export data\n\n**Try asking:** "Show me all records where name contains 'John'" or "Generate CSV with age > 25"`,
          timestamp: new Date()
        };
        setCurrentSessionMessages(prev => [...prev, tableMessage]);
      }

      console.log(`✅ Uploaded ${processedNewFiles.length} files to unified session:`, currentSessionId);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Error uploading files: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ ENHANCED: Search with table data support
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
      const results = uploadedFiles
        .filter(file => file.sessionId === currentSessionId)
        .map(fileData => {
          let fileText = fileData.text || '';

          // ✅ NEW: Enhanced search for table data
          if (fileData.isTable && fileData.tableData) {
            return searchTableData(fileData, term);
          }

          // ✅ EXISTING: Regular file search
          if (fileText.length < 100 && !fileData.hasFullContent) {
            return {
              fileId: fileData.id,
              fileName: fileData.name || 'Unknown file',
              fileSize: fileData.size || 0,
              sentences: [{
                id: 0,
                number: 1,
                text: `Document "${fileData.name}" was restored from a previous session. For full search capability, please re-upload the original file.`,
                originalIndex: 0
              }],
              totalMatches: 1,
              totalOccurrences: 1,
              isLimitedContent: true
            };
          }

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
            totalOccurrences: totalOccurrences,
            hasFullContent: fileData.hasFullContent,
            isTable: fileData.isTable || false
          };
        })
        .filter(result => result.totalOccurrences > 0);

      setSearchResults(results);

      const totalResults = results.reduce((sum, result) => sum + result.totalOccurrences, 0);
      
      if (currentSessionId && user?.userId) {
        recordSearchInUnifiedSession(term, totalResults);
      }

      console.log(`🔍 Search completed: ${totalResults} results`);
    } catch (err) {
      setError('Error searching files: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ NEW: Search table data function
  const searchTableData = (fileData, term) => {
    const { tableData, name, size, id } = fileData;
    const matchingRows = [];
    let totalOccurrences = 0;

    tableData.forEach((row, rowIndex) => {
      let rowMatches = false;
      let rowText = '';
      
      Object.entries(row).forEach(([key, value]) => {
        const valueStr = String(value).toLowerCase();
        const termLower = term.toLowerCase();
        
        if (valueStr.includes(termLower)) {
          rowMatches = true;
          totalOccurrences++;
        }
        rowText += `${key}: ${value}; `;
      });

      if (rowMatches) {
        matchingRows.push({
          id: rowIndex,
          number: matchingRows.length + 1,
          text: `Row ${rowIndex + 1}: ${rowText}`,
          originalIndex: rowIndex,
          isTableRow: true,
          rowData: row
        });
      }
    });

    return {
      fileId: id,
      fileName: name || 'Unknown table',
      fileSize: size || 0,
      sentences: matchingRows,
      totalMatches: matchingRows.length,
      totalOccurrences: totalOccurrences,
      hasFullContent: true,
      isTable: true,
      tableRowCount: tableData.length
    };
  };

const recordSearchInUnifiedSession = async (searchTerm, resultsCount) => {
    if (!user?.userId || !currentSessionId) {
        console.warn('⚠️ Cannot record search: missing user or session');
        return;
    }

    try {
        // ✅ Check if this search was already recorded recently (prevent duplicates)
        const recentSearchKey = `search_${currentSessionId}_${searchTerm}`;
        const lastRecordedTime = sessionStorage.getItem(recentSearchKey);
        const now = Date.now();
        
        if (lastRecordedTime && (now - parseInt(lastRecordedTime)) < 5000) {
            console.log('🚫 Skipping duplicate search recording');
            return;
        }

        // Record in backend
        await recordInUnifiedSession('SEARCH', {
            query: searchTerm,
            queryType: 'KEYWORD',
            resultsCount: resultsCount
        });

        // ✅ Only add search message if not already in current session messages
        const searchMessageExists = currentSessionMessages.some(msg => 
            msg.type === 'ai' && 
            msg.content.includes(`Search Performed`) && 
            msg.content.includes(`"${searchTerm}"`)
        );

        if (!searchMessageExists) {
            const searchMessage = {
                id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'ai',
                content: `🔍 **Search Performed**: "${searchTerm}"\n\nFound ${resultsCount} results in unified session.`,
                timestamp: new Date()
            };
            setCurrentSessionMessages(prev => [...prev, searchMessage]);
        }

        // ✅ Mark this search as recorded
        sessionStorage.setItem(recentSearchKey, now.toString());
        
        console.log(`✅ Search recorded: "${searchTerm}" with ${resultsCount} results`);
    } catch (error) {
        console.error('❌ Error recording search:', error);
    }
};

  // Record chat message in unified session  
  const recordChatMessage = async (messageType, content, metadata = null) => {
    if (!user?.userId || !currentSessionId) {
        console.warn('⚠️ Cannot record chat message: missing user or session', {
            userId: user?.userId,
            sessionId: currentSessionId
        });
        return;
    }

        console.log(`📝 Recording ${messageType} message in session: ${currentSessionId}`);

    // Only record AI responses in backend
    if (messageType === 'AI' && metadata) {
      let parsedMetadata;
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch {
        parsedMetadata = {};
      }
      
      const question = parsedMetadata.question || 'AI Query';
      
      await recordInUnifiedSession('AI_CHAT', {
            sessionId: currentSessionId,
            userId: user.userId,
            question: question,
            aiResponse: content,
            metadata: JSON.stringify({
                ...parsedMetadata,
                recordedAt: new Date().toISOString(),
                sessionId: currentSessionId   
            })
        });
        console.log(`✅ AI message recorded in session: ${currentSessionId}`);
    }
        else if (messageType === 'USER') {
        await recordInUnifiedSession('AI_CHAT', {
            sessionId: currentSessionId,
            userId: user.userId,
            question: content,
            aiResponse: '',
            metadata: JSON.stringify({
                type: 'USER_MESSAGE',
                recordedAt: new Date().toISOString(),
                sessionId: currentSessionId
            })
        });
        
        console.log(`✅ User message recorded in session: ${currentSessionId}`)
      }
  };

//   // Search within unified session files
// // ✅ ENHANCED: Search that works with restored sessions
// const handleSearch = (term) => {
//     if (!term || typeof term !== 'string' || !term.trim()) {
//         setError('Please enter a valid search term');
//         return;
//     }

//     if (uploadedFiles.length === 0) {
//         setError('Please upload files first');
//         return;
//     }

//     setSearchTerm(term);
//     setError('');
//     setIsLoading(true);

//     try {
//         const results = uploadedFiles
//             .filter(file => file.sessionId === currentSessionId)
//             .map(fileData => {
//                 let fileText = fileData.text || '';
                
//                 // ✅ Handle restored sessions with limited content
//                 if (fileText.length < 100 && !fileData.hasFullContent) {
//                     console.warn(`⚠️ Limited content for restored file ${fileData.name}`);
//                     return {
//                         fileId: fileData.id,
//                         fileName: fileData.name || 'Unknown file',
//                         fileSize: fileData.size || 0,
//                         sentences: [{
//                             id: 0,
//                             number: 1,
//                             text: `Document "${fileData.name}" was restored from a previous session. For full search capability, please re-upload the original file.`,
//                             originalIndex: 0
//                         }],
//                         totalMatches: 1,
//                         totalOccurrences: 1,
//                         isLimitedContent: true
//                     };
//                 }

//                 // ✅ Normal search for files with full content
//                 const sentences = fileText
//                     .split(/[.!?]+/)
//                     .filter(s => typeof s === 'string' && s.trim().length > 0)
//                     .map(s => s.trim());

//                 const matchingSentences = [];
//                 let occurrenceCount = 0;

//                 sentences.forEach((sentence, index) => {
//                     if (typeof sentence === 'string' && sentence.toLowerCase().includes(term.toLowerCase())) {
//                         occurrenceCount++;
//                         matchingSentences.push({
//                             id: index,
//                             number: occurrenceCount,
//                             text: sentence,
//                             originalIndex: index
//                         });
//                     }
//                 });

//                 const regex = new RegExp(`\\b${term}\\b`, 'gi');
//                 const totalOccurrences = (fileText.match(regex) || []).length;

//                 return {
//                     fileId: fileData.id,
//                     fileName: fileData.name || 'Unknown file',
//                     fileSize: fileData.size || 0,
//                     sentences: matchingSentences,
//                     totalMatches: matchingSentences.length,
//                     totalOccurrences: totalOccurrences,
//                     hasFullContent: fileData.hasFullContent
//                 };
//             })
//             .filter(result => result.totalOccurrences > 0);

//         setSearchResults(results);
//         const totalResults = results.reduce((sum, result) => sum + result.totalOccurrences, 0);
//         if (currentSessionId && user?.userId) {
//             recordSearchInUnifiedSession(term, totalResults);
//         } else {
//             console.warn('⚠️ Cannot record search: missing session or user context');
//         }
        
//         console.log(`🔍 Search completed: ${totalResults} results`);
//     } catch (err) {
//         setError('Error searching files: ' + err.message);
//     } finally {
//         setIsLoading(false);
//     }
// };


  // Clear unified session
  const handleClear = () => {
    clearAllSessionData();
    
    const clearMessage = {
      id: Date.now(),
      type: 'ai',
      content: `🗑️ **Unified Session Cleared**\n\nAll documents, searches, and chat history cleared from this session.`,
      timestamp: new Date()
    };
    setCurrentSessionMessages([clearMessage]);
    
    console.log('🗑️ Cleared unified session:', currentSessionId);
  };

const handleNewChat = async () => {
    console.log('🆕 Starting new session creation...');
    
    // ✅ STEP 1: Reset initialization guards first
    setIsInitialized(false);
    setIsInitializing(false);
    
    // ✅ STEP 2: Clear current session data
    setCurrentSessionId(null);
    setCurrentSessionData(null);
    setCurrentDayKey(null);
    clearAllSessionData();
    
    // ✅ STEP 3: Force new session creation
    setSessionLoading(true);
    
    try {
        console.log('🔄 Creating brand new unified session');
        const response = await fetch(`${API_BASE_URL}/api/history/session/new`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.userId,
                sessionType: 'UNIFIED_SESSION',
                sessionTitle: `Work Session ${new Date().toLocaleString()}`
            })
        });

        if (response.ok) {
            const data = await response.json();
            setCurrentSessionId(data.sessionId || data.session?.id);
            setCurrentSessionData(data.session);
            setCurrentDayKey(data.session?.dayKey);
            
            const welcomeMessage = {
                id: Date.now(),
                type: 'ai',
                content: `🎯 **New Session Started!**\n\nFresh unified session created:\n• 📁 Ready for document uploads\n• 🔍 Ready for searches\n• 💬 Ready for AI conversations`,
                timestamp: new Date()
            };
            setCurrentSessionMessages([welcomeMessage]);
            
            // ✅ STEP 4: Mark as initialized after successful creation
            setIsInitialized(true);
            
            console.log('✅ New unified session created successfully:', data.sessionId || data.session?.id);
        } else {
            throw new Error('Failed to create new session');
        }
    } catch (error) {
        console.error('❌ Error creating new session:', error);
        setError('Failed to create new session');
        // Don't set isInitialized on error
    } finally {
        setSessionLoading(false);
    }
    
    // ✅ STEP 5: Close UI elements
    setShowHistory(false);
    closeMobileDrawer();
};


const clearAIBackendCache = async () => {
    try {
        const cacheStrategies = [
            fetch(`${API_BASE_URL}/api/ai/clear-cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user?.userId,
                    sessionId: currentSessionId,
                    action: 'session_switch',
                    timestamp: Date.now(),
                    clearType: 'session_specific'
                })
            }).catch(() => null),
            
            fetch(`${API_BASE_URL}/api/ai/reset-context`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user?.userId,
                    action: 'new_session',
                    forceRefresh: true
                })
            }).catch(() => null)
        ];
        
        await Promise.allSettled(cacheStrategies);
        console.log('✅ AI backend cache cleared for fresh responses');
        
    } catch (error) {
        console.warn('⚠️ Could not clear AI backend cache:', error);
    }
};

const restoreCompleteSessionHistory = async (sessionId) => {
    try {
        console.log('🔄 Fetching complete session history for:', sessionId);
        
        const response = await fetch(`${API_BASE_URL}/api/history/session/complete/${sessionId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📊 Complete session data received:', data);
        
        if (data.success) {
            const allMessages = [];
            
            // ✅ Process chatMessages from API
            if (data.chatMessages && data.chatMessages.length > 0) {
                data.chatMessages.forEach(msg => {
                    allMessages.push({
                        id: msg.id || `restored_${Date.now()}_${Math.random()}`,
                        type: (msg.type || 'ai').toLowerCase(),
                        content: msg.content || '',
                        timestamp: new Date(msg.timestamp || Date.now()),
                        source: msg.source || 'detailed_collection',
                        isRestored: true
                    });
                });
            }
            
            // ✅ Sort by timestamp
            const sortedMessages = allMessages
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .filter(msg => msg.content && msg.content.trim().length > 0);
            
            console.log(`✅ Processed ${sortedMessages.length} complete messages for restoration`);
            return sortedMessages;
        } else {
            console.error('❌ API returned error:', data.error);
            return [];
        }
    } catch (error) {
        console.error('❌ Error fetching complete session history:', error);
        return [];
    }
};


// ✅ FIXED: executeSearchWithFiles function - ensure search results are displayed
const executeSearchWithFiles = (searchTerm, files) => {
  if (!searchTerm || !files || files.length === 0) {
    console.warn('⚠️ Cannot execute search: missing term or files');
    return;
  }

  console.log(`🔍 Executing search for "${searchTerm}" in ${files.length} files`);
  setIsLoading(true);
  setError('');

  try {
    const results = files
      // .filter(file => file.sessionId === currentSessionId)
      .map(fileData => {
        let fileText = fileData.text || '';
        
        // Handle restored sessions with limited content
        if (fileText.length < 100 && !fileData.hasFullContent) {
          console.warn(`⚠️ Limited content for restored file ${fileData.name}`);
          return {
            fileId: fileData.id,
            fileName: fileData.name || 'Unknown file',
            fileSize: fileData.size || 0,
            sentences: [{
              id: 0,
              number: 1,
              text: `Document "${fileData.name}" was restored from a previous session. For full search capability, please re-upload the original file.`,
              originalIndex: 0
            }],
            totalMatches: 1,
            totalOccurrences: 1,
            isLimitedContent: true
          };
        }

        // Normal search for files with full content
        const sentences = fileText
          .split(/[.!?]+/)
          .filter(s => typeof s === 'string' && s.trim().length > 0)
          .map(s => s.trim());

        const matchingSentences = [];
        let occurrenceCount = 0;

        sentences.forEach((sentence, index) => {
          if (typeof sentence === 'string' && sentence.toLowerCase().includes(searchTerm.toLowerCase())) {
            occurrenceCount++;
            matchingSentences.push({
              id: index,
              number: occurrenceCount,
              text: sentence,
              originalIndex: index
            });
          }
        });

        const regex = new RegExp(`\\b${searchTerm}\\b`, 'gi');
        const totalOccurrences = (fileText.match(regex) || []).length;

        return {
          fileId: fileData.id,
          fileName: fileData.name || 'Unknown file',
          fileSize: fileData.size || 0,
          sentences: matchingSentences,
          totalMatches: matchingSentences.length,
          totalOccurrences: totalOccurrences,
          hasFullContent: fileData.hasFullContent
        };
      })
      .filter(result => result.totalOccurrences > 0);

    // ✅ CRITICAL FIX: Set search results immediately and force re-render
    setSearchResults(results);
    
    const totalResults = results.reduce((sum, result) => sum + result.totalOccurrences, 0);
    console.log(`🔍 Search completed: ${totalResults} results found for "${searchTerm}"`);
    console.log('📊 Search results:', results);

    // ✅ FORCE UI UPDATE: Add a small delay to ensure state is updated
    setTimeout(() => {
      setSearchResults(results); // Set again to ensure UI updates
    }, 100);

    // Add search message to indicate results were restored
    const searchMessage = {
      id: `restored_search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'ai',
      content: `🔍 **Restored Search**: "${searchTerm}"\n\nFound ${totalResults} results in ${results.length} documents from your previous session.`,
      timestamp: new Date()
    };
    
    setCurrentSessionMessages(prev => [...prev, searchMessage]);

  } catch (err) {
    console.error('❌ Search execution error:', err);
    setError('Error searching files: ' + err.message);
  } finally {
    setIsLoading(false);
  }
};

// ✅ FIXED: Sanitize content function with proper regex
const sanitizeContentForUpload = useCallback((content, fileName) => {
  if (!content || typeof content !== 'string') {
    return `[Document: ${fileName}]\nRestored from session\nContent available for search but limited for AI analysis.`;
  }

  // ✅ FIX: Replace control characters regex to avoid ESLint error
  let sanitized = content
    // Remove control characters (use Unicode ranges instead of hex codes)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // Remove BOM and other problematic Unicode
    .replace(/\uFEFF/g, '')
    .replace(/\u200B/g, '') // Zero-width space
    .replace(/\u2060/g, '') // Word joiner
    // Clean up multiple spaces and line breaks
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  // Ensure valid content structure for Document AI
  if (sanitized.length > 32000) {
    const firstPart = sanitized.substring(0, 15000);
    const lastPart = sanitized.substring(sanitized.length - 15000);
    sanitized = firstPart + '\n\n[... Content truncated for AI processing ...]\n\n' + lastPart;
  }

  // Ensure minimum content length
  if (sanitized.length < 200) {
    const paddedContent = ` 
DOCUMENT: ${fileName} 
RESTORED: ${new Date().toLocaleString()} 
STATUS: Content preserved from session 
ORIGINAL CONTENT: ${sanitized} 
PROCESSING NOTES: This document was successfully restored from a previous session. The content has been preserved and is fully searchable. For optimal AI analysis, consider re-uploading the original file. 
COMPATIBILITY PADDING: This additional text ensures the document meets minimum processing requirements for the AI backend while maintaining the integrity of your original content. 
END OF DOCUMENT `;
    sanitized = paddedContent;
  }

  return sanitized;
}, []); // ✅ Empty dependency array since function doesn't depend on external variables

const reuploadSessionDocumentsToAI = async (sessionFiles) => {
    if (!sessionFiles || sessionFiles.length === 0) {
        console.log('⚠️ No documents to re-upload to AI backend');
        return false;
    }

    // ✅ GUARD: Check if already uploaded to prevent duplicates
    const uploadKey = `ai_upload_${currentSessionId}`;
    const lastUploadTime = sessionStorage.getItem(uploadKey);
    const now = Date.now();
    
    if (lastUploadTime && (now - parseInt(lastUploadTime)) < 10000) {
        console.log('⚠️ AI backend upload already done recently, skipping');
        return true;
    }

    console.log('🔄 Re-uploading documents to AI backend for session continuity');
    
    // ✅ Clear AI backend first
    try {
        await fetch(`${API_BASE_URL}/api/ai/documents`, { method: 'DELETE' });
        console.log('✅ Cleared AI backend before restoration');
    } catch (error) {
        console.warn('⚠️ Could not clear AI backend:', error);
    }

    let successCount = 0;
    const failedFiles = [];
    const processedFiles = new Set();

    for (const fileData of sessionFiles) {
        if (processedFiles.has(fileData.name)) {
            console.log(`⚠️ Skipping duplicate: ${fileData.name}`);
            continue;
        }
        
        if (!fileData.text || fileData.text.length < 50) {
            console.log(`⚠️ Skipping ${fileData.name} - insufficient content`);
            failedFiles.push({ name: fileData.name, error: 'Insufficient content' });
            continue;
        }

        try {
            console.log(`📤 Re-uploading ${fileData.name} (${fileData.text.length} chars)`);
            
            // ✅ CRITICAL FIX: Handle CSV files specially to preserve full table data
            let contentToSend;
            let fileName = fileData.name;
            
            if (fileData.isTable && fileData.name.toLowerCase().endsWith('.csv')) {
                // ✅ For CSV files, ensure we send the complete parsed data
                if (fileData.text.includes('=== CSV TABLE:') && fileData.text.includes('COMPLETE TABLE DATA:')) {
                    // Already properly formatted CSV content
                    contentToSend = fileData.text;
                    console.log(`📊 Sending complete CSV data: ${fileData.tableData?.length || 'unknown'} rows`);
                } else if (fileData.tableData && fileData.tableData.length > 0) {
                    // ✅ Re-create proper CSV content from table data
                    const headers = Object.keys(fileData.tableData[0]);
                    contentToSend = `=== CSV TABLE: ${fileData.name} ===
COLUMNS: ${headers.join(', ')}
TOTAL ROWS: ${fileData.tableData.length}

COMPLETE TABLE DATA:
${fileData.tableData.map((row, index) => {
    return `Row ${index + 1}: ${headers.map(h => `${h}="${row[h] || ''}"`).join(', ')}`;
}).join('\n')}

COLUMN ANALYSIS:
${headers.map(header => {
    const values = fileData.tableData.map(row => row[header]).filter(v => v && String(v).trim());
    return `${header}: ${values.length} values (Examples: ${values.slice(0, 3).join(', ')})`;
}).join('\n')}

SEARCHABLE CONTENT:
${fileData.tableData.map(row => Object.values(row).join(' ')).join('\n')}
=== END CSV TABLE ===`;
                    console.log(`📊 Re-created CSV content with ${fileData.tableData.length} rows`);
                } else {
                    // ✅ Fallback: send raw content but ensure it's complete
                    contentToSend = fileData.text;
                    console.log(`⚠️ Using raw CSV content as fallback`);
                }
                
                // Keep CSV extension for proper AI processing
                fileName = fileData.name;
            } else {
                // ✅ For non-CSV files, use sanitized content
                contentToSend = sanitizeRestoredContent(fileData.text, fileData.name);
                fileName = fileData.name.replace(/\.(pdf|docx|doc)$/i, '.txt');
            }
            
            // ✅ Create proper blob with appropriate content type
            const blob = new Blob([contentToSend], { 
                type: fileName.endsWith('.csv') ? 'text/csv' : 'text/plain' 
            });
            
            const formData = new FormData();
            formData.append('file', blob, fileName);

            const response = await fetch(`${API_BASE_URL}/api/ai/upload`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                successCount++;
                processedFiles.add(fileData.name);
                console.log(`✅ Successfully re-uploaded ${fileData.name} as ${fileName}: ${response.status}`);
                
                // ✅ Log CSV-specific success details
                if (fileData.isTable) {
                    console.log(`📊 CSV data sent: ${fileData.tableData?.length || 'unknown'} rows, ${contentToSend.length} chars`);
                }
            } else {
                const errorText = await response.text();
                console.log(`❌ Error processing ${fileData.name}:`, response.status, errorText);
                failedFiles.push({ name: fileData.name, error: `HTTP ${response.status}` });
            }
        } catch (error) {
            console.log(`❌ Error processing ${fileData.name}:`, error);
            failedFiles.push({ name: fileData.name, error: error.message });
        }

        // ✅ Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // ✅ Create detailed status message
    const csvFiles = sessionFiles.filter(f => f.isTable && f.name.toLowerCase().endsWith('.csv'));
    const statusMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: `${successCount > 0 ? '✅' : '⚠️'} **AI Chat Restoration Complete!**\n\n📊 **Results:**\n• ${successCount} documents successfully uploaded to AI backend\n• ${failedFiles.length} documents failed\n${csvFiles.length > 0 ? `• ${csvFiles.length} CSV files with complete table data\n` : ''}\n🔍 **Search:** ✅ Fully functional\n💬 **AI Chat:** ${successCount > 0 ? '✅ Ready for questions about your data!' : '⚠️ Use search or try manual re-upload'}\n\n**Your session is fully restored!**`,
        timestamp: new Date()
    };

    // ✅ Mark upload as completed
    sessionStorage.setItem(uploadKey, now.toString());
    setCurrentSessionMessages(prev => [...prev, statusMessage]);
    
    return successCount > 0;
};


// ✅ Content sanitization function
const sanitizeRestoredContent = (content, originalFileName) => {
    if (!content || typeof content !== 'string') {
        return `Document: ${originalFileName}\nContent not available for AI analysis.`;
    }
    
    // ✅ Clean up any formatting artifacts from storage
    let sanitized = content
        // Remove session artifacts
        .replace(/^DOCUMENT: .*\nUPLOADED: .*\nSTATUS: .*$/gm, '')
        .replace(/^=== DOCUMENT \d+: .*\n.*\n.*\n.*\n.*\n\n/gm, '')
        .replace(/\n=== END OF DOCUMENT \d+ ===\n*$/gm, '')
        // Clean up excessive whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    
    // ✅ Add document identifier for AI context
    const header = `[RESTORED DOCUMENT: ${originalFileName}]\n\n`;
    return header + sanitized;
};


  const toggleDarkMode = () => setIsDarkMode(prev => !prev);
  const toggleMobileDrawer = () => setMobileDrawerOpen(!mobileDrawerOpen);
  const closeMobileDrawer = () => setMobileDrawerOpen(false);
  const handleHistoryClick = () => {
    setShowHistory(true);
    closeMobileDrawer();
  };

  // Error display component
  const ErrorMessage = ({ error, onClose }) => {
    if (!error) return null;
    
    return (
      <div className="error-banner">
        <div className="error-content">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
          <button className="error-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>
    );
  };

const handleGenerateCSV = () => {
    if (!tableData || tableData.length === 0) {
      setError('No table data available for CSV generation');
      return;
    }
    setShowCSVGenerator(true);
  };
  return (
    <div className="dashboard">
      {/* Error banner */}
      <ErrorMessage error={error} onClose={() => setError('')} />

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div 
          className="mobile-drawer-overlay open"
          onClick={closeMobileDrawer}
        />
      )}

      {/* Mobile Drawer */}
      <div className={`mobile-drawer ${mobileDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div className="drawer-logo">
            <span className="navbar-logo-icon">📄</span>
            Document AI Agent
          </div>
          <div className="drawer-welcome">Welcome back!</div>
          <div className="drawer-user-info">{user?.username || 'User'}</div>
        </div>
        
        <div className="drawer-nav">
          <div className="drawer-nav-item" onClick={handleHistoryClick}>
            <span className="nav-icon">📚</span>
            <span className="nav-text">History Sessions</span>
          </div>
          <div className="drawer-nav-item" onClick={handleNewChat}>
            <span className="nav-icon">➕</span>
            <span className="nav-text">New Session</span>
          </div>
          <div className="drawer-nav-item" onClick={toggleDarkMode}>
            <span className="nav-icon">{isDarkMode ? '☀️' : '🌙'}</span>
            <span className="nav-text">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
        </div>
        
        <div className="drawer-footer">
          <button className="drawer-logout-btn" onClick={onLogout}>
            <span>🚪</span>
            Logout
          </button>
        </div>
      </div>

      {/* Main Navbar */}
      <nav className="navbar">
        <div className="navbar-left">
          <button 
            className={`hamburger-btn ${mobileDrawerOpen ? 'open' : ''}`}
            onClick={toggleMobileDrawer}
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
          
          <a href="#" className="navbar-logo">
            <span className="navbar-logo-icon">📄</span>
            Document AI Agent
          </a>
        </div>
        
        <div className="navbar-right">
          <span className="welcome-text desktop-only">
            Welcome, {user?.username || 'User'}!
          </span>
          
          {/* {currentSessionId && (
            <span className="session-info desktop-only">
              Unified Session: {currentDayKey} | All Activities
            </span>
          )} */}
          
          <button 
            className="new-session-btn desktop-only"
            onClick={handleNewChat}
            disabled={sessionLoading}
          >
            ➕ New Session
          </button>
          
          <button 
            className="history-toggle-btn desktop-only"
            onClick={handleHistoryClick}
          >
            📚 History Sessions
          </button>
          
          {/* <button 
            className="theme-toggle-btn"
            onClick={toggleDarkMode}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button> */}
          
          <button className="logout-btn desktop-only" onClick={onLogout}>
            Logout
          </button>
        </div>
      </nav>

      {/* History Sidebar */}
      <HistorySidebar
        isOpen={showHistory}
        onToggle={() => setShowHistory(false)}
        user={user}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        currentSessionId={currentSessionId}
        currentDayKey={currentDayKey}
      />

      {/* Session Loading Overlay */}
      {sessionLoading && (
        <div className="session-loading-overlay">
          <div className="session-loading-content">
            <div className="spinner"></div>
            <p>Loading New session...</p>
            <p className="loading-subtitle">
              {currentSessionId ? 'Switching sessions...' : 'Creating new unified session...'}
            </p>
          </div>
        </div>
      )}

      {/* Dashboard Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-grid">
          {/* File Upload Section */}
          <section className="upload-section">
            <div className="section-header">
              <h2>
                <span className="section-icon">📁</span>
                Document Upload
              </h2>
              <p>Upload files</p>
              
            </div>
            
            
            <FileUpload
              onFilesUpload={handleFilesUpload}
              uploadedFiles={uploadedFiles}
              onClear={handleClear}
              isLoading={isLoading}
              error={error}
            />
          </section>

          {/* Search Section */}
          {uploadedFiles.length > 0 && (
            <section className="search-section">
              <div className="section-header">
                <h2>
                  <span className="section-icon">🔍</span>
                  Document Search
                </h2>
                <p>Search within unified session documents</p>
              </div>
              
              <SearchBar
                onSearch={handleSearch}
                isLoading={isLoading}
                searchTerm={searchTerm}
                uploadedFiles={uploadedFiles}
                currentSessionId={currentSessionId}
                searchHistory={currentSessionData?.searchQueries || []}
              />
              
              {searchResults.length > 0 && (
                <SearchResults
                  results={searchResults}
                  searchTerm={searchTerm}
                  uploadedFiles={uploadedFiles}
                  currentSessionId={currentSessionId}
                />
              )}
            </section>
          )}

          {/* AI Chat Section - FIXED: Key prop for session reset */}
          <section className="ai-section">
            <div className="section-header">
              <h2 className='ai-section-title'>
                <span className="section-icon">🤖</span>
                AI Assistant
              </h2>
              <p>Chat about documents to get the Details</p>
              {currentSessionId && (
                <div className="session-chat-indicator">
                  
                </div>
              )}
            </div>
            
            {currentSessionId && (
                <AIChat
                    key={currentSessionId} // ✅ Force remount on session change
                    uploadedFiles={uploadedFiles}
                    currentSessionId={currentSessionId}
                    currentSessionData={currentSessionData}
                    user={user}
                    onRecordMessage={recordChatMessage}
                    initialMessages={currentSessionMessages}
                    isSessionLoading={sessionLoading}
                />
              )}

          </section>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;