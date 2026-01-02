/**
 * ComposerArea Component
 *
 * A sophisticated message composition component built on top of assistant-ui primitives.
 * Handles message input, file attachments, and adaptive send/cancel behavior based on
 * conversation state. Features auto-resizing textarea, attachment previews, and
 * comprehensive file validation.
 *
 * ## Features
 * - Message composition using assistant-ui ComposerPrimitive for seamless integration
 * - Auto-resizing textarea (48px min, 200px max)
 * - File attachment support (images, PDFs, text files)
 * - File validation (type checking, size limit 10MB)
 * - Attachment preview with thumbnails for images, icons for other file types
 * - File removal with memory cleanup (URL.revokeObjectURL)
 * - Adaptive buttons: Send when idle, Cancel when running
 * - Keyboard shortcuts hint (Enter to send, Shift+Enter for new line)
 * - Upload state feedback with disabled buttons during processing
 *
 * ## Message Composition
 * The component integrates with assistant-ui's conversation management:
 * - Uses `ComposerPrimitive.Root` to wrap the composition area
 * - Uses `ComposerPrimitive.Input` for the textarea with auto-resize
 * - Uses `ComposerPrimitive.Send` for message submission
 * - Uses `ComposerPrimitive.Cancel` for stopping ongoing operations
 * - Message text is managed by assistant-ui runtime (not local state)
 * - Auto-resize is implemented via `onInput` handler calculating scrollHeight
 *
 * ## Attachments
 * The component manages file attachments through local state:
 *
 * **Upload Workflow** (`handleFileSelect`):
 * 1. Validates file type (images, PDFs, text files only)
 * 2. Validates file size (max 10MB per file)
 * 3. Creates preview URL for images using `URL.createObjectURL`
 * 4. Categorizes file type for icon selection
 * 5. Appends to `attachments` state array
 * 6. Shows uploading state while processing
 * 7. Resets file input value after processing
 *
 * **Supported File Types**:
 * - **Images**: Any mime type starting with `image/` (PNG, JPEG, GIF, WebP, etc.)
 * - **PDFs**: `application/pdf`
 * - **Text files**: Any mime type starting with `text/` (plain text, CSV, etc.)
 *
 * **Preview Display**:
 * - Images: Thumbnail using object URL (10x10 rounded)
 * - PDFs: Red icon with document SVG
 * - Text files: Blue icon with document SVG
 * - Other: Gray icon with document SVG (fallback)
 *
 * **Removal** (`handleRemoveAttachment`):
 * - Revokes object URL to free memory (for image previews)
 * - Removes attachment from state array by ID
 *
 * ## Send Behavior
 * The component adapts its button based on conversation state using `ThreadPrimitive.If`:
 *
 * **When Idle** (running=false):
 * - Shows **Send button** with blue background and send icon
 * - Clicking sends message via `ComposerPrimitive.Send`
 * - Button is disabled when input is empty (handled by assistant-ui)
 *
 * **When Running** (running=true):
 * - Shows **Cancel button** with red background and X icon
 * - Clicking cancels ongoing operation via `ComposerPrimitive.Cancel`
 * - Useful for stopping long-running agent responses or tool executions
 *
 * ## Auto-Resize Behavior
 * The textarea automatically adjusts height based on content:
 * - Minimum height: 48px (approximately 1 line)
 * - Maximum height: 200px (approximately 7-8 lines)
 * - Resize mechanism: `onInput` handler sets `target.style.height`
 * - Calculation: `Math.min(target.scrollHeight, 200)` ensures max constraint
 * - Overflow: When content exceeds 200px, textarea becomes scrollable
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS with:
 * - **Container**: Dark theme with gray-800 background, gray-700 border-top, p-4 padding
 * - **Attachments preview**: Flex wrap with gap-2, mb-3 margin, shown only when attachments exist
 * - **Attachment cards**: Gray-900 background, rounded-lg, border-gray-700, hover effects
 * - **File icons**: Colored backgrounds (red for PDF, blue for text, gray for others)
 * - **Composer layout**: Flex row with items-end alignment, gap-2 between elements
 * - **Textarea**: Gray-700 background, gray-600 border, blue-500 focus ring, rounded-xl
 * - **Buttons**: Consistent 2.5 padding, rounded-lg, hover effects, disabled states
 * - **Hint**: Small gray text with kbd elements styled like keyboard keys
 *
 * @example
 * // Basic usage in chat interface with assistant-ui runtime
 * import { AssistantRuntimeProvider } from '@assistant-ui/react';
 * import ComposerArea from './ComposerArea';
 *
 * function ChatInterface() {
 *   return (
 *     <AssistantRuntimeProvider runtime={myRuntime}>
 *       <div className="flex flex-col h-screen">
 *         <div className="flex-1 overflow-y-auto">
 *         </div>
 *         <ComposerArea />
 *       </div>
 *     </AssistantRuntimeProvider>
 *   );
 * }
 *
 * @example
 * // Integration with ThreadPrimitive for complete chat UI
 * import { ThreadPrimitive, ComposerPrimitive } from '@assistant-ui/react';
 * import ComposerArea from './ComposerArea';
 *
 * function ChatPanel() {
 *   return (
 *     <ThreadPrimitive.Root>
 *       <ThreadPrimitive.Messages className="flex-1 overflow-y-auto">
 *       </ThreadPrimitive.Messages>
 *       <ComposerArea />
 *     </ThreadPrimitive.Root>
 *   );
 * }
 *
 * @example
 * // File attachment handling demonstration
 * // User clicks paperclip button to open file picker
 * // Selects image.png (2MB), document.pdf (5MB), notes.txt (100KB)
 * // All pass validation and appear in preview area
 * // User clicks X on document.pdf to remove it
 * // Clicks Send button to submit message with remaining 2 attachments
 * function AttachmentDemo() {
 *   return (
 *     <div>
 *       <ComposerArea />
 *     </div>
 *   );
 * }
 *
 * @example
 * // Send/Cancel button behavior based on conversation state
 * // When agent is idle, Send button is visible
 * // User types message and clicks Send
 * // While agent is generating response, Cancel button appears
 * // User can click Cancel to stop the response generation
 * function SendCancelDemo() {
 *   return (
 *     <AssistantRuntimeProvider runtime={runtime}>
 *       <ComposerArea />
 *     </AssistantRuntimeProvider>
 *   );
 * }
 */

import React, { useState, useRef, useEffect } from 'react';
import { ComposerPrimitive, ThreadPrimitive } from '@assistant-ui/react';
import { PaperclipIcon, SendIcon, XCircleIcon } from './ui/Icons';

/**
 * File attachment data structure for managing uploaded files
 *
 * @interface FileAttachment
 * @property {string} id - Unique identifier for the attachment (timestamp-based)
 * @property {File} file - The raw File object from the file input
 * @property {string} preview - Object URL for image previews (created with URL.createObjectURL), empty for non-images
 * @property {'image' | 'pdf' | 'text' | 'other'} type - Categorized file type for icon selection and display
 */
interface FileAttachment {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'pdf' | 'text' | 'other';
}

const ComposerArea: React.FC = () => {
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea on mount
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  /**
   * Handles file selection from the file input
   *
   * Processes selected files with validation and creates attachment objects.
   * Validates file type (images, PDFs, text) and size (max 10MB). Creates
   * preview URLs for images. Shows alerts for validation failures.
   *
   * @internal
   * @param {React.ChangeEvent<HTMLInputElement>} e - File input change event
   *
   * Workflow:
   * 1. Sets uploading state to true for UI feedback
   * 2. Iterates through selected files (supports multiple)
   * 3. Validates file type against allowed types (image/*, application/pdf, text/*)
   * 4. Validates file size (rejects if > 10MB)
   * 5. Creates object URL preview for images
   * 6. Categorizes file type for icon selection
   * 7. Appends valid files to attachments state
   * 8. Resets file input value
   * 9. Sets uploading state to false
   *
   * Error handling:
   * - Shows alert for unsupported file types
   * - Shows alert for files exceeding 10MB
   * - Continues processing remaining files after validation failures
   * - Catches and logs any processing errors
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const newAttachments: FileAttachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        const isImage = file.type.startsWith('image/');
        const isPDF = file.type === 'application/pdf';
        const isText = file.type.startsWith('text/');

        let fileType: 'image' | 'pdf' | 'text' | 'other' = 'other';
        if (isImage) fileType = 'image';
        else if (isPDF) fileType = 'pdf';
        else if (isText) fileType = 'text';

        if (!isImage && !isPDF && !isText) {
          alert(`File type not supported: ${file.type}`);
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert(`File too large: ${file.name} (max 10MB)`);
          continue;
        }

        // Create preview for images
        let preview = '';
        if (isImage) {
          preview = URL.createObjectURL(file);
        }

        newAttachments.push({
          id: `${Date.now()}-${i}`,
          file,
          preview,
          type: fileType,
        });
      }

      setAttachments(prev => [...prev, ...newAttachments]);
    } catch (error) {
      console.error('Failed to process files:', error);
      alert('Failed to upload files');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Removes an attachment from the list and cleans up resources
   *
   * Revokes object URL to free memory (for image previews) and removes
   * the attachment from the state array.
   *
   * @internal
   * @param {string} id - Unique identifier of the attachment to remove
   *
   * Cleanup steps:
   * 1. Finds attachment by ID
   * 2. Revokes object URL if preview exists (prevents memory leaks)
   * 3. Filters attachment out of state array
   */
  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => {
      const attachment = prev.find(a => a.id === id);
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter(a => a.id !== id);
    });
  };

  /**
   * Returns the appropriate icon for a file type
   *
   * Renders a colored icon with document SVG based on the file type.
   * Used in attachment previews for non-image files.
   *
   * @internal
   * @param {string} type - File type ('pdf', 'text', or 'other')
   * @returns {JSX.Element} Colored icon div with SVG
   *
   * Icon colors:
   * - PDF: Red background (red-100) with red icon (red-600)
   * - Text: Blue background (blue-100) with blue icon (blue-600)
   * - Other: Gray background (gray-100) with gray icon (gray-600)
   */
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return (
          <div className="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-red-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
            </svg>
          </div>
        );
      case 'text':
        return (
          <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center text-blue-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="border-t border-gray-700 bg-gray-800 p-4">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative group bg-gray-900 rounded-lg p-2 flex items-center gap-2 max-w-xs border border-gray-700 hover:border-gray-600 transition-colors"
            >
              {/* File Preview/Icon */}
              <div className="flex-shrink-0">
                {attachment.type === 'image' && attachment.preview ? (
                  <img
                    src={attachment.preview}
                    alt={attachment.file.name}
                    className="w-10 h-10 rounded object-cover"
                  />
                ) : (
                  getFileIcon(attachment.type)
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {attachment.file.name}
                </p>
                <p className="text-xs text-gray-400">
                  {(attachment.file.size / 1024).toFixed(1)} KB
                </p>
              </div>

              {/* Remove Button */}
              <button
                onClick={() => handleRemoveAttachment(attachment.id)}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-red-400 transition-colors"
                title="Remove"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <ComposerPrimitive.Root className="flex items-end gap-2">
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
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Attach files (images, PDFs, text)"
          >
            <PaperclipIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Textarea */}
        <div className="flex-1">
          <ComposerPrimitive.Input
            ref={textareaRef}
            placeholder="Type your message... (Shift+Enter for new line)"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 text-sm transition-all min-h-[48px] max-h-[200px]"
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
          />
        </div>

        {/* Send/Cancel Button */}
        <div className="flex-shrink-0">
          {/* Show Cancel button when running */}
          <ThreadPrimitive.If running={true}>
            <ComposerPrimitive.Cancel className="p-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors flex items-center gap-1.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-sm font-medium">Stop</span>
            </ComposerPrimitive.Cancel>
          </ThreadPrimitive.If>

          {/* Show Send button when not running */}
          <ThreadPrimitive.If running={false}>
            <ComposerPrimitive.Send className="p-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <SendIcon className="w-5 h-5" />
            </ComposerPrimitive.Send>
          </ThreadPrimitive.If>
        </div>
      </ComposerPrimitive.Root>

      {/* Hint */}
      <div className="mt-2 text-xs text-gray-400 px-1">
        Press <kbd className="px-1.5 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs font-mono text-gray-300">Enter</kbd> to send,
        <kbd className="ml-1 px-1.5 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs font-mono text-gray-300">Shift+Enter</kbd> for new line
      </div>
    </div>
  );
};

ComposerArea.displayName = 'ComposerArea';

export default ComposerArea;
