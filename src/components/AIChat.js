// src/components/AIChat.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../config';
const MessageComponent = ({ message }) => {
    const isUser = message.type === 'user';
    
    return (
        <div style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            marginBottom: '12px',
            padding: '0 16px'
        }}>
            <div style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: isUser ? '#007bff' : '#f1f3f4',
                color: isUser ? '#ffffff' : '#333333',
                fontSize: '14px',
                lineHeight: '1.4',
                whiteSpace: 'pre-wrap'
            }}>
                {message.content}
            </div>
        </div>
    );
};
const AIChat = ({ 
  uploadedFiles, 
  user, 
  onRecordMessage, 
  initialMessages = [], 
  isSessionLoading = false 
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
                // Handle different message structures from backend
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

            console.log(`Setting ${restoredMessages.length} New messages:`, restoredMessages);
            
            // ✅ FIX: Combine messages instead of appending later
            const confirmationMessage = {
                id: `restoration_${Date.now()}`,
                type: 'ai',
                content: `🔄 **Fresh Session Ready!**\n\n📁 **Documents**: Ready for search and AI analysis\n\n*Start asking questions about your documents!*`,
                timestamp: new Date(),
                isRestored: false
            };
            
            // ✅ Set all messages at once - no setTimeout needed
            const allMessages = [...restoredMessages, confirmationMessage];
            const uniqueMessages = deduplicateMessages(allMessages);
            console.log(`Setting ${uniqueMessages.length} unique messages:`, uniqueMessages);
            setMessages(uniqueMessages);
            setFilesUploaded(true);
            
        } else if (uploadedFiles.length > 0) {
            // New session with uploaded files
            const welcomeMessage = {
                id: Date.now(),
                type: 'ai',
                content: `Hello ${user?.username || 'User'}! I'm your AI assistant. I've detected ${uploadedFiles.length} document(s) for upload. I'll process them now so you can ask questions about ALL the documents together.`,
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

  // Upload files with personalization
  useEffect(() => {
    const uploadAllFilesToBackend = async () => {
      const regularFiles = uploadedFiles.filter(f => !f.isFromSession);
      const restoredFiles = uploadedFiles.filter(f => f.isFromSession);

      // ✅ ADD: Handle restored files
        if (restoredFiles.length > 0 && isInitialized) {
            console.log(`🔄 Processing ${restoredFiles.length} restored files for AI backend`);
            for (const fileData of restoredFiles) {
                if (fileData.text && fileData.text.length > 100) {
                    try {
                        const blob = new Blob([fileData.text], { type: 'text/plain' });
                        const file = new File([blob], fileData.name, { type: 'text/plain' });
                        const formData = new FormData();
                        formData.append('file', file);
                        
                        await fetch(`${API_BASE_URL}/api/ai/upload`, {
                            method: 'POST',
                            body: formData
                        });
                        
                        console.log(`✅ Re-uploaded restored file: ${fileData.name}`);
                    } catch (error) {
                        console.warn(`Failed to re-upload ${fileData.name}:`, error);
                    }
                }
            }
            setFilesUploaded(true);
        }
      
      if (regularFiles.length > 0 && !filesUploaded && !isSessionLoading && isInitialized) {
        try {
          setUploadStatus('Uploading all files to backend...');
          console.log(`Starting upload of ${regularFiles.length} files to backend...`);

          const formData = new FormData();
          regularFiles.forEach((fileObj, index) => {
            if (fileObj.file) {
              console.log(`Adding file ${index + 1}: ${fileObj.name} (${fileObj.file.size} bytes)`);
              formData.append('files', fileObj.file);
            }
          });

          const response = await fetch(`${API_BASE_URL}/api/ai/upload/multiple`, {
            method: 'POST',
            body: formData
          });

          if (response.ok) {
            const data = await response.json();
            console.log('Upload response:', data);
            setFilesUploaded(true);
            setUploadStatus('');

            let uploadMessage = `✅ **Multi-File Upload Complete for ${user?.username}!**\n\n`;
            uploadMessage += `📄 **Successfully processed: ${data.successCount} files**\n`;
            
            if (data.successFiles && data.successFiles.length > 0) {
              uploadMessage += `• ${data.successFiles.join('\n• ')}\n\n`;
            }
            
            if (data.failCount > 0) {
              uploadMessage += `❌ **Failed: ${data.failCount} files**\n`;
              if (data.failedFiles && data.failedFiles.length > 0) {
                uploadMessage += `• ${data.failedFiles.join('\n• ')}\n\n`;
              }
            }
            
            uploadMessage += `🎯 **Total documents ready for ${user?.username}: ${data.totalDocuments}**\n\n`;
            uploadMessage += `You can now ask questions that span across ALL your documents!`;

            const uploadResultMessage = {
              id: Date.now(),
              type: 'ai',
              content: uploadMessage,
              timestamp: new Date()
            };

            setMessages(prev => [...prev, uploadResultMessage]);

            if (onRecordMessage) {
              onRecordMessage('SYSTEM', 'Files uploaded to AI backend', JSON.stringify({
                action: 'backend_upload',
                filesCount: data.successCount,
                totalDocuments: data.totalDocuments
              }));
            }
          } else {
            console.error('Failed to upload files to backend:', response.status);
            setUploadStatus('Upload failed');
            
            const errorMessage = {
              id: Date.now(),
              type: 'ai',
              content: `❌ Failed to upload files to backend for ${user?.username}. Please check the server and try again.`,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
          }
        } catch (error) {
          console.error('Error uploading files:', error);
          setUploadStatus('Upload error');
          
          const errorMessage = {
            id: Date.now(),
            type: 'ai',
            content: `❌ Error uploading files for ${user?.username}: ${error.message}. Please check if the backend server is running.`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } else if (uploadedFiles.length > 0 && !isSessionLoading) {
        setFilesUploaded(true);
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

// ✅ ENHANCED: Sanitized AI query with better error handling
const tryAIQuery = useCallback(async (question) => {
    if (!question.trim()) return;

    // ✅ SANITIZE: Clean the question before sending
    const sanitizedQuestion = question
        .replace(/[📄🔍📊💡🤖👤]/g, '')
        .replace(/[^\w\s\-.,?!]/g, '')
        .trim();

    if (!sanitizedQuestion) {
        const errorMessage = {
            id: Date.now(),
            type: 'ai',
            content: `⚠️ **Question Cleaning Required**\n\nYour question contains special characters that need to be cleaned for AI processing.\n\n**Original:** "${question}"\n**Cleaned:** Please rephrase without special characters.`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
    }
    const sessionAwareQuestion = uploadedFiles.some(f => f.isFromSession) 
        ? `${sanitizedQuestion} (Session: ${uploadedFiles[0]?.sessionId?.slice(-8)})` 
        : sanitizedQuestion;

    console.log('🚀 Sending session-aware request:', { 
        original: question, 
        sanitized: sanitizedQuestion,
        sessionAware: sessionAwareQuestion
    });


    // ✅ Rate limiting check
    const now = Date.now();
    const timeSinceLastRequest = now - lastAIRequestTime;
    const minInterval = 6000;

    if (timeSinceLastRequest < minInterval) {
        const waitTime = Math.ceil((minInterval - timeSinceLastRequest) / 1000);
        const rateLimitMessage = {
            id: Date.now(),
            type: 'ai',
            content: `⏳ **Please wait ${waitTime} seconds** before asking another question.\n\nThis helps ensure reliable AI responses and prevents rate limiting.`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, rateLimitMessage]);
        return;
    }

    setIsLoading(true);
    setIsTyping(true);
    setLastAIRequestTime(now);

    try {
        // ✅ ENHANCED: Better request payload
        const requestPayload = {
            question: sessionAwareQuestion,
            metadata: {
                userId: user?.userId || 'anonymous',
                sessionId: uploadedFiles[0]?.sessionId || 'unknown',
                documentCount: uploadedFiles.length,
                timestamp: new Date().toISOString(),
                originalQuestion: sanitizedQuestion,
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
                // ✅ Check for rate limit in response content
                if (data.answer.includes('Rate limit exceeded') || 
                    data.answer.includes('high demand') ||
                    data.answer.includes('⏳')) {
                    
                    const fallbackResponse = {
                        id: Date.now() + 1,
                        type: 'ai',
                        content: `⏳ **AI is currently busy** - here are comprehensive search results instead!\n\n🔍 **Search Results for:** "${sanitizedQuestion}"\n\n${searchInLocalFiles(sanitizedQuestion)}\n\n💡 **Tip:** Try your AI question again in 30 seconds for full AI analysis.`,
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
                            documentsAnalyzed: data.documentsAnalyzed,
                            timestamp: new Date().toISOString()
                        }));
                    }
                }
            } else {
                throw new Error(data.error || 'Invalid response format');
            }
        } else {
            // ✅ ENHANCED: Better error handling for different status codes
            let errorMessage = '';
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || 'Unknown error';
            } catch {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }

            console.log('❌ AI backend error:', response.status, errorMessage);

            if (response.status === 400) {
                const badRequestMessage = {
                    id: Date.now() + 1,
                    type: 'ai',
                    content: `🔍 **Smart Search Results** (AI request format issue)\n\n**Your Question:** "${question}"\n\n**Comprehensive Results:**\n\n${searchInLocalFiles(sanitizedQuestion)}\n\n⚠️ **Note:** The AI service had trouble processing your request format. Search results provide detailed information from your documents.\n\n**Error Details:** ${errorMessage}`,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, badRequestMessage]);
            } else {
                // Fallback to search for other errors
                const searchResult = searchInLocalFiles(sanitizedQuestion);
                const fallbackMessage = {
                    id: Date.now() + 1,
                    type: 'ai',
                    content: `🔍 **Enhanced Search Results** (AI temporarily unavailable)\n\n**Your Question:** "${question}"\n\n**Found in Documents:**\n\n${searchResult}`,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, fallbackMessage]);
            }
        }

    } catch (error) {
        console.error('❌ AI Query Network Error:', error);
        
        const searchResult = searchInLocalFiles(sanitizedQuestion);
        const errorMessage = {
            id: Date.now() + 1,
            type: 'ai',
            content: `🔍 **Smart Search Response** (Network error)\n\n**Your Question:** "${question}"\n\n**Results from Documents:**\n\n${searchResult}\n\n**Technical Error:** ${error.message}`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
        setIsTyping(false);
    }
}, [lastAIRequestTime, setLastAIRequestTime, searchInLocalFiles, onRecordMessage, user?.userId, uploadedFiles]);


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

  // Summary generation
  const getSummary = async () => {
    if (isLoading || (!filesUploaded && uploadedFiles.length === 0)) return;

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
      const response = await fetch(`${API_BASE_URL}/api/ai/summary`);
      const data = await response.json();

      let summaryContent;
      if (data.success) {
        summaryContent = `**📋 Comprehensive Document Summary for ${user?.username}**\n`;
        summaryContent += `*Analyzing ${data.documentsAnalyzed} documents: ${data.documentNames.join(', ')}*\n\n`;
        summaryContent += data.summary;
      } else {
        summaryContent = `Error generating summary for ${user?.username}: ${data.error || 'Unknown error'}`;
      }

      const summaryMessage = {
        id: Date.now(),
        type: 'ai',
        content: summaryContent,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, summaryMessage]);

      if (onRecordMessage) {
        onRecordMessage('AI', summaryContent, JSON.stringify({
          action: 'summary_generation',
          documentsAnalyzed: data.documentsAnalyzed,
          documentNames: data.documentNames
        }));
      }

      setIsTyping(false);
    } catch (error) {
      console.error('Error generating summary:', error);
      
      const errorMessage = {
        id: Date.now(),
        type: 'ai',
        content: `Error generating summary for ${user?.username}. Please check if the backend is running and try again.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsTyping(false);
    } finally {
      setIsLoading(false);
    }
  };

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
    </div>
  );
};

export default AIChat;