import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { XCircleIcon, SparklesIcon, CheckCircleIcon, ExclamationCircleIcon } from './ui/Icons';
import ReactMarkdown from 'react-markdown';
import { useSkillCreator } from '../hooks/useSkillCreator';

interface SkillCreatorChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSkillCreated?: () => void;
  directory?: string;
}

type PanelState = 'chat' | 'creating' | 'success' | 'error';

const SkillCreatorChatPanel: React.FC<SkillCreatorChatPanelProps> = ({
  isOpen,
  onClose,
  onSkillCreated,
  directory,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [panelState, setPanelState] = useState<PanelState>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use the skill creator hook
  const {
    messages,
    isProcessing,
    isCreating,
    createdSkillName,
    error,
    startConversation,
    sendMessage,
    reset
  } = useSkillCreator({
    directory,
    onSkillCreated: (skillName) => {
      setPanelState('success');
      if (onSkillCreated) {
        onSkillCreated();
      }
    },
    onError: (err) => {
      setPanelState('error');
      console.error('Skill creation error:', err);
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && panelState === 'chat') {
      // Delay to ensure panel animation completes
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen, panelState]);

  // Start conversation when panel opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      startConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, messages.length]);

  // Update panel state based on creation status
  useEffect(() => {
    if (isCreating) {
      setPanelState('creating');
    } else if (createdSkillName) {
      setPanelState('success');
    } else if (error) {
      setPanelState('error');
    } else if (messages.length > 0) {
      setPanelState('chat');
    }
  }, [isCreating, createdSkillName, error, messages.length]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const content = inputValue;
    setInputValue('');

    try {
      await sendMessage(content);
    } catch (error) {
      console.error('Failed to send message:', error);
      setPanelState('error');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClose = () => {
    onClose();
    // Reset state after animation
    setTimeout(() => {
      reset();
      setPanelState('chat');
      setInputValue('');
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Slide-in Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-[600px] bg-background border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-3">
            <SparklesIcon className="h-6 w-6 text-purple-600" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Create with Claude Manager</h2>
              <p className="text-sm text-muted-foreground">Interactive skill creation assistant</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-background/50"
            aria-label="Close panel"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex flex-col h-[calc(100%-73px)]">
          {panelState === 'chat' && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground border border-border'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
                      <div
                        className={`text-xs mt-2 ${
                          message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}

                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground border border-border rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm text-muted-foreground">Claude is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-border p-4 bg-background">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your response..."
                    disabled={isProcessing}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isProcessing}
                    className="px-6"
                  >
                    Send
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </>
          )}

          {panelState === 'creating' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <h3 className="text-xl font-semibold">Creating Your Skill</h3>
                <p className="text-muted-foreground">
                  Claude is writing the skill file...
                </p>
              </div>
            </div>
          )}

          {panelState === 'success' && createdSkillName && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="text-center space-y-4">
                <CheckCircleIcon className="w-20 h-20 text-green-600 mx-auto" />
                <h3 className="text-2xl font-bold text-green-600">Skill Created Successfully!</h3>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md">
                  <p className="text-sm text-green-800 font-medium mb-1">
                    Skill File: .claude/skills/{createdSkillName}/SKILL.md
                  </p>
                  <p className="text-xs text-green-700">
                    Your new skill is ready to use and will automatically activate when needed.
                  </p>
                </div>
                <Button onClick={handleClose} className="mt-4">
                  Close & View Skill
                </Button>
              </div>
            </div>
          )}

          {panelState === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="text-center space-y-4">
                <ExclamationCircleIcon className="w-20 h-20 text-red-600 mx-auto" />
                <h3 className="text-2xl font-bold text-red-600">Something Went Wrong</h3>
                <p className="text-muted-foreground max-w-md">
                  Failed to create the skill. Please try again or create the skill manually.
                </p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button variant="secondary" onClick={handleClose}>
                    Close
                  </Button>
                  <Button onClick={startConversation}>
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SkillCreatorChatPanel;
