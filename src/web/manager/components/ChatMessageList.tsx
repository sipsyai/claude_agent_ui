/**
 * ChatMessageList Component
 *
 * A comprehensive chat message list component that displays chat messages with role-based
 * styling, automatic scrolling, attachment previews, and metadata display (tool uses, cost,
 * token usage). Handles empty and loading states gracefully.
 *
 * ## Features
 * - Auto-scroll to bottom when new messages arrive (smooth scrolling)
 * - Role-based message styling (user, assistant, system)
 * - Attachment previews (images, PDFs, generic files)
 * - Tool use display with formatted JSON input
 * - Cost and token usage metadata display
 * - Loading and empty state handling
 * - Responsive layout with overflow scrolling
 * - Timestamp display in local time format
 *
 * ## Message Rendering
 * The component renders three types of messages based on role:
 *
 * **User Messages**:
 * - Aligned to the right (justify-end)
 * - Blue background (bg-blue-600)
 * - White text (text-white)
 * - Label: "You"
 * - Timestamp on the right
 *
 * **Assistant Messages**:
 * - Aligned to the left (justify-start)
 * - White background (bg-white) with border
 * - Dark text (text-gray-900)
 * - Label: "Assistant"
 * - Timestamp on the left
 * - May include tool uses and cost/usage metadata
 *
 * **System Messages**:
 * - Centered alignment (justify-center)
 * - Small pill-shaped badge (rounded-full)
 * - Gray background (bg-gray-100)
 * - Gray text (text-gray-600)
 * - Small font size (text-xs)
 * - No header or metadata
 *
 * Each message includes:
 * - **Header**: Role label and timestamp (except system messages)
 * - **Attachments**: File previews displayed above content (if present)
 * - **Content**: Message text with whitespace preservation (whitespace-pre-wrap)
 * - **Tool Uses**: Expandable tool use display with name and JSON input (if present in metadata)
 * - **Cost**: Message cost in dollars (if present in metadata)
 * - **Usage**: Input/output token counts (if present in metadata)
 *
 * ## Scroll Behavior
 * The component implements automatic scrolling to keep the latest message visible:
 *
 * **Auto-scroll Mechanism**:
 * - Uses a ref (`messagesEndRef`) positioned at the bottom of the message list
 * - `useEffect` hook monitors changes to the `messages` array
 * - When messages change (new message added, message updated):
 *   1. Triggers `scrollIntoView` on the bottom ref
 *   2. Uses `behavior: 'smooth'` for animated scrolling
 *   3. Scrolls the viewport to bring the ref into view
 *
 * **Overflow Handling**:
 * - Container uses `overflow-y-auto` to enable vertical scrolling
 * - Container takes full height (`h-full`) of parent
 * - Messages are spaced with `space-y-4` (1rem gap between messages)
 * - Padding `p-4` provides comfortable margins
 *
 * The auto-scroll ensures users always see the latest message without manual scrolling,
 * improving UX in active conversations.
 *
 * ## Message Types
 * Messages use the `ChatMessage` interface from chat-api:
 *
 * **ChatMessage Properties**:
 * - `id`: Database ID (number)
 * - `documentId`: Unique string identifier
 * - `role`: Message role - 'user' | 'assistant' | 'system'
 * - `content`: Message text content (string)
 * - `timestamp`: ISO 8601 timestamp string
 * - `attachments`: Optional array of file attachments
 *   - Each attachment has: documentId, name, url, mime, size
 * - `metadata`: Optional object with:
 *   - `toolUses`: Array of tool invocations with name and input
 *   - `cost`: Message cost in dollars (number)
 *   - `usage`: Token usage object with input_tokens, output_tokens, cache tokens
 *   - `duration`: Message processing duration (number)
 *
 * **Attachment Structure**:
 * - `documentId`: Unique identifier
 * - `name`: Original filename
 * - `url`: Accessible URL for download/preview
 * - `mime`: MIME type (e.g., 'image/png', 'application/pdf')
 * - `size`: File size in bytes
 *
 * **Tool Use Structure** (in metadata):
 * - `name`: Tool name (e.g., 'Read', 'Write', 'Bash')
 * - `input`: Tool input parameters (object)
 * - Additional properties may be present
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS with:
 * - **Container**: Full height (`h-full`), vertical overflow (`overflow-y-auto`), padding (`p-4`), vertical spacing (`space-y-4`)
 * - **Loading state**: Centered flex container with gray text
 * - **Empty state**: Centered flex container with multi-line gray text
 * - **User messages**: Right-aligned, blue background, white text, max-width 3xl
 * - **Assistant messages**: Left-aligned, white background with border, dark text, max-width 3xl
 * - **System messages**: Centered, pill-shaped, gray badge with small text
 * - **Attachments**: Display above message content with margin-bottom
 * - **Tool uses**: Border-top separator, gray background, code formatting
 * - **Metadata**: Small text with reduced opacity (70%)
 *
 * @example
 * // Basic usage with message array
 * function ChatContainer() {
 *   const [messages, setMessages] = useState<ChatMessage[]>([]);
 *   const [loading, setLoading] = useState(true);
 *
 *   useEffect(() => {
 *     fetchMessages().then(msgs => {
 *       setMessages(msgs);
 *       setLoading(false);
 *     });
 *   }, []);
 *
 *   return <ChatMessageList messages={messages} loading={loading} />;
 * }
 *
 * @example
 * // With real-time message updates
 * function LiveChat() {
 *   const [messages, setMessages] = useState<ChatMessage[]>([]);
 *
 *   const handleNewMessage = (msg: ChatMessage) => {
 *     setMessages(prev => [...prev, msg]);
 *     // Auto-scroll will trigger automatically
 *   };
 *
 *   return (
 *     <div className="h-screen flex flex-col">
 *       <div className="flex-1">
 *         <ChatMessageList messages={messages} loading={false} />
 *       </div>
 *       <ChatInput onSend={handleNewMessage} />
 *     </div>
 *   );
 * }
 *
 * @example
 * // With loading and empty states
 * function ChatView({ sessionId }: { sessionId: string }) {
 *   const { messages, loading } = useChatSession(sessionId);
 *
 *   // Component automatically handles:
 *   // - loading=true: Shows "Loading messages..." centered
 *   // - messages.length=0: Shows "No messages yet" with hint
 *   // - messages.length>0: Renders message list with auto-scroll
 *
 *   return <ChatMessageList messages={messages} loading={loading} />;
 * }
 *
 * @example
 * // With message metadata display
 * function DetailedChat() {
 *   const messages: ChatMessage[] = [
 *     {
 *       id: 1,
 *       documentId: 'msg_1',
 *       role: 'user',
 *       content: 'Read the config file',
 *       timestamp: new Date().toISOString(),
 *       createdAt: new Date().toISOString(),
 *       updatedAt: new Date().toISOString(),
 *     },
 *     {
 *       id: 2,
 *       documentId: 'msg_2',
 *       role: 'assistant',
 *       content: 'Here are the contents...',
 *       timestamp: new Date().toISOString(),
 *       createdAt: new Date().toISOString(),
 *       updatedAt: new Date().toISOString(),
 *       metadata: {
 *         toolUses: [{ name: 'Read', input: { file_path: './config.json' } }],
 *         cost: 0.0025,
 *         usage: { input_tokens: 150, output_tokens: 300 },
 *       },
 *     },
 *   ];
 *
 *   // Tool uses, cost, and usage will be automatically displayed
 *   return <ChatMessageList messages={messages} loading={false} />;
 * }
 */

import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../services/chat-api';

/**
 * Props for the ChatMessageList component
 */
interface ChatMessageListProps {
  /**
   * Array of chat messages to display.
   *
   * Messages are rendered in array order (oldest to newest).
   * Each message must have a unique documentId for React keys.
   *
   * Auto-scroll triggers when this array changes (new message added or message updated).
   *
   * @see ChatMessage for the message structure
   */
  messages: ChatMessage[];

  /**
   * Loading state for the message list.
   *
   * When true:
   * - Displays centered "Loading messages..." text
   * - Hides message list and empty state
   *
   * When false:
   * - Shows message list if messages.length > 0
   * - Shows empty state if messages.length === 0
   */
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

/**
 * Props for the MessageBubble component
 */
interface MessageBubbleProps {
  /**
   * The chat message to render.
   *
   * Used to determine:
   * - Message role (user, assistant, system) for styling
   * - Message content for display
   * - Timestamp for header
   * - Attachments for preview rendering
   * - Metadata for tool uses, cost, and usage display
   */
  message: ChatMessage;
}

/**
 * MessageBubble Component
 *
 * Renders an individual chat message with role-based styling and layout.
 * Displays message header, content, attachments, tool uses, and metadata.
 *
 * ## Message Role Styling
 * - **User messages**: Right-aligned, blue background, white text
 * - **Assistant messages**: Left-aligned, white background with border, dark text
 * - **System messages**: Centered, pill-shaped badge with gray styling
 *
 * ## Content Structure
 * For user and assistant messages:
 * 1. Message Header: Role label ("You" or "Assistant") + timestamp
 * 2. Attachments: File previews (if present)
 * 3. Content: Message text with whitespace preservation
 * 4. Tool Uses: Collapsible tool use display (if present)
 * 5. Cost: Cost in dollars (if present)
 * 6. Usage: Token counts (if present)
 *
 * For system messages:
 * - Only message content in small pill-shaped badge
 * - No header, attachments, or metadata
 *
 * ## Styling Behavior
 * - **Container**: Flex layout with role-based justification
 * - **Max width**: 3xl (48rem) to prevent overly wide messages
 * - **Header**: Small text with role and timestamp
 * - **Content bubble**: Rounded corners (rounded-lg), padding (px-4 py-3)
 * - **Attachments**: Margin-bottom spacing from content
 * - **Tool uses**: Border-top separator, gray background, code formatting
 * - **Metadata**: Small text with reduced opacity
 *
 * @internal
 */
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

/**
 * Props for the AttachmentPreview component
 */
interface AttachmentPreviewProps {
  /**
   * The file attachment to preview.
   *
   * Contains:
   * - `documentId`: Unique identifier for the attachment
   * - `name`: Original filename for display
   * - `url`: Accessible URL for download/preview
   * - `mime`: MIME type to determine rendering approach
   * - `size`: File size in bytes for display
   */
  attachment: {
    documentId: string;
    name: string;
    url: string;
    mime: string;
    size: number;
  };

  /**
   * Whether the attachment belongs to a user message.
   *
   * Determines styling:
   * - User attachments: Blue background, lighter text colors
   * - Assistant attachments: Gray background, darker text colors
   */
  isUser: boolean;
}

/**
 * AttachmentPreview Component
 *
 * Renders a file attachment preview based on its MIME type.
 * Supports images (inline preview), PDFs (download card), and generic files (download card).
 *
 * ## Rendering Modes
 * The component renders differently based on MIME type:
 *
 * **Image Attachments** (mime starts with 'image/'):
 * - Displays inline image preview with <img> tag
 * - Image is constrained: max-w-full, max-h-64, object-contain
 * - Rounded overflow container
 * - Filename shown below image
 * - Text color adapts to parent (blue-100 for user, gray-500 for assistant)
 *
 * **PDF Attachments** (mime is 'application/pdf'):
 * - Clickable download card with file icon
 * - Opens in new tab (target="_blank", rel="noopener noreferrer")
 * - Shows PDF icon (document icon)
 * - Displays filename (truncated if too long)
 * - Shows file size in KB
 * - Background color adapts (blue-500 for user, gray-100 for assistant)
 * - Hover effect (darker background)
 *
 * **Generic File Attachments** (other MIME types):
 * - Clickable download card with attachment icon
 * - Opens in new tab (target="_blank", rel="noopener noreferrer")
 * - Shows generic attachment icon (paperclip)
 * - Displays filename (truncated if too long)
 * - Shows file size in KB
 * - Background color adapts (blue-500 for user, gray-100 for assistant)
 * - Hover effect (darker background)
 *
 * ## File Size Display
 * File size is converted from bytes to kilobytes:
 * - Divides size by 1024
 * - Formats with 1 decimal place (toFixed(1))
 * - Appends " KB" unit
 *
 * ## Styling Behavior
 * - **Images**: Rounded container, constrained dimensions, responsive sizing
 * - **Download cards**: Flex layout with icon, filename, and size
 * - **User files**: Blue background (bg-blue-500), blue text for images (text-blue-100)
 * - **Assistant files**: Gray background (bg-gray-100), gray text for images (text-gray-500)
 * - **Hover**: Background darkens (hover:bg-blue-400 or hover:bg-gray-200)
 * - **Icons**: 5x5 size (w-5 h-5), filled with currentColor
 * - **Filename**: Truncated with ellipsis if too long (truncate class)
 * - **File size**: Small text (text-xs) with reduced opacity (opacity-75)
 *
 * @internal
 */
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

ChatMessageList.displayName = 'ChatMessageList';
MessageBubble.displayName = 'MessageBubble';
AttachmentPreview.displayName = 'AttachmentPreview';

export default ChatMessageList;
