"use client";

import { useEffect, useState, useRef } from "react";
import "./admin.css";

interface ConversationPreview {
  phone_number: string;
  last_message: string;
  updated_at: string;
  mode: "ai" | "human";
  profile_name?: string;
  last_sender?: "user" | "ai" | "admin";
}

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sender?: "user" | "ai" | "admin";
  created_at: string;
}

export default function AdminDashboard() {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeMode, setActiveMode] = useState<"ai" | "human">("ai");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputTextRef = useRef<HTMLTextAreaElement>(null);
  const chatRefreshInterval = useRef<NodeJS.Timeout>();
  const isTogglingMode = useRef(false);
  const previousMessagesLength = useRef(0);

  // Fetch conversation list
  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/admin/conversations", { cache: 'no-store' });
      if (res.ok) {
        const { data } = await res.json();
        setConversations(data);
      }
    } catch (e) {
      console.error("Failed to fetch conversations");
    }
  };

  // Initial load and poll list
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch active chat messages
  const fetchChatMessages = async (phone: string) => {
    try {
      const res = await fetch(`/api/admin/conversations/${phone}`, { cache: 'no-store' });
      if (res.ok) {
        const { data } = await res.json();
        setMessages(data.messages);
        // Only update mode if we haven't optimistic-updated it locally recently
        if (!isTogglingMode.current) {
          setActiveMode(data.mode);
        }
      }
    } catch (e) {
      console.error("Failed to fetch messages");
    }
  };

  // Load chat and setup polling when selected
  useEffect(() => {
    if (activeChat) {
      fetchChatMessages(activeChat);
      if (chatRefreshInterval.current) clearInterval(chatRefreshInterval.current);
      chatRefreshInterval.current = setInterval(() => fetchChatMessages(activeChat), 3000);
    }
    return () => {
      if (chatRefreshInterval.current) clearInterval(chatRefreshInterval.current);
    };
  }, [activeChat]);

  // Handle scroll to show/hide sticky dates
  const handleScroll = () => {
    setIsScrolling(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1500); // Hide after 1.5s of no scrolling
  };

  // Auto scroll to bottom only when new messages arrive
  useEffect(() => {
    if (messages.length > previousMessagesLength.current) {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
    previousMessagesLength.current = messages.length;
  }, [messages]);

  // Toggle Mode
  const handleToggleMode = async (newMode: "ai" | "human") => {
    if (!activeChat || newMode === activeMode) return;
    
    // Optimistic update
    isTogglingMode.current = true;
    setActiveMode(newMode);
    
    // Also optimistically update the sidebar array
    setConversations(prev => prev.map(chat => 
      chat.phone_number === activeChat ? { ...chat, mode: newMode } : chat
    ));
    
    try {
      const res = await fetch("/api/admin/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: activeChat, mode: newMode }),
      });
      
      if (!res.ok) {
        const errData = await res.json();
        console.error("API error response:", errData);
        throw new Error(errData.error || "API error");
      }
      
      fetchConversations(); // refresh list to update dot color
    } catch (e) {
      console.error("Failed to update mode:", e);
      setActiveMode(activeMode); // revert on failure
    } finally {
      setTimeout(() => {
        isTogglingMode.current = false;
      }, 1000);
    }
  };

  // Send Message
  const handleSendMessage = async () => {
    if (!activeChat || !inputText.trim() || activeMode !== "human" || sending) return;

    const messageToSend = inputText.trim();
    setInputText("");
    setSending(true);

    // Optimistic message append
    const tempMsg: Message = {
      role: "assistant",
      content: messageToSend,
      sender: "admin",
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await fetch("/api/admin/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: activeChat, message: messageToSend }),
      });
      if (!res.ok) {
        throw new Error("Send failed");
      }
      fetchConversations(); // refresh preview
    } catch (e) {
      alert("Failed to send message");
      fetchChatMessages(activeChat); // reload real state
    } finally {
      setSending(false);
      // Re-focus input after sending
      if (inputTextRef.current) {
        inputTextRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "";
    }
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { key: string; displayDate: string; messages: Message[] }[] = [];
    msgs.forEach(msg => {
      try {
        const d = new Date(msg.created_at);
        const dateKey = d.toLocaleDateString(); // e.g. "4/22/2026"
        const lastGroup = groups[groups.length - 1];
        
        if (lastGroup && lastGroup.key === dateKey) {
          lastGroup.messages.push(msg);
        } else {
          let displayDate = d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
          const today = new Date().toLocaleDateString();
          const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
          
          if (dateKey === today) displayDate = "TODAY";
          else if (dateKey === yesterday) displayDate = "YESTERDAY";
          
          groups.push({ key: dateKey, displayDate, messages: [msg] });
        }
      } catch {
        groups.push({ key: "unknown", displayDate: "UNKNOWN DATE", messages: [msg] });
      }
    });
    return groups;
  };

  return (
    <div className={`wa-app ${activeChat ? 'chat-active' : ''}`}>
      {/* ── LEFT PANEL ── */}
      <div className="wa-sidebar">
        <header className="wa-header wa-sidebar-header">
          <h1>Admin Dashboard</h1>
        </header>
        <div className="wa-chat-list">
          {conversations.map((chat) => (
            <div 
              key={chat.phone_number} 
              className={`wa-chat-item ${activeChat === chat.phone_number ? 'active' : ''}`}
              onClick={() => setActiveChat(chat.phone_number)}
            >
              <div className="wa-avatar">👤</div>
              <div className="wa-chat-info">
                <div className="wa-chat-row-top">
                  <h3 className="wa-chat-phone">{chat.profile_name || `+${chat.phone_number}`}</h3>
                  <span className="wa-chat-time">{formatTime(chat.updated_at)}</span>
                </div>
                <div className="wa-chat-row-bottom">
                  <p className={`wa-chat-preview ${chat.last_sender === 'user' ? 'pending-reply' : ''}`}>
                    {chat.last_sender !== 'user' && (
                      <span className="wa-sent-tick">✓✓ </span>
                    )}
                    {chat.last_message}
                  </p>
                  <div className={`wa-status-badge ${chat.mode}`}>
                    {chat.mode === 'ai' ? '🤖 AI' : '👤 Manual'}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {conversations.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#8696a0' }}>
              No conversations yet.
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="wa-main">
        {!activeChat ? (
          <div className="wa-empty-state">
            Select a conversation to view
          </div>
        ) : (
          <>
            {/* Header */}
            <header className={`wa-header wa-chat-header ${activeMode === 'human' ? 'human-mode' : ''}`}>
              <div className="wa-chat-header-info">
                <button className="wa-back-btn" onClick={() => setActiveChat(null)}>
                  ←
                </button>
                <div className="wa-avatar">👤</div>
                <div className="wa-chat-header-details">
                  <h2>
                    {conversations.find(c => c.phone_number === activeChat)?.profile_name || `+${activeChat}`}
                  </h2>
                  <p>{activeMode === 'human' ? 'Manual Control Active' : 'AI Handling Chat'}</p>
                </div>
              </div>
              <div className="wa-mode-toggle" onClick={() => handleToggleMode(activeMode === 'ai' ? 'human' : 'ai')}>
                <div className={`wa-toggle-option ${activeMode === 'ai' ? 'active ai' : ''}`}>AI</div>
                <div className={`wa-toggle-option ${activeMode === 'human' ? 'active human' : ''}`}>Human</div>
              </div>
            </header>

            {/* Messages */}
            <div 
              className="wa-messages" 
              ref={messagesContainerRef}
              onScroll={handleScroll}
            >
              {groupMessagesByDate(messages).map((group, groupIndex) => (
                <div key={`date-group-${groupIndex}`} className="wa-date-group">
                  <div className={`wa-date-badge-container ${isScrolling ? 'scrolling' : ''}`}>
                    <div className="wa-date-badge">{group.displayDate}</div>
                  </div>
                  {group.messages.map((msg, i) => (
                    <div key={i} className={`wa-message-wrapper ${msg.role === 'user' ? 'user' : (msg.sender === 'admin' ? 'admin' : 'ai')}`}>
                      <div className="wa-message-bubble">
                        {msg.sender === 'ai' && <div className="wa-message-tag">🤖 Assistant</div>}
                        {msg.sender === 'admin' && <div className="wa-message-tag">👤 You</div>}
                        {msg.content}
                        <span className="wa-message-time">{formatTime(msg.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="wa-input-area">
              <div className="wa-input-wrapper">
                <textarea
                  ref={inputTextRef}
                  placeholder={activeMode === 'ai' ? "AI is handling this — switch to Human to reply manually" : "Type a message..."}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={activeMode === 'ai' || sending}
                  rows={1}
                />
              </div>
              <button 
                className="wa-send-btn" 
                onClick={handleSendMessage}
                disabled={activeMode === 'ai' || sending || !inputText.trim()}
              >
                {sending ? '...' : '➤'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
