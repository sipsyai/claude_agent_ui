import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../services/chat-api';

interface ChatMessageListProps {
  messages: ChatMessage[];
  loading: boolean;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages, loading }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading messages...</div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">No messages yet</p>
          <p className="text-sm">Start the conversation below</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message.documentId} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Message Header */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs font-medium text-gray-600">
            {isUser ? 'You' : 'Assistant'}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>

        {/* Message Content */}
        <div
          className={`rounded-lg px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 text-gray-900'
          }`}
        >
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-3 space-y-2">
              {message.attachments.map((attachment) => (
                <AttachmentPreview
                  key={attachment.documentId}
                  attachment={attachment}
                  isUser={isUser}
                />
              ))}
            </div>
          )}

          {/* Text Content */}
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>

          {/* Tool Uses */}
          {message.metadata?.toolUses && message.metadata.toolUses.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
              <div className="text-xs font-medium text-gray-600 mb-2">
                Tool Uses:
              </div>
              {message.metadata.toolUses.map((toolUse: any, index: number) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded p-2 text-xs"
                >
                  <div className="font-medium text-gray-700 mb-1">
                    {toolUse.name}
                  </div>
                  {toolUse.input && (
                    <div className="text-gray-600 font-mono text-xs overflow-x-auto">
                      <pre>{JSON.stringify(toolUse.input, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Cost Info */}
          {message.metadata?.cost !== undefined && (
            <div className="mt-2 text-xs opacity-70">
              Cost: ${message.metadata.cost.toFixed(4)}
            </div>
          )}

          {/* Token Usage */}
          {message.metadata?.usage && (
            <div className="mt-1 text-xs opacity-70">
              Tokens: {message.metadata.usage.input_tokens} in / {message.metadata.usage.output_tokens} out
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface AttachmentPreviewProps {
  attachment: {
    documentId: string;
    name: string;
    url: string;
    mime: string;
    size: number;
  };
  isUser: boolean;
}

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachment, isUser }) => {
  const isImage = attachment.mime.startsWith('image/');
  const isPDF = attachment.mime === 'application/pdf';

  if (isImage) {
    return (
      <div className="rounded overflow-hidden">
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-w-full h-auto max-h-64 object-contain"
        />
        <div className={`text-xs mt-1 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
          {attachment.name}
        </div>
      </div>
    );
  }

  if (isPDF) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 p-2 rounded ${
          isUser ? 'bg-blue-500 hover:bg-blue-400' : 'bg-gray-100 hover:bg-gray-200'
        }`}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{attachment.name}</div>
          <div className="text-xs opacity-75">
            {(attachment.size / 1024).toFixed(1)} KB
          </div>
        </div>
      </a>
    );
  }

  // Generic file attachment
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 p-2 rounded ${
        isUser ? 'bg-blue-500 hover:bg-blue-400' : 'bg-gray-100 hover:bg-gray-200'
      }`}
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{attachment.name}</div>
        <div className="text-xs opacity-75">
          {(attachment.size / 1024).toFixed(1)} KB
        </div>
      </div>
    </a>
  );
};

export default ChatMessageList;
