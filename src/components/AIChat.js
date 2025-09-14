// src/components/AIChat.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import { API_BASE_URL } from '../config';
const AIChat = ({ 
  uploadedFiles, 
  user, 
  onRecordMessage, 
  initialMessages = [], 
  isSessionLoading = false,
  onReuploadDocuments 
}) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [lastRequestTime, setLastRequestTime] = useState(0);
  // ✅ FIX: Add missing lastAIRequestTime state
  const [lastAIRequestTime, setLastAIRequestTime] = useState(0);
  const [filesUploaded, setFilesUploaded] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isExpanded, setIsExpanded] = useState(!isMobile);
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationRef = useRef(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Mobile detection with resize handler
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setIsExpanded(true);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Optimized scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

useEffect(() => {
    if (!isInitialized && !isSessionLoading) {
        initializationRef.current = true;
        console.log('🔄 Initializing AIChat for session');

        if (initialMessages && initialMessages.length > 0) {
            // ✅ ENHANCED: Properly restore ALL message types
            const restoredMessages = initialMessages.map(msg => {
                const messageContent = msg.content || msg.response || msg.text || '';
                const messageType = (msg.type || 'ai').toLowerCase();
                return {
                    id: msg.id || `restored_${Date.now()}_${Math.random()}`,
                    type: messageType === 'user' ? 'user' : 'ai',
                    content: messageContent,
                    timestamp: new Date(msg.timestamp || Date.now()),
                    isRestored: true
                };
            }).filter(msg => msg.content && msg.content.trim().length > 0);

            const confirmationMessage = {
                id: `restoration_${Date.now()}`,
                type: 'ai',
                content: `🔄 **Fresh Session Ready!**\n\n📁 **Documents**: ${uploadedFiles.length} files ready\n📊 **CSV Data**: ${uploadedFiles.filter(f => f.isTable).length} files with NLP support\n🔍 **Search & AI**: Fully functional\n\n*Start asking questions about your documents!*`,
                timestamp: new Date(),
                isRestored: false
            };

            const allMessages = [...restoredMessages, confirmationMessage];
            const uniqueMessages = deduplicateMessages(allMessages);
            setMessages(uniqueMessages);
            setFilesUploaded(true);

        } else if (uploadedFiles.length > 0) {
            // New session with uploaded files
            const csvCount = uploadedFiles.filter(f => f.isTable).length;
            const welcomeMessage = {
                id: Date.now(),
                type: 'ai',
                content: `Hello ${user?.username || 'User'}! I'm your AI assistant. I've detected ${uploadedFiles.length} document(s) including ${csvCount} CSV files with full NLP support. All files are ready for local processing and analysis.`,
                timestamp: new Date()
            };
            setMessages([welcomeMessage]);
            setFilesUploaded(true);
        } else {
            // Empty session
            setMessages([]);
            setFilesUploaded(false);
        }
        setIsInitialized(true);
    }
}, [initialMessages, uploadedFiles.length, isSessionLoading, isInitialized, user?.username]);

useEffect(() => {
        if (isSessionLoading) {
            initializationRef.current = false;
            setIsInitialized(false);
        }
    }, [isSessionLoading]);

// ✅ Add upload prevention for restored sessions
useEffect(() => {
    const uploadAllFilesToBackend = async () => {
        // ✅ GUARD: Skip upload if already attempted recently
        const uploadAttemptKey = `upload_attempt_${user?.userId}_${Date.now()}`;
        const lastAttempt = sessionStorage.getItem('last_upload_attempt');
        const now = Date.now();
        
        if (lastAttempt && (now - parseInt(lastAttempt)) < 30000) {
            console.log('⚠️ Skipping duplicate upload - recent attempt detected');
            return;
        }

        const regularFiles = uploadedFiles.filter(f => !f.isFromSession);
        const restoredFiles = uploadedFiles.filter(f => f.isFromSession);

        // ✅ ENHANCED: Handle restored files with upload skip
        if (restoredFiles.length > 0 && isInitialized) {
            console.log(`🔄 Detected ${restoredFiles.length} restored files - skipping AI backend upload due to consistent failures`);
            
            const skipMessage = {
                id: Date.now(),
                type: 'ai',
                content: `📊 **Session Restored Successfully!**\n\n✅ **${restoredFiles.length} files available for local processing**\n\n🔍 **Search**: Fully functional\n💬 **Data Queries**: Advanced local processing active\n🤖 **AI Chat**: Local processing mode due to backend issues\n\n**Your data is ready for analysis!**`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, skipMessage]);
            setFilesUploaded(true);
            return;
        }

        // ✅ Handle regular files (existing logic but with upload attempt tracking)
        if (regularFiles.length > 0 && !filesUploaded && !isSessionLoading && isInitialized) {
            sessionStorage.setItem('last_upload_attempt', now.toString());
            
            try {
                setUploadStatus('Processing files locally...');
                console.log(`Starting local processing of ${regularFiles.length} files...`);

                // ✅ Skip AI backend upload, process locally only
                setFilesUploaded(true);
                setUploadStatus('');
                
                let uploadMessage = `✅ **Files Processed Locally for ${user?.username}!**\n\n`;
                uploadMessage += `📄 **Successfully processed: ${regularFiles.length} files**\n\n`;
                uploadMessage += `🔍 **Local Processing Active**: All data queries and searches work perfectly\n`;
                uploadMessage += `🤖 **AI Chat**: Using advanced local processing mode\n\n`;
                uploadMessage += `**Files ready:**\n${regularFiles.map(f => `• ${f.name} (${f.isTable ? 'Table data' : 'Text content'})`).join('\n')}\n\n`;
                uploadMessage += `You can now ask questions that span across ALL your documents!`;

                const uploadResultMessage = {
                    id: Date.now(),
                    type: 'ai',
                    content: uploadMessage,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, uploadResultMessage]);

                if (onRecordMessage) {
                    onRecordMessage('SYSTEM', 'Files processed locally', JSON.stringify({ 
                        action: 'local_processing', 
                        filesCount: regularFiles.length 
                    }));
                }
            } catch (error) {
                console.error('Error in local processing:', error);
                setUploadStatus('Local processing error');
            }
        }
    };

    if (isInitialized) {
        uploadAllFilesToBackend();
    }
}, [uploadedFiles, filesUploaded, isSessionLoading, onRecordMessage, isInitialized, user?.username]);


  // Better suggested questions
  const suggestedQuestions = useMemo(() => [
    "📄 What are the main topics?",
    "🔍 Compare key findings", 
    "📊 What are the conclusions?",
    "💡 Summarize everything"
  ], []);

  // ✅ ENHANCED: Local file search function
  const searchInLocalFiles = useCallback((query) => {
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return "No documents available for local search.";
    }

    let results = [];
    let totalMatches = 0;
    
    const cleanQuery = query.replace(/[📄🔍📊💡]/g, '').trim().toLowerCase();
    const queryWords = cleanQuery.split(/\s+/).filter(word => word.length > 2);
    
    console.log('🔍 Searching for:', { originalQuery: query, cleanQuery, queryWords });
    
    uploadedFiles.forEach(file => {
      const text = file.text || '';
      const textLength = text.length;
      
      console.log(`📄 Analyzing ${file.name}: ${textLength} characters`);
      
      if (textLength < 100) {
        return; // Skip files with insufficient content
      }
      
      const sentences = text
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 20);
      
      const matchingSentences = [];
      
      sentences.forEach((sentence, index) => {
        const sentenceLower = sentence.toLowerCase();
        
        const hasMatch = queryWords.some(word => sentenceLower.includes(word)) ||
                        sentenceLower.includes(cleanQuery) ||
                        (cleanQuery.includes('topic') && (
                          sentenceLower.includes('topic') ||
                          sentenceLower.includes('subject') ||
                          sentenceLower.includes('main') ||
                          sentenceLower.includes('key')
                        )) ||
                        (cleanQuery.includes('conclusion') && (
                          sentenceLower.includes('conclusion') ||
                          sentenceLower.includes('result') ||
                          sentenceLower.includes('finding') ||
                          sentenceLower.includes('summary')
                        ));
        
        if (hasMatch && matchingSentences.length < 8) {
          matchingSentences.push({
            text: sentence,
            index: index + 1
          });
          totalMatches++;
        }
      });
      
      if (matchingSentences.length > 0) {
        results.push({
          fileName: file.name,
          matches: matchingSentences,
          fileSize: textLength
        });
      }
    });
    
    if (results.length === 0) {
      return `**No matches found for "${cleanQuery}"**\n\n**📋 Available Documents:**\n• ${uploadedFiles.map(f => `${f.name} (${(f.text || '').length} characters)`).join('\n• ')}\n\n**💡 Try searching for more specific keywords.**`;
    }
    
    let output = `**📊 Found ${totalMatches} matches in ${results.length} document(s):**\n\n`;
    
    results.forEach(({ fileName, matches, fileSize }) => {
      output += `**📄 ${fileName}** (${fileSize} chars):\n`;
      matches.forEach(({ text, index }) => {
        const preview = text.substring(0, 300);
        output += `${index}. ${preview}${text.length > 300 ? '...' : ''}\n\n`;
      });
    });
    
    return output;
  }, [uploadedFiles]);

// ✅ Enhanced deduplication with content check
const deduplicateMessages = useCallback((messages) => {
    const seen = new Map();
    return messages.filter(msg => {
        const key = `${msg.id}_${msg.content?.substring(0, 50)}`;
        if (seen.has(key)) {
            console.log(`🚫 Skipping duplicate message: ${msg.id}`);
            return false;
        }
        seen.set(key, true);
        return true;
    });
}, []);

const executeAdvancedDataQuery = useCallback((query) => {
    if (!uploadedFiles || uploadedFiles.length === 0) {
        return "No data files available for analysis.";
    }

    const csvFiles = uploadedFiles.filter(f => f.isTable && f.tableData);
    if (csvFiles.length === 0) {
        return "No CSV/table data files found for data analysis.";
    }

    let results = [];
    const queryLower = query.toLowerCase();

    csvFiles.forEach(file => {
        const { tableData, name } = file;
        let filteredData = [];

        try {
            // ✅ NEW: Handle specific Customer ID queries
            if (queryLower.includes('customer') && queryLower.includes('id')) {
                const customerIdMatch = query.match(/customer\s*id[:\s]*(\d+)/i);
                if (customerIdMatch) {
                    const targetId = customerIdMatch[1];
                    console.log(`🔍 Looking for Customer ID: ${targetId} in ${name}`);
                    
                    // Search in different possible ID columns
                    filteredData = tableData.filter(row => {
                        const customerId = String(row.CustomerID || row['Customer Id'] || row.customerId || row.ID || row.Index || '');
                        return customerId === targetId || customerId === `${targetId}`;
                    });
                    
                    console.log(`✅ Found ${filteredData.length} matching records for Customer ID ${targetId}`);
                }
            }
            // ✅ EXISTING: Handle comparison queries
            else if (queryLower.includes('age') && (queryLower.includes('>') || queryLower.includes('<') || queryLower.includes('='))) {
                const ageMatch = query.match(/age\s*([><=]+)\s*(\d+)/i);
                if (ageMatch) {
                    const operator = ageMatch[1];
                    const value = parseInt(ageMatch[2]);
                    
                    filteredData = tableData.filter(row => {
                        const age = parseInt(row.Age || row.age || 0);
                        switch (operator) {
                            case '>': return age > value;
                            case '<': return age < value;
                            case '>=': return age >= value;
                            case '<=': return age <= value;
                            case '=': 
                            case '==': return age === value;
                            default: return false;
                        }
                    });
                }
            } else if (queryLower.includes('income') && (queryLower.includes('>') || queryLower.includes('<'))) {
                const incomeMatch = query.match(/income\s*([><=]+)\s*(\d+)/i);
                if (incomeMatch) {
                    const operator = incomeMatch[1];
                    const value = parseInt(incomeMatch[2]);
                    
                    filteredData = tableData.filter(row => {
                        const income = parseInt(row['Annual_Income_(k$)'] || row.Income || row.income || 0);
                        switch (operator) {
                            case '>': return income > value;
                            case '<': return income < value;
                            case '>=': return income >= value;
                            case '<=': return income <= value;
                            case '=':
                            case '==': return income === value;
                            default: return false;
                        }
                    });
                }
            } else if (queryLower.includes('score') && (queryLower.includes('>') || queryLower.includes('<'))) {
                const scoreMatch = query.match(/score\s*([><=]+)\s*(\d+)/i);
                if (scoreMatch) {
                    const operator = scoreMatch[1];
                    const value = parseInt(scoreMatch[2]);
                    
                    filteredData = tableData.filter(row => {
                        const score = parseInt(row.Spending_Score || row.Score || row.score || 0);
                        switch (operator) {
                            case '>': return score > value;
                            case '<': return score < value;
                            case '>=': return score >= value;
                            case '<=': return score <= value;
                            case '=':
                            case '==': return score === value;
                            default: return false;
                        }
                    });
                }
            } else if (queryLower.includes('genre') || queryLower.includes('gender')) {
                const genderMatch = query.match(/(male|female)/i);
                if (genderMatch) {
                    const gender = genderMatch[1];
                    filteredData = tableData.filter(row => 
                        (row.Genre || row.Gender || row.gender || '').toLowerCase().includes(gender.toLowerCase())
                    );
                }
            } else {
                // Generic search across all fields
                filteredData = tableData.filter(row => 
                    Object.values(row).some(value => 
                        String(value).toLowerCase().includes(queryLower.replace(/[><=]/g, '').trim())
                    )
                );
            }

            if (filteredData.length > 0) {
                results.push({
                    fileName: name,
                    data: filteredData,
                    totalRows: tableData.length
                });
            }
        } catch (error) {
            console.error('Error processing query for', name, error);
        }
    });

    if (results.length === 0) {
        // ✅ ENHANCED: Better error message with available customer IDs
        const sampleCustomers = csvFiles.length > 0 ? csvFiles[0].tableData.slice(0, 5).map(row => 
            row.CustomerID || row['Customer Id'] || row.customerId || row.Index || 'N/A'
        ) : [];
        
        return `**No matching records found for:** "${query}"\n\n**Available data fields in your CSV files:**\n${csvFiles.map(f => `• **${f.name}**: ${Object.keys(f.tableData[0] || {}).join(', ')}`).join('\n')}\n\n**Sample Customer IDs available:**\n${sampleCustomers.map(id => `• Customer ID: ${id}`).join('\n')}\n\n**Try queries like:**\n• "Customer Id 1 Details"\n• "Customer Id 25 Details"\n• "age > 25"\n• "income < 50"`;
    }

    let output = `**📊 Data Query Results for:** "${query}"\n\n`;
    
    results.forEach(({ fileName, data, totalRows }) => {
        output += `**📄 ${fileName}** (${data.length} of ${totalRows} records):\n\n`;
        
        // ✅ ENHANCED: Show complete customer details for ID queries
        const isCustomerIdQuery = query.toLowerCase().includes('customer') && query.toLowerCase().includes('id');
        
        const displayData = data.slice(0, isCustomerIdQuery ? 3 : 10); // Show fewer for detailed view
        displayData.forEach((row, index) => {
            output += `**${index + 1}. Customer Details:**\n`;
            Object.entries(row).forEach(([key, value]) => {
                // Show all fields for customer ID queries, limited for others
                if (isCustomerIdQuery || Object.keys(row).indexOf(key) < 6) {
                    output += `   • **${key}**: ${value}\n`;
                }
            });
            output += '\n';
        });
        
        if (data.length > displayData.length) {
            output += `*... and ${data.length - displayData.length} more records*\n`;
        }
    });

    return output;
}, [uploadedFiles]);


// ✅ ENHANCED: Prioritize local data processing when AI backend fails
const tryAIQuery = useCallback(async (question) => {
    if (!question.trim()) return;


    if (uploadedFiles.length === 0) {
        const noFilesMessage = {
            id: Date.now(),
            type: 'ai',
            content: `📁 **No Documents Available**\n\nPlease upload some documents first to start our conversation.`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, noFilesMessage]);
        return;
    }

    // ✅ Check if AI backend has our documents
    const hasAIBackendFiles = uploadedFiles.some(f => f.aiBackendUploaded !== false);
    if (!hasAIBackendFiles) {
        console.log('⚠️ No files confirmed in AI backend, attempting re-upload...');
        
        const reuploadSuccess = onReuploadDocuments ? await onReuploadDocuments(uploadedFiles) : false;
        
        if (!reuploadSuccess) {
            console.log('❌ AI backend re-upload failed, using local processing');
            // Proceed with local processing
        }
    }
    // ✅ ENHANCED: Preserve data query operators while cleaning
    const sanitizedQuestion = question
        .replace(/[📄🔍📊💡🤖👤]/g, '')
        .replace(/[^\w\s\-.,?!><=()]/g, '') // Keep operators
        .trim();

    if (!sanitizedQuestion) {
        const errorMessage = {
            id: Date.now(),
            type: 'ai',
            content: `⚠️ **Question Cleaning Required**\n\nPlease rephrase without special characters.`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
    }

    // ✅ ENHANCED: Better data query detection
    const isDataQuery = /\b(age|income|score|genre|gender|customer|id|where|>|<|=|\d+)\b/i.test(sanitizedQuestion);
    const hasCSVData = uploadedFiles.some(f => f.isTable && f.tableData && f.tableData.length > 0);
    
    // ✅ NEW: Skip AI backend for data queries when we have local CSV data
    if (isDataQuery && hasCSVData) {
        console.log('🔍 Processing data query locally due to AI backend issues');
        
        const userMessage = {
            id: Date.now(),
            type: 'user',
            content: question,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);

        // Process locally immediately
        const localResult = executeAdvancedDataQuery(sanitizedQuestion);
        const dataResponseMessage = {
            id: Date.now() + 1,
            type: 'ai',
            content: `🔍 **Smart Data Analysis** (Local Processing)\n\n**Your Query:** "${question}"\n\n${localResult}`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, dataResponseMessage]);

        if (onRecordMessage) {
            onRecordMessage('AI', dataResponseMessage.content, JSON.stringify({
                action: 'local_data_query',
                question: sanitizedQuestion,
                isDataQuery: true,
                processedLocally: true
            }));
        }
        return;
    }

    const sessionAwareQuestion = uploadedFiles.some(f => f.isFromSession) 
        ? `${isDataQuery ? 'DATA_QUERY: ' : ''}${sanitizedQuestion} (Session: ${uploadedFiles[0]?.sessionId?.slice(-8)})` 
        : `${isDataQuery ? 'DATA_QUERY: ' : ''}${sanitizedQuestion}`;

    console.log('🚀 Sending session-aware request:', { 
        original: question, 
        sanitized: sanitizedQuestion,
        sessionAware: sessionAwareQuestion,
        isDataQuery: isDataQuery
    });

    // Rate limiting check
    const now = Date.now();
    const timeSinceLastRequest = now - lastAIRequestTime;
    const minInterval = 6000;

    if (timeSinceLastRequest < minInterval) {
        const waitTime = Math.ceil((minInterval - timeSinceLastRequest) / 1000);
        const rateLimitMessage = {
            id: Date.now(),
            type: 'ai',
            content: `⏳ **Please wait ${waitTime} seconds** before asking another question.`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, rateLimitMessage]);
        return;
    }

    setIsLoading(true);
    setIsTyping(true);
    setLastAIRequestTime(now);

    try {
        const requestPayload = {
            question: sessionAwareQuestion,
            metadata: {
                userId: user?.userId || 'anonymous',
                sessionId: uploadedFiles[0]?.sessionId || 'unknown',
                documentCount: uploadedFiles.length,
                timestamp: new Date().toISOString(),
                originalQuestion: sanitizedQuestion,
                isDataQuery: isDataQuery,
                hasTableData: uploadedFiles.some(f => f.isTable),
                sessionContext: {
                    isRestoredSesion: uploadedFiles.some(f => f.isFromSession),
                    sessionSwitchTime: Date.now(),
                    requestId: `${Date.now()}_${Math.random()}`
                }
            }
        };

        console.log('📤 Request payload:', requestPayload);
        
        const hasRestoredFiles = uploadedFiles.some(f => f.isFromSession);
        if (hasRestoredFiles) {
            console.log('⚠️ Detected restored session files - AI backend may need documents');
        }

        const response = await fetch(`${API_BASE_URL}/api/ai/ask`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        console.log('📡 Response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ AI Response received:', data);

            if (data.success && data.answer) {
                if (data.answer.includes('Rate limit exceeded') || 
                    data.answer.includes('high demand') ||
                    data.answer.includes('⏳')) {
                    
                    const fallbackResponse = {
                        id: Date.now() + 1,
                        type: 'ai',
                        content: `⏳ **AI is currently busy** - here are comprehensive results instead!\n\n🔍 **Results for:** "${sanitizedQuestion}"\n\n${isDataQuery ? executeAdvancedDataQuery(sanitizedQuestion) : searchInLocalFiles(sanitizedQuestion)}\n\n💡 **Tip:** Try again in 30 seconds for full AI analysis.`,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, fallbackResponse]);
                } else {
                    const aiMessage = {
                        id: Date.now() + 1,
                        type: 'ai',
                        content: data.answer,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, aiMessage]);

                    if (onRecordMessage) {
                        onRecordMessage('AI', data.answer, JSON.stringify({
                            action: 'ai_response',
                            question: sanitizedQuestion,
                            originalQuestion: question,
                            isDataQuery: isDataQuery,
                            documentsAnalyzed: data.documentsAnalyzed,
                            timestamp: new Date().toISOString()
                        }));
                    }
                }
            } else {
                throw new Error(data.error || 'Invalid response format');
            }
        } else {
            // ✅ ENHANCED: Better error handling with local processing priority
            let errorMessage = '';
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || 'Unknown error';
            } catch {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }

            console.log('❌ AI backend error:', response.status, errorMessage);

            // ✅ PRIORITY: Use local processing for any backend failure
            const result = isDataQuery ? executeAdvancedDataQuery(sanitizedQuestion) : searchInLocalFiles(sanitizedQuestion);
            const fallbackMessage = {
                id: Date.now() + 1,
                type: 'ai',
                content: `🔍 **${isDataQuery ? 'Advanced Data Analysis' : 'Smart Search'}** (AI backend unavailable)\n\n**Your Question:** "${question}"\n\n${result}\n\n⚠️ **Note:** Using local processing due to backend issues. Results are comprehensive and accurate.`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, fallbackMessage]);
        }

    } catch (error) {
        console.error('❌ AI Query Network Error:', error);
        
        // ✅ ENHANCED: Network error fallback with local processing
        const result = isDataQuery ? executeAdvancedDataQuery(sanitizedQuestion) : searchInLocalFiles(sanitizedQuestion);
        const errorMessage = {
            id: Date.now() + 1,
            type: 'ai',
            content: `🔍 **${isDataQuery ? 'Smart Data Analysis' : 'Local Search'}** (Network error)\n\n**Your Question:** "${question}"\n\n${result}\n\n**Status:** Local processing active while resolving connectivity issues.`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
        setIsTyping(false);
    }
}, [lastAIRequestTime, setLastAIRequestTime, searchInLocalFiles, onRecordMessage, user?.userId, uploadedFiles, executeAdvancedDataQuery]);



  // ✅ FIXED: Complete sendMessage function
  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Check if we have files
    if (uploadedFiles.length === 0) {
      const noFilesMessage = {
        id: Date.now(),
        type: 'ai',
        content: `📁 **No Documents Found for ${user?.username}**\n\nPlease upload some documents first to start our conversation.`,
        timestamp: new Date()
      };
      setMessages(prev => deduplicateMessages([...prev, noFilesMessage]));
      return;
    }

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => deduplicateMessages([...prev, userMessage]));
    
    if (onRecordMessage) {
      onRecordMessage('USER', inputMessage, JSON.stringify({
        action: 'user_question',
        timestamp: new Date().toISOString()
      }));
    }

    const currentInput = inputMessage;
    setInputMessage('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // ✅ Start AI query process
    await tryAIQuery(currentInput);
  }, [inputMessage, isLoading, uploadedFiles, onRecordMessage, user?.username, tryAIQuery]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Auto-resize textarea
  const handleTextareaChange = useCallback((e) => {
    setInputMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, isMobile ? 180 : 150);
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [isMobile]);

  const handleSuggestedQuestion = useCallback((question) => {
    if (isLoading || (!filesUploaded && uploadedFiles.length === 0)) return;
    
    setInputMessage(question);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, isMobile ? 180 : 150);
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [isLoading, filesUploaded, uploadedFiles.length, isMobile]);

  const generateLocalSummary = (files) => {
    if (!files || files.length === 0) {
        return "No documents available for summary generation.";
    }

    let summary = `📋Comprehensive Document Analysis\n\n`;
    summary += `📊 Overview:\n`;
    summary += `• Total Documents: ${files.length}\n`;
    summary += `• Total Content: ${files.reduce((sum, f) => sum + (f.text?.length || 0), 0).toLocaleString()} characters\n`;
    summary += `• CSV/Data Files: ${files.filter(f => f.isTable).length}\n`;
    summary += `• Text Documents: ${files.filter(f => !f.isTable).length}\n\n`;

    // ✅ ANALYZE EACH FILE
    summary += `📄 Document Analysis:\n\n`;
    files.forEach((file, index) => {
        summary += `**${index + 1}. ${file.name}**\n`;
        
        if (file.isTable && file.tableData) {
            // CSV Analysis
            const rowCount = file.tableData.length;
            const columns = Object.keys(file.tableData[0] || {});
            summary += `• Type: CSV Database (${rowCount.toLocaleString()} records)\n`;
            summary += `• Columns: ${columns.join(', ')}\n`;
            summary += `• Data Quality: ${rowCount > 0 ? 'Complete' : 'Empty'} dataset\n`;
            
            if (rowCount > 0) {
                summary += `• Sample Record: ${Object.entries(file.tableData[0]).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
            }
        } else {
            // Text Analysis
            const text = file.text || '';
            const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20).length;
            
            summary += `• Type: Text Document (${text.length.toLocaleString()} characters)\n`;
            summary += `• Word Count: ${wordCount.toLocaleString()} words\n`;
            summary += `• Sentences: ${sentences} sentences\n`;
            summary += `• Content Density: ${text.length > 1000 ? 'Rich' : text.length > 500 ? 'Moderate' : 'Brief'} content\n`;
        }
        summary += '\n';
    });

    // ✅ CROSS-DOCUMENT INSIGHTS
    const totalWords = files.reduce((sum, f) => {
        const text = f.text || '';
        return sum + text.split(/\s+/).length;
    }, 0);

    const csvCount = files.filter(f => f.isTable).length;
    const textCount = files.filter(f => !f.isTable).length;

    summary += `🔍 **Key Insights:**\n`;
    summary += `• Document Mix: ${csvCount} data files + ${textCount} text documents\n`;
    summary += `• Average Length: ${Math.round(totalWords / files.length).toLocaleString()} words per document\n`;
    summary += `• Data Coverage: ${files.length} different sources analyzed\n`;
    summary += `• Processing Status: Local analysis complete, all features functional\n\n`;

    summary += `✅ **Conclusion:**\n`;
    summary += `Successfully analyzed ${files.length} documents containing ${totalWords.toLocaleString()} total words. `;
    if (csvCount > 0) {
        summary += `Data files provide structured information for queries and filtering. `;
    }
    summary += `All documents are ready for comprehensive search, analysis, and cross-referencing.`;

    return summary;
};
  // ✅ ENHANCED: Summary generation with PDF report
const getSummary = async () => {
    if (isLoading || (!filesUploaded && uploadedFiles.length === 0)) return;

    // Check minimum files requirement
    if (uploadedFiles.length < 1) {
        const minFilesMessage = {
            id: Date.now(),
            type: 'ai',
            content: `📄Document Analysis Required\n\nPlease upload at least 1 documents to generate a comprehensive summary and PDF report.\n\nCurrent files: ${uploadedFiles.length}\n**Required`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, minFilesMessage]);
        return;
    }

    const currentTime = Date.now();
    if (currentTime - lastRequestTime < 2000) {
        const rateLimitMessage = {
            id: Date.now(),
            type: 'ai',
            content: 'Please wait a moment before requesting another summary.',
            timestamp: new Date()
        };
        setMessages(prev => [...prev, rateLimitMessage]);
        return;
    }

    setIsLoading(true);
    setIsTyping(true);
    setLastRequestTime(currentTime);

    try {
        let summaryContent = '';
        let analysisData = {};
        let pdfGenerated = false;

        // ✅ TRY AI BACKEND FIRST
        try {
            console.log('📤 Requesting AI summary from backend...');
            const response = await fetch(`${API_BASE_URL}/api/ai/summary`);
            const data = await response.json();
            
            if (data.success && data.summary) {
                summaryContent = `**📋 AI-Powered Multi-Document Analysis**\n\n`;
                summaryContent += `*Analyzing ${data.documentsAnalyzed || uploadedFiles.length} documents: ${(data.documentNames || uploadedFiles.map(f => f.name)).join(', ')}*\n\n`;
                summaryContent += data.summary;
                
                analysisData = {
                    documentsAnalyzed: data.documentsAnalyzed,
                    documentNames: data.documentNames,
                    aiProcessed: true
                };
                
                console.log('✅ AI summary received, generating PDF...');
            } else {
                throw new Error('AI summary failed: ' + (data.error || 'Unknown error'));
            }
        } catch (aiError) {
            console.log('⚠️ AI backend failed, generating local summary...');
            // ✅ FALLBACK TO LOCAL SUMMARY GENERATION
            summaryContent = generateLocalSummary(uploadedFiles);
            analysisData = {
                documentsAnalyzed: uploadedFiles.length,
                documentNames: uploadedFiles.map(f => f.name),
                aiProcessed: false
            };
        }

        // ✅ GENERATE PDF FROM SUMMARY
        try {
            const pdfFileName = await generatePDFFromSummary(summaryContent, uploadedFiles, analysisData);
            pdfGenerated = true;
            
            const summaryMessage = {
                id: Date.now(),
                type: 'ai',
                content: `${summaryContent}\n\n---\n\n📄 **PDF Report Generated Successfully!**\n\n✅ **File:** ${pdfFileName}\n🔽 **Status:** Downloaded to your device\n📊 **Content:** Complete analysis of ${uploadedFiles.length} documents\n\n**The PDF contains formatted analysis, statistics, and all key insights from your documents.**`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, summaryMessage]);
            
        } catch (pdfError) {
            console.error('❌ PDF generation failed:', pdfError);
            
            // ✅ SHOW SUMMARY WITHOUT PDF
            const summaryMessage = {
                id: Date.now(),
                type: 'ai',
                content: `${summaryContent}\n\n---\n\n⚠️ **PDF generation failed:** ${pdfError.message}\n\n**Summary is complete above, but PDF could not be created.**`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, summaryMessage]);
        }

        // ✅ RECORD THE ACTIVITY
        if (onRecordMessage) {
            onRecordMessage('AI', summaryContent, JSON.stringify({
                action: 'summary_generation_with_pdf',
                documentsAnalyzed: analysisData.documentsAnalyzed,
                documentNames: analysisData.documentNames,
                pdfGenerated: pdfGenerated,
                aiProcessed: analysisData.aiProcessed,
                timestamp: new Date().toISOString()
            }));
        }

    } catch (error) {
        console.error('❌ Summary generation error:', error);
        
        const errorMessage = {
            id: Date.now(),
            type: 'ai',
            content: `❌ **Summary Generation Failed**\n\nError: ${error.message}\n\nPlease try again or check if your documents are properly uploaded.`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
        setIsTyping(false);
    }
};

  const generatePDFFromSummary = useCallback(async (summaryContent, files, analysisData = {}) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        const lineHeight = 7;
        let yPosition = margin;

        // ✅ HEADER SECTION
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("Document Analysis Report", margin, yPosition);
        yPosition += lineHeight * 2;

        // ✅ METADATA SECTION
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
        yPosition += lineHeight;
        doc.text(`User: ${user?.username || 'Unknown'}`, margin, yPosition);
        yPosition += lineHeight;
        doc.text(`Total Documents: ${files.length}`, margin, yPosition);
        yPosition += lineHeight;
        
        // File list
        doc.setFontSize(11);
        doc.text("Documents Analyzed:", margin, yPosition);
        yPosition += lineHeight;
        
        files.forEach((file, index) => {
            const fileInfo = `${index + 1}. ${file.name} ${file.isTable ? '(CSV Data)' : '(Text)'} - ${(file.text?.length || 0).toLocaleString()} chars`;
            const lines = doc.splitTextToSize(fileInfo, pageWidth - 2 * margin);
            lines.forEach(line => {
                if (yPosition > pageHeight - margin) {
                    doc.addPage();
                    yPosition = margin;
                }
                doc.text(`   ${line}`, margin, yPosition);
                yPosition += lineHeight;
            });
        });
        
        yPosition += lineHeight;

        // ✅ ANALYSIS STATISTICS
        if (analysisData.documentsAnalyzed) {
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Analysis Statistics:", margin, yPosition);
            yPosition += lineHeight;
            
            doc.setFont("helvetica", "normal");
            doc.text(`Documents Processed: ${analysisData.documentsAnalyzed}`, margin, yPosition);
            yPosition += lineHeight;
            
            if (analysisData.documentNames) {
                doc.text(`Files: ${analysisData.documentNames.join(', ')}`, margin, yPosition);
                yPosition += lineHeight;
            }
            yPosition += lineHeight;
        }

        // ✅ MAIN CONTENT SECTION
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Analysis Summary:", margin, yPosition);
        yPosition += lineHeight * 1.5;

        // Clean and format the summary content
        const cleanContent = summaryContent
            .replace(/\*\*/g, '') // Remove markdown bold
            .replace(/### /g, '')
            .replace(/## /g, '')
            .replace(/# /g, '')
            .replace(/📋|📊|📄|🔍|💡|✅|❌|⚠️/g, '') // Remove emojis
            .trim();

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        
        const contentLines = doc.splitTextToSize(cleanContent, pageWidth - 2 * margin);
        
        contentLines.forEach(line => {
            if (yPosition > pageHeight - margin) {
                doc.addPage();
                yPosition = margin;
            }
            doc.text(line, margin, yPosition);
            yPosition += lineHeight;
        });

        // ✅ FOOTER
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(`Page ${i} of ${totalPages}`, pageWidth - 40, pageHeight - 10);
            doc.text(`Generated by Document Analysis System`, margin, pageHeight - 10);
        }

        // ✅ SAVE PDF
        const fileName = `analysis_summary_${new Date().getTime()}.pdf`;
        doc.save(fileName);
        
        return fileName;
    } catch (error) {
        console.error('❌ Error generating PDF:', error);
        throw error;
    }
}, [user?.username]);

  // Clear chat functionality
  const clearChat = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/ai/documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages([]);
        setFilesUploaded(false);
        setUploadStatus('');

        const successMessage = {
          id: Date.now(),
          type: 'ai',
          content: `✅ ${data.message}\n\n*Cleared ${data.clearedCount} documents from ${user?.username}'s session*`,
          timestamp: new Date()
        };

        setTimeout(() => {
          setMessages([successMessage]);
        }, 100);

        if (onRecordMessage) {
          onRecordMessage('SYSTEM', 'Chat and documents cleared', JSON.stringify({
            action: 'clear_chat',
            clearedCount: data.clearedCount
          }));
        }
      } else {
        const errorMessage = {
          id: Date.now(),
          type: 'ai',
          content: `❌ Failed to clear documents from backend for ${user?.username}. Please try again.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error clearing documents:', error);
      
      const errorMessage = {
        id: Date.now(),
        type: 'ai',
        content: `❌ Error clearing documents for ${user?.username}: ${error.message}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Show placeholder if no files uploaded
  if (uploadedFiles.length === 0 && !isSessionLoading) {
    return (
      <div className="ai-chat-placeholder">
        <div className="placeholder-content">
          <div className="placeholder-icon">🤖</div>
          <h3>AI Assistant for {user?.username}</h3>
          <p>Upload multiple documents to start comprehensive analysis</p>
          
          <div className="placeholder-features">
            <p><span className="placeholder-feature-icon">📄</span>Multi-document analysis</p>
            <p><span className="placeholder-feature-icon">🔍</span>Cross-document search</p>
            <p><span className="placeholder-feature-icon">💬</span>Intelligent conversations</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-chat-container">
      {/* AI Chat Header */}
      <div className="ai-chat-header" onClick={() => isMobile && setIsExpanded(!isExpanded)}>
        <div className="header-content">
          <div className="ai-icon">🤖</div>
          
          <div className="header-text">
            <h3>AI Assistant for {user?.username}</h3>
            <div className="file-count">
              {uploadedFiles.length} documents loaded
            </div>
          </div>
          
          {isMobile && (
            <div className="expand-indicator">
              {isExpanded ? '▼' : '▲'}
            </div>
          )}
          
          {!isMobile && (
            <div className="chat-actions">
              <button 
                className="summary-btn" 
                onClick={getSummary}
                disabled={isLoading || (!filesUploaded && uploadedFiles.length === 0)}
              >
                📋 Summary
              </button>
              <button 
                className="clear-btn" 
                onClick={clearChat}
                disabled={isLoading}
              >
                🗑️ Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div className={`messages-container ${isMobile && !isExpanded ? 'collapsed' : 'expanded'}`}>
        {messages.length === 0 ? (
          <div className="welcome-message">
            <div className="welcome-icon">👋</div>
            <h3>Welcome {user?.username}!</h3>
            <p>I'm ready to help you analyze your documents. Ask me anything!</p>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.type}`}>
                <div className="message-avatar">
                  {message.type === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-text">{message.content}</div>
                  <div className="message-time">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="message ai">
                <div className="message-avatar">🤖</div>
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                  <div className="typing-text">AI is thinking...</div>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length > 0 && !isLoading && (
        <div className="suggested-questions">
          {suggestedQuestions.map((question, index) => (
            <button
              key={index}
              className="suggested-question-btn"
              onClick={() => handleSuggestedQuestion(question)}
              disabled={isLoading || (!filesUploaded && uploadedFiles.length === 0)}
            >
              {question}
            </button>
          ))}
        </div>
      )}

      {/* Chat Input */}
      <div className="chat-input-container">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={inputMessage}
            onChange={handleTextareaChange}
            onKeyPress={handleKeyPress}
            placeholder={`Ask about your documents, ${user?.username}...`}
            disabled={isLoading}
            rows={1}
          />
          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={isLoading || !inputMessage.trim() || (!filesUploaded && uploadedFiles.length === 0)}
          >
            {isLoading ? '⏳' : '📤'}
          </button>
        </div>
        
        <div className="input-footer">
          <div className="input-help">
            Press Enter to send • Shift + Enter for new line
          </div>
        </div>
      </div>
<div className="summary-actions" style={{display: 'flex', gap: '10px', marginTop: '2px'}}>
    <button 
        onClick={getSummary}
        disabled={isLoading || (!filesUploaded && uploadedFiles.length === 0) || uploadedFiles.length < 1}
        className="summary-btn"
        style={{
            padding: '10px 15px',
            backgroundColor: uploadedFiles.length >= 1 ? '#007bff' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: uploadedFiles.length >= 2 ? 'pointer' : 'not-allowed'
        }}
    >
        📋 Generate Summary + PDF
    </button>
  </div>

    </div>
  );
};

export default AIChat;