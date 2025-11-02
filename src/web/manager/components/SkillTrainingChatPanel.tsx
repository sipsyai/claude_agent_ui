import React, { useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { XCircleIcon, SparklesIcon, CheckCircleIcon, ExclamationCircleIcon, PlayIcon } from './ui/Icons';
import ReactMarkdown from 'react-markdown';
import { useSkillTraining } from '../hooks/useSkillTraining';
import { ProgressBar } from './ui/ProgressBar';

interface Skill {
  id: string;
  name: string;
  description: string;
  experienceScore?: number;
}

interface SkillTrainingChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  skill: Skill | null;
  directory?: string;
  onTrainingComplete?: () => void;
}

const SkillTrainingChatPanel: React.FC<SkillTrainingChatPanelProps> = ({
  isOpen,
  onClose,
  skill,
  directory,
  onTrainingComplete,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = React.useState('');

  const {
    messages,
    trainingStatus,
    isProcessing,
    error,
    startTraining,
    sendMessage,
    reset
  } = useSkillTraining({
    skillId: skill?.id || '',
    directory,
    onTrainingComplete: (oldScore, newScore) => {
      console.log('[Training] Completed:', { oldScore, newScore });
      if (onTrainingComplete) {
        onTrainingComplete();
      }
    },
    onError: (err) => {
      console.error('[Training] Error:', err);
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClose = () => {
    onClose();
    // Reset state after animation
    setTimeout(() => {
      reset();
      setInputValue('');
    }, 300);
  };

  const handleStartTraining = () => {
    startTraining();
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;
    const content = inputValue;
    setInputValue('');
    try {
      await sendMessage(content);
    } catch (error) {
      console.error('[Training] Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen || !skill) return null;

  // Status label
  const getStatusLabel = () => {
    switch (trainingStatus.status) {
      case 'idle':
        return 'Ready to train';
      case 'starting':
        return 'Initializing...';
      case 'analyzing':
        return 'Analyzing skill...';
      case 'training':
        return 'Executing skill...';
      case 'evaluating':
        return 'Evaluating results...';
      case 'updating':
        return 'Updating skill...';
      case 'completed':
        return 'Training completed!';
      case 'error':
        return 'Training failed';
      default:
        return 'Training...';
    }
  };

  // Status icon
  const getStatusIcon = () => {
    if (trainingStatus.status === 'completed') {
      return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
    }
    if (trainingStatus.status === 'error') {
      return <ExclamationCircleIcon className="h-5 w-5 text-red-600" />;
    }
    if (isProcessing) {
      return (
        <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      );
    }
    return <SparklesIcon className="h-5 w-5 text-purple-600" />;
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Slide-in Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-[700px] bg-background border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <h2 className="text-lg font-semibold text-foreground">Training: {skill.name}</h2>
              <p className="text-sm text-muted-foreground">{getStatusLabel()}</p>
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

        {/* Skill Info */}
        <div className="p-4 border-b border-border bg-background">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground mb-2">{skill.description}</p>
            </div>
            <ProgressBar
              value={trainingStatus.newScore !== undefined ? trainingStatus.newScore : skill.experienceScore || 0}
              showLabel={true}
              size="md"
            />
            {trainingStatus.newScore !== undefined && trainingStatus.newScore !== trainingStatus.currentScore && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Score updated:</span>
                <span className="font-medium text-foreground">
                  {trainingStatus.currentScore}% → {trainingStatus.newScore}%
                </span>
                <span className="text-green-600 font-medium">
                  (+{trainingStatus.newScore - trainingStatus.currentScore}%)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(100vh-280px)]">
          {messages.length === 0 && trainingStatus.status === 'idle' && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <SparklesIcon className="h-16 w-16 text-purple-300" />
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Ready to Train</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  The Training Agent will analyze this skill, execute it, evaluate the results, and update the documentation and experience score.
                </p>
              </div>
              <Button onClick={handleStartTraining} size="lg" className="gap-2">
                <PlayIcon className="h-5 w-5" />
                Start Training
              </Button>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-4'
                    : message.role === 'system'
                    ? `border ${
                        message.type === 'error'
                          ? 'border-red-200 bg-red-50 text-red-900'
                          : message.type === 'success'
                          ? 'border-green-200 bg-green-50 text-green-900'
                          : message.type === 'warning'
                          ? 'border-yellow-200 bg-yellow-50 text-yellow-900'
                          : 'border-blue-200 bg-blue-50 text-blue-900'
                      }`
                    : 'bg-muted text-foreground mr-4'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
                <span className="text-xs opacity-70 mt-1 block">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}

          {isProcessing && messages.length > 0 && trainingStatus.status !== 'completed' && (
            <div className="flex justify-start">
              <div className="bg-muted text-foreground rounded-lg p-3 max-w-[85%]">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-background">
          {trainingStatus.status === 'completed' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircleIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Training completed successfully!</span>
              </div>
              <Button onClick={handleClose}>Close</Button>
            </div>
          ) : trainingStatus.status === 'error' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <ExclamationCircleIcon className="h-5 w-5" />
                <span className="text-sm font-medium">
                  {error?.message || 'Training failed'}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => reset()}>
                  Reset
                </Button>
                <Button onClick={handleClose}>Close</Button>
              </div>
            </div>
          ) : trainingStatus.status === 'idle' ? (
            <div className="flex justify-center">
              <Button onClick={handleStartTraining} disabled={isProcessing} size="lg" className="gap-2">
                <PlayIcon className="h-5 w-5" />
                Start Training
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-600">
                <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">{getStatusLabel()}</span>
              </div>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Respond to training agent..."
                  disabled={isProcessing}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isProcessing}>
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SkillTrainingChatPanel;
