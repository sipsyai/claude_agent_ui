import React, { useState, useRef, useEffect } from 'react';
import { ComposerPrimitive, ThreadPrimitive } from '@assistant-ui/react';
import { PaperclipIcon, SendIcon, XCircleIcon } from './ui/Icons';

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

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

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

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => {
      const attachment = prev.find(a => a.id === id);
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter(a => a.id !== id);
    });
  };

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

export default ComposerArea;
