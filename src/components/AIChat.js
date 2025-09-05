// src/components/AIChat.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../config';

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

  // Initialize messages with personalization
  useEffect(() => {
    if (!isInitialized && !isSessionLoading) {
      console.log('🔄 Initializing AIChat for session');
      
      if (initialMessages && initialMessages.length > 0) {
        const restoredMessages = initialMessages.map(msg => ({
          id: msg.id || Date.now() + Math.random(),
          type: msg.type?.toLowerCase() || 'ai',
          content: msg.content || '',
          timestamp: new Date(msg.timestamp || Date.now())
        }));
        setMessages(restoredMessages);
        setFilesUploaded(true);
        console.log('✅ Restored session messages:', restoredMessages.length);
      } else if (uploadedFiles.length > 0) {
        const welcomeMessage = {
          id: Date.now(),
          type: 'ai',
          content: `Hello ${user?.username || 'User'}! I'm your AI assistant. I've detected ${uploadedFiles.length} document(s) for upload. I'll process them now so you can ask questions about ALL the documents together.`,
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
        setFilesUploaded(true);
        console.log('✅ Created welcome message for session');
      } else {
        setMessages([]);
        setFilesUploaded(false);
        console.log('✅ Initialized empty session');
      }
      
      setIsInitialized(true);
    }
  }, [initialMessages, uploadedFiles.length, isSessionLoading, isInitialized, user?.username]);

  // Upload files with personalization
  useEffect(() => {
    const uploadAllFilesToBackend = async () => {
      const regularFiles = uploadedFiles.filter(f => !f.isFromSession);
      
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

  // ✅ FIXED: Complete tryAIQuery function with proper rate limiting
  const tryAIQuery = useCallback(async (question) => {
    if (!question.trim()) return;

    console.log('🚀 Sending request:', { question });

    // ✅ Check rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastAIRequestTime;
    const minInterval = 6000; // 6 seconds between requests
    
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
      const response = await fetch(`${API_BASE_URL}/api/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question })
      });

      console.log('📡 Response status:', response.status);
      const data = await response.json();

      if (response.ok && data.success) {
        console.log('✅ AI Response:', data);
        
        // ✅ Check for rate limit in response
        if (data.answer.includes('Rate limit exceeded') || data.answer.includes('high demand')) {
          const rateLimitResponse = {
            id: Date.now() + 1,
            type: 'ai',
            content: `⏳ **AI is currently busy** - let me search your documents instead!\n\n🔍 **Search Results for:** "${question}"\n\n${searchInLocalFiles(question)}\n\n💡 **Tip:** Try your AI question again in 30 seconds for a full AI analysis.`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, rateLimitResponse]);
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
              question: question,
              documentsAnalyzed: data.documentsAnalyzed,
              timestamp: new Date().toISOString()
            }));
          }
        }
      } else {
        console.log('🔍 AI backend unavailable - using enhanced search instead');
        const searchResult = searchInLocalFiles(question);
        const fallbackMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: `🔍 **Enhanced Search Results**\n\n**Your Question:** ${question}\n\n**Found in Documents:**\n\n${searchResult}\n\n⚠️ AI service is temporarily busy. This comprehensive search provides detailed information from your documents.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, fallbackMessage]);
      }

    } catch (error) {
      console.error('❌ AI Query Error:', error);
      const searchResult = searchInLocalFiles(question);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai', 
        content: `🔍 **Smart Search Response** (AI temporarily unavailable)\n\n**Your Question:** ${question}\n\n**Results from Documents:**\n\n${searchResult}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [lastAIRequestTime, setLastAIRequestTime, searchInLocalFiles, onRecordMessage]);

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
      setMessages(prev => [...prev, noFilesMessage]);
      return;
    }

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    
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
