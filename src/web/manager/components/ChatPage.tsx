/**
 * Modern Chat Page with assistant-ui integration
 * Features:
 * - Modern minimal design (grey tones)
 * - Markdown rendering with syntax highlighting
 * - File attachments support
 * - SSE streaming with Claude Agent SDK
 */

import React, { useState, useEffect, useRef } from 'react';
import * as chatApi from '../services/chat-api';
import { Button } from './ui/Button';
import { PlusIcon, MessageSquareIcon, ArchiveIcon, TrashIcon } from './ui/Icons';
import ChatSessionModal from './ChatSessionModal';

// assistant-ui imports
import { AssistantRuntimeProvider, ThreadPrimitive } from '@assistant-ui/react';
import { useAssistantRuntime } from '../hooks/useAssistantRuntime';

// Modern components
import { UserMessage, AssistantMessage, SystemMessage } from './MessageBubble';
import ComposerArea from './ComposerArea';

// Chat display context
import { ChatDisplayProvider, useChatDisplay } from '../contexts/ChatDisplayContext';

const ChatPageContent: React.FC = () => {
  const [sessions, setSessions] = useState<chatApi.ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<chatApi.ChatSession | null>(null);
  const [messages, setMessages] = useState<chatApi.ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  // Mode state (initialized from active session)
  const [permissionMode, setPermissionMode] = useState<'default' | 'bypass' | 'auto' | 'plan'>('default');
  // Available agents and skills for runtime selection
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  // Runtime selection (per-message overrides)
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  // Modal state for runtime selection
  const [showAgentSkillModal, setShowAgentSkillModal] = useState(false);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use chat display context
  const { viewMode, setViewMode, setToolUses, setSystemMessages, clearEventData } = useChatDisplay();

  // Get directory from cookies
  const getDirectory = () => {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'selectedDirectory') {
        return decodeURIComponent(value);
      }
    }
    return undefined;
  };

  useEffect(() => {
    loadSessions();
    loadAvailableAgentsAndSkills();
  }, []);

  useEffect(() => {
    if (activeSession) {
      loadMessages(activeSession.documentId);
      // Update permission mode from session (plan mode is now part of permission mode)
      const sessionMode = activeSession.planMode ? 'plan' : (activeSession.permissionMode || 'default');
      setPermissionMode(sessionMode as 'default' | 'bypass' | 'auto' | 'plan');
      // Initialize runtime overrides with session defaults when switching sessions
      setSelectedAgentId(activeSession.agent?.documentId);
      setSelectedSkillIds(activeSession.skills?.map(s => s.documentId) || []);
    }
  }, [activeSession]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await chatApi.getChatSessions();
      // Filter out archived sessions by default
      const activeSessions = data.filter(s => s.status === 'active');
      setSessions(activeSessions);

      // Auto-select first session if exists
      if (activeSessions.length > 0 && !activeSession) {
        setActiveSession(activeSessions[0]);
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      alert('Failed to load chat sessions');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableAgentsAndSkills = async () => {
    try {
      const [agents, skills] = await Promise.all([
        chatApi.getAgents(),
        chatApi.getSkills(),
      ]);
      setAvailableAgents(agents);
      setAvailableSkills(skills);
    } catch (error) {
      console.error('Failed to load agents/skills:', error);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      setMessagesLoading(true);
      const data = await chatApi.getChatMessages(sessionId);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
      alert('Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleNewChat = () => {
    setShowNewChatModal(true);
  };

  const handleChatCreated = (session: chatApi.ChatSession) => {
    setSessions(prev => [session, ...prev]);
    setActiveSession(session);
    setShowNewChatModal(false);
  };

  const handleSelectSession = (session: chatApi.ChatSession) => {
    setActiveSession(session);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this chat session?')) return;

    try {
      await chatApi.deleteChatSession(sessionId);
      setSessions(prev => prev.filter(s => s.documentId !== sessionId));

      // If deleted session was active, select first available
      if (activeSession?.documentId === sessionId) {
        const remaining = sessions.filter(s => s.documentId !== sessionId);
        setActiveSession(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete chat session');
    }
  };

  const handleArchiveSession = async (sessionId: string) => {
    try {
      await chatApi.archiveChatSession(sessionId);
      setSessions(prev => prev.filter(s => s.documentId !== sessionId));

      // If archived session was active, select first available
      if (activeSession?.documentId === sessionId) {
        const remaining = sessions.filter(s => s.documentId !== sessionId);
        setActiveSession(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (error) {
      console.error('Failed to archive session:', error);
      alert('Failed to archive chat session');
    }
  };

  const handleMessagesUpdate = (newMessages: chatApi.ChatMessage[]) => {
    setMessages(newMessages);
    // Refresh sessions to get updated title
    loadSessions();
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Clear SDK event data when switching sessions
  useEffect(() => {
    if (activeSession) {
      clearEventData();
    }
  }, [activeSession?.documentId]);

  // Create assistant-ui runtime using our custom hook
  const runtime = useAssistantRuntime({
    sessionId: activeSession?.documentId || null,
    initialMessages: messages,
    onMessagesUpdate: handleMessagesUpdate,
    permissionMode,
    agentId: selectedAgentId,
    skillIds: selectedSkillIds,
    onToolUseUpdate: setToolUses,
    onSystemMessage: (msg) => {
      setSystemMessages((prev) => [...prev, msg]);
    },
  });

  // Auto-scroll to bottom when messages change (streaming updates)
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-gray-500">Loading chat sessions...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left Sidebar - Chat Sessions */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col shadow-sm">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 bg-gradient-to-b from-gray-800 to-gray-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Chats</h2>
            <Button onClick={handleNewChat} variant="primary" size="sm" className="bg-blue-600 hover:bg-blue-700">
              <PlusIcon className="w-4 h-4 mr-1" />
              New Chat
            </Button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <MessageSquareIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="font-medium">No chat sessions yet</p>
              <p className="text-sm mt-1">Click "New Chat" to start</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {sessions.map(session => (
                <div
                  key={session.documentId}
                  className={`p-4 cursor-pointer hover:bg-gray-700 transition-all ${
                    activeSession?.documentId === session.documentId
                      ? 'bg-gray-700 border-l-4 border-blue-500'
                      : 'border-l-4 border-transparent'
                  }`}
                  onClick={() => handleSelectSession(session)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate text-sm">
                        {session.title}
                      </h3>
                      {session.skills && session.skills.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {session.skills.slice(0, 2).map(skill => (
                            <span
                              key={skill.documentId}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-600 text-gray-200"
                            >
                              {skill.name}
                            </span>
                          ))}
                          {session.skills.length > 2 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">
                              +{session.skills.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="mt-1.5 text-xs text-gray-400">
                        {formatTimeAgo(session.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchiveSession(session.documentId);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-600 rounded transition-colors"
                        title="Archive"
                      >
                        <ArchiveIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.documentId);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-900">
        {activeSession && runtime ? (
          <>
            {/* Chat Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-white">
                    {activeSession.title}
                  </h2>

                  {/* Clickable Agent/Skills Selection Area */}
                  <div
                    className="mt-2 p-3 bg-gray-750 rounded-lg border border-gray-600 hover:border-blue-500 cursor-pointer transition-all hover:bg-gray-700"
                    onClick={() => setShowAgentSkillModal(true)}
                  >
                    {/* Agent Display */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-400">Agent:</span>
                      <span className="text-sm text-gray-200 font-medium">
                        {selectedAgentId
                          ? availableAgents.find(a => a.documentId === selectedAgentId)?.name || 'Unknown'
                          : activeSession.agent?.name || 'Session Default'
                        }
                      </span>
                      {(selectedAgentId
                        ? availableAgents.find(a => a.documentId === selectedAgentId)?.modelConfig?.model
                        : activeSession.agent?.modelConfig?.model
                      ) && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 border border-purple-700/50">
                          {selectedAgentId
                            ? availableAgents.find(a => a.documentId === selectedAgentId)?.modelConfig?.model
                            : activeSession.agent?.modelConfig?.model
                          }
                        </span>
                      )}
                    </div>

                    {/* Skills Display */}
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-gray-400 whitespace-nowrap mt-1">Skills:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSkillIds.length > 0 ? (
                          selectedSkillIds.map(skillId => {
                            const skill = availableSkills.find(s => s.documentId === skillId);
                            return skill ? (
                              <span
                                key={skillId}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white border border-blue-500"
                              >
                                {skill.displayName || skill.name}
                              </span>
                            ) : null;
                          })
                        ) : activeSession.skills && activeSession.skills.length > 0 ? (
                          activeSession.skills.map(skill => (
                            <span
                              key={skill.documentId}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-600 text-gray-200 border border-gray-500"
                            >
                              {skill.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">No skills selected</span>
                        )}
                      </div>
                    </div>

                    {/* Click hint */}
                    <div className="mt-2 text-xs text-gray-500 text-right">
                      Click to change agent/skills for this conversation
                    </div>
                  </div>
                </div>
                {/* Mode Controls */}
                <div className="flex items-center gap-3 ml-4">
                  {/* Permission/Mode Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-400">Mode:</label>
                    <select
                      value={permissionMode}
                      onChange={(e) => setPermissionMode(e.target.value as 'default' | 'bypass' | 'auto' | 'plan')}
                      className="text-xs bg-gray-700 border-gray-600 text-white rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="default">Default</option>
                      <option value="bypass">Bypass</option>
                      <option value="auto">Auto</option>
                      <option value="plan">Plan</option>
                    </select>
                  </div>
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-2 border-l border-gray-600 pl-3">
                    <label className="text-xs font-medium text-gray-400">View:</label>
                    <select
                      value={viewMode}
                      onChange={(e) => setViewMode(e.target.value as 'simple' | 'detailed')}
                      className="text-xs bg-gray-700 border-gray-600 text-white rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="simple">Simple</option>
                      <option value="detailed">Detailed</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Area - Using assistant-ui with modern design */}
            <div className="flex-1 overflow-hidden">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-400">Loading messages...</div>
                </div>
              ) : (
                <AssistantRuntimeProvider runtime={runtime}>
                  <ThreadPrimitive.Root className="h-full flex flex-col">
                    <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-6">
                      {messages.length === 0 && (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center text-gray-400">
                            <MessageSquareIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">Start the conversation</p>
                            <p className="text-sm mt-1">Type a message below to begin</p>
                          </div>
                        </div>
                      )}
                      <ThreadPrimitive.Messages
                        components={{
                          UserMessage,
                          AssistantMessage,
                          SystemMessage,
                        }}
                      />
                      {/* Auto-scroll anchor */}
                      <div ref={messagesEndRef} />
                    </ThreadPrimitive.Viewport>

                    {/* Composer Area */}
                    <ComposerArea />
                  </ThreadPrimitive.Root>
                </AssistantRuntimeProvider>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquareIcon className="w-20 h-20 mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold text-white mb-2">
                No Chat Selected
              </h3>
              <p className="text-gray-400 mb-6 max-w-sm">
                Select a chat from the sidebar or create a new one to start chatting
              </p>
              <Button onClick={handleNewChat} variant="primary" className="bg-blue-600 hover:bg-blue-700">
                <PlusIcon className="w-5 h-5 mr-2" />
                New Chat
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewChatModal && (
        <ChatSessionModal
          isOpen={showNewChatModal}
          onClose={() => setShowNewChatModal(false)}
          onChatCreated={handleChatCreated}
        />
      )}

      {/* Agent/Skills Selection Modal */}
      {showAgentSkillModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-gray-700">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 z-10">
              <h2 className="text-xl font-semibold text-white">Select Agent & Skills</h2>
              <p className="text-sm text-gray-400 mt-1">
                Choose an agent and skills for this conversation (overrides session defaults)
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Agent Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Agent
                </label>
                <select
                  value={selectedAgentId || ''}
                  onChange={(e) => setSelectedAgentId(e.target.value || undefined)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Use Session Default</option>
                  {availableAgents.map(agent => (
                    <option key={agent.documentId} value={agent.documentId}>
                      {agent.name}
                      {agent.modelConfig?.model && ` [${agent.modelConfig.model}]`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Skills Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Skills
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 bg-gray-900 rounded-lg border border-gray-700">
                  {availableSkills.map(skill => (
                    <label
                      key={skill.documentId}
                      className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                        selectedSkillIds.includes(skill.documentId)
                          ? 'bg-blue-600 text-white border-2 border-blue-500'
                          : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSkillIds.includes(skill.documentId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSkillIds([...selectedSkillIds, skill.documentId]);
                          } else {
                            setSelectedSkillIds(selectedSkillIds.filter(id => id !== skill.documentId));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium">
                        {skill.displayName || skill.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-6 flex justify-end gap-3">
              <Button
                onClick={() => setShowAgentSkillModal(false)}
                variant="secondary"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrapper component with ChatDisplayProvider
const ChatPage: React.FC = () => {
  return (
    <ChatDisplayProvider>
      <ChatPageContent />
    </ChatDisplayProvider>
  );
};

export default ChatPage;
