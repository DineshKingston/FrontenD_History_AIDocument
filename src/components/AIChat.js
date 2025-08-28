import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const AIChat = ({ uploadedFiles }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [filesUploaded, setFilesUploaded] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (uploadedFiles.length > 0 && messages.length === 0) {
      const welcomeMessage = {
        id: Date.now(),
        type: 'ai',
        content: `Hello! I'm your AI assistant. I've detected ${uploadedFiles.length} document(s) for upload. I'll process them now so you can ask questions about ALL the documents together.`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [uploadedFiles, messages.length]);

  // Upload ALL files to backend when files change
  useEffect(() => {
    const uploadAllFilesToBackend = async () => {
      if (uploadedFiles.length > 0 && !filesUploaded) {
        try {
          setUploadStatus('Uploading all files to backend...');
          console.log(`Starting upload of ${uploadedFiles.length} files to backend...`);

          const formData = new FormData();
          
          // Add ALL files to FormData with the same key 'files'
          uploadedFiles.forEach((fileObj, index) => {
            console.log(`Adding file ${index + 1}: ${fileObj.name} (${fileObj.file.size} bytes)`);
            formData.append('files', fileObj.file);
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
            
            // Show comprehensive upload results
            let uploadMessage = `✅ Multi-File Upload Complete!\n\n`;
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
            
            uploadMessage += `🎯 **Total documents ready for analysis: ${data.totalDocuments}**\n\n`;
            uploadMessage += `You can now ask questions that span across ALL your documents!`;
            
            const uploadResultMessage = {
              id: Date.now(),
              type: 'ai',
              content: uploadMessage,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, uploadResultMessage]);
            
          } else {
            console.error('Failed to upload files to backend:', response.status);
            setUploadStatus('Upload failed');
            const errorMessage = {
              id: Date.now(),
              type: 'ai',
              content: '❌ Failed to upload files to backend. Please check the server and try again.',
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
            content: `❌ Error uploading files: ${error.message}. Please check if the backend server is running.`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      }
    };

    uploadAllFilesToBackend();
  }, [uploadedFiles, filesUploaded]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !filesUploaded) return;

    const currentTime = Date.now();
    if (currentTime - lastRequestTime < 2000) {
      const rateLimitMessage = {
        id: Date.now(),
        type: 'ai',
        content: 'Please wait a moment before sending another message. (Rate limiting)',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, rateLimitMessage]);
      return;
    }

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);
    setIsTyping(true);
    setLastRequestTime(currentTime);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: currentInput })
      });

      const data = await response.json();

      setTimeout(() => {
        let aiContent = data.success ? data.answer : (data.error || 'Sorry, I could not process your question.');
        
        // Add document info if available
        if (data.success && data.documentsAnalyzed && data.documentNames) {
          aiContent += `\n\n*[Analysis based on ${data.documentsAnalyzed} documents: ${data.documentNames.join(', ')}]*`;
        }
        
        const aiMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: aiContent,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);
        setIsTyping(false);
      }, 1000);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: 'Sorry, I encountered a connection error. Please check if the backend is running and try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsTyping(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getSummary = async () => {
    if (isLoading || !filesUploaded) return;

    const currentTime = Date.now();
    if (currentTime - lastRequestTime < 2000) {
      const rateLimitMessage = {
        id: Date.now(),
        type: 'ai',
        content: 'Please wait a moment before requesting another summary. (Rate limiting)',
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
        summaryContent = `**Comprehensive Document Summary**\n`;
        summaryContent += `*Analyzing ${data.documentsAnalyzed} documents: ${data.documentNames.join(', ')}*\n\n`;
        summaryContent += data.summary;
      } else {
        summaryContent = `Error generating summary: ${data.error || 'Unknown error'}`;
      }

      const summaryMessage = {
        id: Date.now(),
        type: 'ai',
        content: summaryContent,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, summaryMessage]);
      setIsTyping(false);

    } catch (error) {
      console.error('Error generating summary:', error);
      const errorMessage = {
        id: Date.now(),
        type: 'ai',
        content: 'Error generating summary. Please check if the backend is running and try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsTyping(false);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/ai/documents`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Clear frontend state
        setMessages([]);
        setFilesUploaded(false);
        setUploadStatus('');
        
        const successMessage = {
          id: Date.now(),
          type: 'ai',
          content: `✅ ${data.message}\n\n*Cleared ${data.clearedCount} documents from memory*`,
          timestamp: new Date()
        };
        
        setTimeout(() => {
          setMessages([successMessage]);
        }, 100);
        
      } else {
        const errorMessage = {
          id: Date.now(),
          type: 'ai',
          content: '❌ Failed to clear documents from backend. Please try again.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error clearing documents:', error);
      const errorMessage = {
        id: Date.now(),
        type: 'ai',
        content: `❌ Error clearing documents: ${error.message}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (question) => {
    if (isLoading || !filesUploaded) return;
    
    setInputMessage(question);
    setTimeout(() => {
      const textarea = document.querySelector('.chat-input textarea');
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, 100);
  };

  if (uploadedFiles.length === 0) {
    return (
      <div className="ai-chat-section">
        <div className="ai-chat-placeholder">
          <div className="placeholder-icon">🤖</div>
          <h3>Multi-Document AI Assistant</h3>
          <p>Upload multiple documents to start comprehensive analysis</p>
          <div className="placeholder-features">
            <p>🔍 Ask questions across all documents</p>
            <p>📋 Generate comprehensive summaries</p>
            <p>💡 Find connections between documents</p>
            <p>📄 Analyze multiple files simultaneously</p>
            <p>🤖 Powered by Gemini AI</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-chat-section">
      <div className="chat-header">
        <div className="chat-title">
          <span className="ai-icon">🤖</span>
          <h3>Multi-Document AI Assistant</h3>
          <span className="document-count">
            {uploadedFiles.length} document{uploadedFiles.length !== 1 ? 's' : ''} 
            {filesUploaded ? ' ✅ ready' : ' ⏳ processing...'}
          </span>
        </div>
        <div className="chat-actions">
          <button 
            onClick={getSummary} 
            className="summary-btn" 
            disabled={isLoading || !filesUploaded}
            title="Generate comprehensive summary of all documents"
          >
            📋 Multi-Doc Summary
          </button>
          <button 
            onClick={clearChat} 
            className="clear-chat-btn"
            title="Clear all documents and reset AI assistant"
            disabled={isLoading}
          >
            🗑️ Clear All
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {uploadStatus && (
          <div className="upload-status">
            <div className="upload-indicator">⏳ {uploadStatus}</div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            <div className="message-avatar">
              {message.type === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              <div className="message-text">
                {message.content.split('\n').map((line, index) => (
                  <p key={index}>
                    {line.startsWith('**') && line.endsWith('**') ? (
                      <strong>{line.slice(2, -2)}</strong>
                    ) : line.startsWith('*') && line.endsWith('*') ? (
                      <em>{line.slice(1, -1)}</em>
                    ) : line}
                  </p>
                ))}
              </div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="message ai typing">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div className="typing-text">AI is analyzing across all documents...</div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="suggested-questions">
          <button 
            onClick={() => handleSuggestedQuestion("What are the main topics discussed across ALL these documents?")}
            disabled={isLoading || !filesUploaded}
            title="Analyze topics across all documents"
          >
            📝 Cross-Document Topics
          </button>
          <button 
            onClick={() => handleSuggestedQuestion("Compare and contrast the key findings from all documents")}
            disabled={isLoading || !filesUploaded}
          >
            🔍 Compare Findings
          </button>
          <button 
            onClick={() => handleSuggestedQuestion("What connections or relationships exist between these documents?")}
            disabled={isLoading || !filesUploaded}
          >
            🔗 Document Connections
          </button>
          <button 
            onClick={() => handleSuggestedQuestion("Summarize each document separately and highlight differences")}
            disabled={isLoading || !filesUploaded}
          >
            📊 Individual Analysis
          </button>
        </div>

        <div className="chat-input">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={filesUploaded ? "Ask me anything about ALL your documents..." : "Please wait while all documents are being processed..."}
            disabled={isLoading || !filesUploaded}
            rows="3"
            maxLength={500}
          />
          <button 
            onClick={sendMessage} 
            disabled={isLoading || !inputMessage.trim() || !filesUploaded}
            title={isLoading ? "Please wait..." : !filesUploaded ? "Documents are being processed..." : "Send multi-document query"}
          >
            {isLoading ? '⏳' : '📤'}
          </button>
        </div>
        
        {inputMessage.length > 450 && (
          <div className="character-count">
            {inputMessage.length}/500 characters
          </div>
        )}

        {uploadedFiles.length > 0 && (
          <div className="file-status">
            📄 **Multi-Document Analysis**: {uploadedFiles.length} files {filesUploaded ? 'ready for comprehensive analysis' : 'being processed...'}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIChat;
