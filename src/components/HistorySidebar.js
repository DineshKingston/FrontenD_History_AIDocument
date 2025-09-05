import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
// import './History.css';

const HistorySidebar = ({ isOpen, onToggle, user, onNewChat, onSelectSession, currentSessionId, currentDayKey }) => {
  const [historyData, setHistoryData] = useState({
    sessionsByDay: {},
    statistics: {},
    availableDays: []
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('sessions');
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [expandedDays, setExpandedDays] = useState(new Set());

  // Fetch unified session history
  useEffect(() => {
    if (isOpen && user?.userId) {
      fetchUnifiedSessionHistory();
    }
  }, [isOpen, user?.userId]);

  const fetchUnifiedSessionHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/history/daywise/${user.userId}`);
      const data = await response.json();
      
      if (data.success) {
        setHistoryData({
          sessionsByDay: data.sessionsByDay || {},
          statistics: data.statistics || {},
          availableDays: data.availableDays || []
        });

        // Auto-expand today's unified sessions
        const today = new Date().toISOString().split('T')[0];
        if (data.sessionsByDay[today]) {
          setExpandedDays(prev => new Set([...prev, today]));
        }

        console.log('✅ session history loaded:', Object.keys(data.sessionsByDay).length, 'days');
      }
    } catch (error) {
      console.error('Error fetching unified session history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/history/session/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          sessionType: 'UNIFIED_SESSION' // Always create unified session
        })
      });

      const data = await response.json();
      if (data.success) {
        onNewChat(data.session);
        fetchUnifiedSessionHistory(); // Refresh history
        onToggle(); // Close sidebar
        console.log('✅ New session created:', data.session.id);
      }
    } catch (error) {
      console.error('Error creating new unified session:', error);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this session?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/history/session/${sessionId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        fetchUnifiedSessionHistory(); // Refresh history
        console.log('✅ Old session deleted:', sessionId);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const toggleSessionExpand = (sessionId) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  const toggleDayExpand = (dayKey) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(dayKey)) {
      newExpanded.delete(dayKey);
    } else {
      newExpanded.add(dayKey);
    }
    setExpandedDays(newExpanded);
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      if (!dateString) return 'Unknown date';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const dateStr = date.toDateString();
      const todayStr = today.toDateString();
      const yesterdayStr = yesterday.toDateString();

      if (dateStr === todayStr) return 'Today';
      if (dateStr === yesterdayStr) return 'Yesterday';

      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown date';
    }
  };

  // Format time for display
  const formatTime = (dateString) => {
    try {
      if (!dateString) return '--:--';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '--:--';
      
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '--:--';
    }
  };

  const renderUnifiedSessionsByDay = () => {
    const { sessionsByDay } = historyData;
    
    if (!sessionsByDay || Object.keys(sessionsByDay).length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <h3>No Sessions Yet</h3>
          <p>Start by uploading documents or asking AI questions</p>
          <button onClick={handleNewChat}>Create new Session</button>
        </div>
      );
    }

    return (
      <div className="sessions-list">
        {Object.entries(sessionsByDay).map(([dayKey, sessions]) => (
          <div key={dayKey} className="date-group">
            <div 
              className="date-header"
              onClick={() => toggleDayExpand(dayKey)}
            >
              <span>{formatDate(dayKey)}</span>
              <span className="session-count">({sessions.length} sessions)</span>
              <button className="expand-day-btn">
                {expandedDays.has(dayKey) ? '▼' : '▶'}
              </button>
            </div>
            
            {expandedDays.has(dayKey) && (
              <div className="day-sessions">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
                  >
                    <div
                      className="session-main"
                      onClick={() => onSelectSession(session)}
                    >
                      <div className="session-info">
                        <div className="session-title">
                          🎯 {session.sessionTitle || 'Unified Work Session'}
                        </div>
                        <div className="session-meta">
                          <span className="session-meta-item">
                            <span className="session-meta-icon">📄</span>
                            {session.documentCount || 0} docs
                          </span>
                          <span className="session-meta-item">
                            <span className="session-meta-icon">💬</span>
                            {session.messageCount || 0} messages
                          </span>
                          <span className="session-meta-item">
                            <span className="session-meta-icon">🔍</span>
                            {session.searchCount || 0} searches
                          </span>
                        </div>
                      </div>
                      
                      <div className="session-actions">
                        <button
                          className="expand-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSessionExpand(session.id);
                          }}
                        >
                          {expandedSessions.has(session.id) ? '▼' : '▶'}
                        </button>
                        <button
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {expandedSessions.has(session.id) && (
                      <div className="session-details">
                        <div className="session-type">
                          🎯 History 
                        </div>
                        
                        {session.documentDetails && session.documentDetails.length > 0 && (
                          <div className="doc-list">
                            <h4>📄 Documents ({session.documentDetails.length})</h4>
                            {session.documentDetails.slice(0, 3).map((doc, index) => (
                              <div key={index} className="doc-item">
                                <span className="doc-item-icon">📄</span>
                                {doc.fileName}
                              </div>
                            ))}
                            {session.documentDetails.length > 3 && (
                              <div className="doc-item">
                                <span className="doc-item-icon">➕</span>
                                +{session.documentDetails.length - 3} more documents
                              </div>
                            )}
                          </div>
                        )}

                        {session.searchQueries && session.searchQueries.length > 0 && (
                          <div className="search-list">
                            <h4>🔍 Searches ({session.searchQueries.length})</h4>
                            {session.searchQueries.slice(0, 2).map((search, index) => (
                              <div key={index} className="search-item">
                                <span className="search-item-icon">🔍</span>
                                "{search.query}"
                              </div>
                            ))}
                            {session.searchQueries.length > 2 && (
                              <div className="search-item">
                                <span className="search-item-icon">➕</span>
                                +{session.searchQueries.length - 2} more searches
                              </div>
                            )}
                          </div>
                        )}

                        {session.messages && session.messages.length > 0 && (
                          <div className="message-list">
                            <h4>💬 Recent Messages ({session.messages.length})</h4>
                            {session.messages.slice(-2).map((message, index) => (
                              <div key={index} className="message-preview">
                                <span className={`message-type ${message.type}`}>
                                  {message.type}
                                </span>
                                <span className="message-content">
                                  {message.content.length > 50 
                                    ? message.content.substring(0, 50) + "..."
                                    : message.content}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="history-overlay" onClick={onToggle} />
      <div className={`history-sidebar ${isOpen ? 'open' : 'closed'}`}>
        {/* Header */}
        <div className="history-header">
          <div className="history-title">
            <h3>🎯 History Sessions</h3>
            <button className="close-btn" onClick={onToggle}>✕</button>
          </div>
          <button className="new-chat-btn" onClick={handleNewChat}>
            ➕ New Document Session
          </button>
        </div>

        {/* Stats */}
        <div className="history-stats">
          <div className="stat-item">
            <span className="stat-value">{historyData.statistics.unifiedSessions || 0}</span>
            <span className="stat-label">Sessions</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{historyData.statistics.totalDocuments || 0}</span>
            <span className="stat-label">Documents</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{historyData.statistics.totalMessages || 0}</span>
            <span className="stat-label">AI Messages</span>
          </div>
        </div>

        {/* Content */}
        <div className="history-content">
          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading sessions...</p>
            </div>
          ) : (
            renderUnifiedSessionsByDay()
          )}
        </div>
      </div>
    </>
  );
};

export default HistorySidebar;
