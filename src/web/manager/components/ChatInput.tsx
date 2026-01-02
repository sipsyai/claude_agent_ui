/**
 * ChatInput Component
 *
 * A comprehensive chat input component that handles message composition, file attachments,
 * and keyboard shortcuts. Features auto-resizing textarea, attachment previews, and
 * validation for file uploads.
 *
 * ## Features
 * - Auto-resizing textarea (48px min, 200px max)
 * - File attachment support (images, PDFs, text files)
 * - File validation (type checking, size limit 10MB)
 * - Attachment preview with icons and remove functionality
 * - Keyboard shortcuts (Enter to send, Shift+Enter for new line)
 * - Disabled states when input is empty or files are uploading
 * - Base64 encoding for file attachments
 * - Visual upload feedback with loading states
 *
 * ## Input Handling
 * The component uses controlled state for the message text:
 * - `message` state tracks textarea value
 * - `handleTextareaChange` updates state and auto-resizes textarea
 * - Textarea height grows with content up to 200px, then scrolls
 * - Height calculation uses scrollHeight for smooth resizing
 *
 * ## Submit Behavior
 * Messages can be sent when:
 * - Text is not empty (after trimming), OR
 * - At least one attachment is present
 *
 * When submitted via `handleSend`:
 * 1. Validates that message or attachments exist
 * 2. Calls `onSendMessage` callback with message text and attachments array
 * 3. Resets message state to empty string
 * 4. Clears attachments array
 * 5. Resets textarea height to auto (collapses to minimum)
 *
 * ## Keyboard Shortcuts
 * - **Enter**: Send message (prevented when holding Shift)
 * - **Shift+Enter**: Insert new line in message (default browser behavior)
 *
 * Keyboard handling is implemented in `handleKeyDown`:
 * - Detects Enter key press without Shift modifier
 * - Prevents default Enter behavior (prevents form submission or newline)
 * - Triggers `handleSend` to submit message
 *
 * ## File Attachments
 * The component supports three file types:
 * - **Images**: Any mime type starting with `image/` (PNG, JPEG, GIF, etc.)
 * - **PDFs**: `application/pdf`
 * - **Text files**: Any mime type starting with `text/` (plain text, CSV, etc.)
 *
 * File handling workflow in `handleFileSelect`:
 * 1. Validates file type (rejects unsupported types with alert)
 * 2. Validates file size (max 10MB, rejects larger files with alert)
 * 3. Converts file to base64 using `fileToBase64` helper
 * 4. Creates `ChatAttachment` object with name, mimeType, and data
 * 5. Appends to attachments array (supports multiple files)
 * 6. Shows uploading state while processing
 * 7. Resets file input after processing
 *
 * Attachment previews show:
 * - Icon based on file type (blue for images, red for PDFs, gray for text)
 * - File name (truncated if too long)
 * - File mime type
 * - Remove button (X icon) on hover
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS with:
 * - **Container**: Padding p-4 around entire component
 * - **Attachments preview**: Flex wrap with gap-2, shown only when attachments exist
 * - **Attachment cards**: Gray background, rounded corners, flex layout with icon, info, and remove button
 * - **Input area**: Flex layout with items-end alignment for buttons and textarea
 * - **Textarea**: Full width, border with focus ring (blue-500), auto-resizing with constraints
 * - **Buttons**: Use Button component with variants (secondary for attach, primary for send)
 * - **Hint text**: Small gray text with kbd elements for keyboard shortcuts
 *
 * The textarea styling includes:
 * - Border: `border-gray-300` with `focus:ring-blue-500`
 * - Resize: Disabled with `resize-none` (auto-resize via JS instead)
 * - Min/max height: Enforced via inline styles (48px-200px)
 * - Placeholder: Hints at Shift+Enter shortcut
 *
 * @example
 * // Basic usage with message handler
 * function ChatPanel() {
 *   const handleSendMessage = (message: string, attachments: ChatAttachment[]) => {
 *     console.log('Message:', message);
 *     console.log('Attachments:', attachments.length);
 *     // Send to backend API or append to message list
 *   };
 *
 *   return <ChatInput onSendMessage={handleSendMessage} />;
 * }
 *
 * @example
 * // Integration with chat state management
 * function ChatContainer() {
 *   const [messages, setMessages] = useState<Message[]>([]);
 *
 *   const handleSend = (text: string, files: ChatAttachment[]) => {
 *     const newMessage = {
 *       id: Date.now(),
 *       role: 'user',
 *       content: text,
 *       attachments: files,
 *       timestamp: new Date(),
 *     };
 *     setMessages(prev => [...prev, newMessage]);
 *   };
 *
 *   return (
 *     <div>
 *       <MessageList messages={messages} />
 *       <ChatInput onSendMessage={handleSend} />
 *     </div>
 *   );
 * }
 *
 * @example
 * // With API integration and error handling
 * function ApiChat() {
 *   const sendToApi = async (message: string, attachments: ChatAttachment[]) => {
 *     try {
 *       const response = await fetch('/api/chat/send', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({ message, attachments }),
 *       });
 *       if (!response.ok) throw new Error('Failed to send');
 *       const data = await response.json();
 *       console.log('Message sent:', data.id);
 *     } catch (error) {
 *       console.error('Send error:', error);
 *       alert('Failed to send message');
 *     }
 *   };
 *
 *   return <ChatInput onSendMessage={sendToApi} />;
 * }
 *
 * @example
 * // With custom file size and type restrictions
 * function RestrictedChat() {
 *   const handleSend = (message: string, attachments: ChatAttachment[]) => {
 *     // Attachments are already validated by ChatInput:
 *     // - Only images, PDFs, and text files
 *     // - Max 10MB per file
 *     // - Base64 encoded in attachment.data
 *     processMessage(message, attachments);
 *   };
 *
 *   return <ChatInput onSendMessage={handleSend} />;
 * }
 */

import React, { useState, useRef } from 'react';
import type { ChatAttachment } from '../services/chat-api';
import { fileToBase64 } from '../services/chat-api';
import { Button } from './ui/Button';
import { PaperclipIcon, XCircleIcon, SendIcon } from './ui/Icons';

/**
 * Props for the ChatInput component
 */
interface ChatInputProps {
  /**
   * Callback function invoked when a message is sent.
   *
   * Called when:
   * - User presses Enter (without Shift)
   * - User clicks the Send button
   *
   * Only called if message text is non-empty (after trimming) OR attachments array is non-empty.
   *
   * @param message - The message text from the textarea (may be empty if only attachments)
   * @param attachments - Array of file attachments with base64-encoded data
   *
   * @example
   * const handleSend = (msg: string, files: ChatAttachment[]) => {
   *   console.log('Text:', msg);
   *   console.log('Files:', files.map(f => f.name));
   * };
   */
  onSendMessage: (message: string, attachments: ChatAttachment[]) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Handles file selection from the file input.
   *
   * Workflow:
   * 1. Sets uploading state to true (disables attach button)
   * 2. Iterates through selected files
   * 3. Validates each file type (images, PDFs, text files only)
   * 4. Validates each file size (max 10MB)
   * 5. Converts valid files to base64 using fileToBase64 helper
   * 6. Creates ChatAttachment objects with name, mimeType, and base64 data
   * 7. Appends new attachments to existing array
   * 8. Resets file input value to allow re-selecting same file
   * 9. Sets uploading state to false
   *
   * Invalid files are skipped with an alert message. If all files are invalid,
   * the attachments array remains unchanged.
   *
   * @param e - File input change event
   * @internal
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const newAttachments: ChatAttachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        const isImage = file.type.startsWith('image/');
        const isPDF = file.type === 'application/pdf';
        const isText = file.type.startsWith('text/');

        if (!isImage && !isPDF && !isText) {
          alert(`File type not supported: ${file.type}`);
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert(`File too large: ${file.name} (max 10MB)`);
          continue;
        }

        // Convert to base64
        const base64 = await fileToBase64(file);

        newAttachments.push({
          name: file.name,
          mimeType: file.type,
          data: base64,
        });
      }

      setAttachments(prev => [...prev, ...newAttachments]);
    } catch (error) {
      console.error('Failed to process files:', error);
      alert('Failed to upload files');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Removes an attachment from the attachments array by index.
   *
   * Creates a new array with the attachment at the specified index filtered out.
   * Does not mutate the original attachments array.
   *
   * @param index - Zero-based index of the attachment to remove
   * @internal
   */
  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Sends the message and attachments via the onSendMessage callback.
   *
   * Validation:
   * - Returns early if message is empty (after trimming) AND no attachments exist
   *
   * Actions on successful send:
   * 1. Invokes onSendMessage callback with message text and attachments array
   * 2. Clears message state (empty string)
   * 3. Clears attachments array (empty array)
   * 4. Resets textarea height to 'auto' (collapses to minimum height)
   *
   * Called by:
   * - handleKeyDown when Enter is pressed (without Shift)
   * - Send button onClick event
   *
   * @internal
   */
  const handleSend = () => {
    if (!message.trim() && attachments.length === 0) return;

    onSendMessage(message, attachments);

    // Reset form
    setMessage('');
    setAttachments([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  /**
   * Handles keyboard events in the textarea for keyboard shortcuts.
   *
   * Keyboard shortcuts:
   * - **Enter** (without Shift): Sends the message
   *   - Prevents default behavior (newline insertion)
   *   - Calls handleSend to submit message
   * - **Shift+Enter**: Inserts newline (default browser behavior, not prevented)
   *
   * @param e - Keyboard event from textarea
   * @internal
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * Handles textarea value changes and auto-resizing.
   *
   * Actions:
   * 1. Updates message state with new textarea value
   * 2. Resets textarea height to 'auto' to calculate new scrollHeight
   * 3. Sets textarea height to scrollHeight (content height) capped at 200px max
   *
   * Auto-resize behavior:
   * - Min height: 48px (enforced via inline style in JSX)
   * - Max height: 200px (enforced by Math.min)
   * - Grows smoothly as user types
   * - Shrinks when content is deleted
   * - Scrolls vertically when content exceeds 200px
   *
   * @param e - Textarea change event
   * @internal
   */
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  return (
    <div className="p-4">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className="relative group bg-gray-100 rounded-lg p-2 flex items-center gap-2 max-w-xs"
            >
              {/* File Icon */}
              <div className="flex-shrink-0">
                {attachment.mimeType.startsWith('image/') ? (
                  <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center text-blue-600">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : attachment.mimeType === 'application/pdf' ? (
                  <div className="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-red-600">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center text-gray-600">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {attachment.name}
                </p>
                <p className="text-xs text-gray-500">
                  {attachment.mimeType}
                </p>
              </div>

              {/* Remove Button */}
              <button
                onClick={() => handleRemoveAttachment(index)}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="Remove"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2">
        {/* File Upload Button */}
        <div className="flex-shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,text/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="secondary"
            size="md"
            disabled={uploading}
            title="Attach files (images, PDFs, text)"
          >
            <PaperclipIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Textarea */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
            style={{ minHeight: '48px', maxHeight: '200px' }}
          />
        </div>

        {/* Send Button */}
        <div className="flex-shrink-0">
          <Button
            onClick={handleSend}
            variant="primary"
            size="md"
            disabled={!message.trim() && attachments.length === 0}
            title="Send message (Enter)"
          >
            <SendIcon className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Hint */}
      <div className="mt-2 text-xs text-gray-500">
        Press <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">Enter</kbd> to send,
        <kbd className="ml-1 px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">Shift+Enter</kbd> for new line
      </div>
    </div>
  );
};

ChatInput.displayName = 'ChatInput';

export default ChatInput;
