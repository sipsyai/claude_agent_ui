import Anthropic from '@anthropic-ai/sdk';
import { ConversationMessage } from '@/types/index.js';
import { createLogger, type Logger } from './logger.js';

/**
 * MessageFilter - Filters out local command messages from conversation history
 *
 * @description
 * The MessageFilter service removes internal command messages and system metadata from
 * conversation histories before they are sent to Claude or displayed to users. It identifies
 * and filters out messages that contain local command output, system caveats, and other
 * internal metadata that should not be part of the user-facing conversation.
 *
 * This service ensures that conversation histories remain clean and focused on the actual
 * user-assistant interaction, removing technical artifacts that are only relevant internally.
 *
 * **Key Responsibilities:**
 * - Filter user messages containing local command output and metadata
 * - Identify messages with specific system-generated prefixes
 * - Preserve all assistant messages (no filtering)
 * - Extract and analyze text content from various message formats
 * - Maintain clean conversation history for Claude API calls
 *
 * **Architecture:**
 * - **Prefix-Based Filtering**: Uses predefined prefix patterns to identify system messages
 * - **User-Only Filtering**: Only filters user messages, preserving all assistant responses
 * - **Content Extraction**: Handles multiple message formats (string, Anthropic.Message, MessageParam)
 * - **Stateless Operation**: Each filter call is independent with no internal state changes
 *
 * **Filter Criteria:**
 * Messages are filtered out (removed) if they meet ALL of the following conditions:
 * 1. Message type is 'user' (assistant messages are never filtered)
 * 2. Message contains text content (non-text messages are kept)
 * 3. Text content starts with one of the filtered prefixes:
 *    - `'Caveat: '` - System caveats and warnings
 *    - `'<command-name>'` - Local command name metadata
 *    - `'<local-command-stdout>'` - Local command output markers
 *
 * **Filtered Prefixes:**
 * The service filters messages starting with these exact prefixes (case-sensitive):
 * - **"Caveat: "**: System-generated caveats about command execution or limitations
 * - **"<command-name>"**: Metadata indicating which local command was executed
 * - **"<local-command-stdout>"**: Markers wrapping local command standard output
 *
 * @example
 * ```typescript
 * // Basic usage - filter conversation messages
 * import { MessageFilter } from './message-filter';
 * import type { ConversationMessage } from '@/types';
 *
 * const filter = new MessageFilter();
 *
 * const messages: ConversationMessage[] = [
 *   { type: 'user', message: 'Hello Claude!' },
 *   { type: 'user', message: 'Caveat: This is a system warning' }, // Will be filtered
 *   { type: 'assistant', message: { role: 'assistant', content: 'Hi!' } },
 *   { type: 'user', message: '<command-name>ls</command-name>' }  // Will be filtered
 * ];
 *
 * const cleanMessages = filter.filterMessages(messages);
 * // Result: Only first user message and assistant message remain
 * ```
 *
 * @example
 * ```typescript
 * // Use before sending to Claude API
 * import { MessageFilter } from './message-filter';
 * import type { ConversationMessage } from '@/types';
 *
 * const filter = new MessageFilter();
 *
 * // Load conversation history (may contain system messages)
 * const rawHistory = await loadConversationHistory(sessionId);
 *
 * // Filter out system messages before sending to Claude
 * const cleanHistory = filter.filterMessages(rawHistory.messages);
 *
 * // Send clean history to Claude API
 * const response = await claude.messages.create({
 *   messages: cleanHistory.map(m => m.message),
 *   // ... other params
 * });
 * ```
 *
 * @see {@link ConversationMessage} - The message type being filtered
 */
export class MessageFilter {
  private logger: Logger;
  private filteredPrefixes: string[] = [
    'Caveat: ',
    '<command-name>',
    '<local-command-stdout>'
  ];

  constructor() {
    this.logger = createLogger('MessageFilter');
  }

  /**
   * Filter an array of conversation messages to remove system/command metadata
   *
   * @description
   * Processes an array of conversation messages and removes any user messages that contain
   * local command output or system metadata. This method preserves the chronological order
   * of messages and keeps all assistant messages intact.
   *
   * The filtering is performed by examining each message's type and content. Only user messages
   * with text content matching the configured filter prefixes are removed. All other messages,
   * including assistant messages, user messages without text content, and user messages without
   * filtered prefixes, are preserved in the output.
   *
   * **Filtering Process:**
   * 1. Iterate through each message in the input array
   * 2. For each message, call shouldKeepMessage() to determine if it should be kept
   * 3. Filter out messages where shouldKeepMessage() returns false
   * 4. Return the filtered array with original message order preserved
   *
   * **What Gets Filtered:**
   * - User messages starting with "Caveat: "
   * - User messages starting with "<command-name>"
   * - User messages starting with "<local-command-stdout>"
   *
   * **What Gets Kept:**
   * - All assistant messages (regardless of content)
   * - User messages without text content
   * - User messages with text content not matching filtered prefixes
   *
   * @param {ConversationMessage[]} messages - Array of conversation messages to filter.
   *                                           Can include both user and assistant messages
   *                                           with various content formats.
   *
   * @returns {ConversationMessage[]} Filtered array of messages with system metadata removed.
   *                                  The returned array maintains the original chronological
   *                                  order of the kept messages.
   *
   * @example
   * ```typescript
   * import { MessageFilter } from './message-filter';
   *
   * const filter = new MessageFilter();
   *
   * const messages = [
   *   { type: 'user', message: 'What is 2+2?' },
   *   { type: 'assistant', message: { role: 'assistant', content: 'The answer is 4.' } },
   *   { type: 'user', message: 'Caveat: Command execution limited' }, // Filtered
   *   { type: 'user', message: 'Thanks!' }
   * ];
   *
   * const filtered = filter.filterMessages(messages);
   * // Result: [
   * //   { type: 'user', message: 'What is 2+2?' },
   * //   { type: 'assistant', message: { role: 'assistant', content: 'The answer is 4.' } },
   * //   { type: 'user', message: 'Thanks!' }
   * // ]
   * ```
   *
   * @example
   * ```typescript
   * // Filtering messages with command metadata
   * import { MessageFilter } from './message-filter';
   *
   * const filter = new MessageFilter();
   *
   * const messagesWithCommands = [
   *   { type: 'user', message: '<command-name>git status</command-name>' }, // Filtered
   *   { type: 'user', message: '<local-command-stdout>Changes not staged</local-command-stdout>' }, // Filtered
   *   { type: 'user', message: 'Please commit these changes' },
   *   { type: 'assistant', message: { role: 'assistant', content: 'I will commit...' } }
   * ];
   *
   * const filtered = filter.filterMessages(messagesWithCommands);
   * // Result: Only the last two messages remain
   * ```
   *
   * @see {@link shouldKeepMessage} - Internal method that determines if a single message should be kept
   * @see {@link ConversationMessage} - The message type being filtered
   */
  filterMessages(messages: ConversationMessage[]): ConversationMessage[] {
    return messages.filter(message => this.shouldKeepMessage(message));
  }

  /**
   * Determine if a message should be kept (not filtered out)
   *
   * @description
   * Evaluates a single conversation message to determine whether it should be included in
   * the filtered output or removed. This method implements the core filtering logic by
   * checking the message type, extracting text content, and comparing against the list
   * of filtered prefixes.
   *
   * The decision logic follows a multi-step process with early returns for messages that
   * should always be kept. Only user messages with specific text prefixes are filtered out.
   *
   * **Decision Logic:**
   * 1. **Assistant Messages**: Always kept (return true immediately)
   *    - Assistant responses should never be filtered regardless of content
   *
   * 2. **Non-Text User Messages**: Always kept (return true)
   *    - If text content cannot be extracted, the message is preserved
   *    - This includes messages with only images, tool results, or other non-text content
   *
   * 3. **Text User Messages**: Check against filtered prefixes
   *    - Extract text content from the message
   *    - Trim whitespace and check if text starts with any filtered prefix
   *    - Return false (filter out) if prefix match found
   *    - Return true (keep) if no prefix matches
   *
   * **Filter Criteria Applied:**
   * - Message type must be 'user' (not 'assistant')
   * - Message must have extractable text content
   * - Text must start with one of: "Caveat: ", "<command-name>", "<local-command-stdout>"
   * - Prefix matching is case-sensitive and applied after trimming whitespace
   *
   * @private
   * @param {ConversationMessage} message - The conversation message to evaluate.
   *                                        Can be either a user or assistant message
   *                                        with various content formats.
   *
   * @returns {boolean} True if the message should be kept in the filtered output,
   *                    false if it should be removed.
   *                    - Returns true for all assistant messages
   *                    - Returns true for user messages without text content
   *                    - Returns true for user messages not matching filtered prefixes
   *                    - Returns false for user messages matching filtered prefixes
   *
   * @example
   * ```typescript
   * // Internal usage within filterMessages()
   * const messages = [
   *   { type: 'user', message: 'Hello' },           // shouldKeepMessage() -> true
   *   { type: 'user', message: 'Caveat: warning' }, // shouldKeepMessage() -> false
   *   { type: 'assistant', message: { ... } }       // shouldKeepMessage() -> true
   * ];
   * ```
   *
   * @see {@link filterMessages} - Public method that uses this to filter message arrays
   * @see {@link extractTextContent} - Helper method for extracting text from messages
   * @see {@link filteredPrefixes} - The list of prefixes that trigger filtering
   */
  private shouldKeepMessage(message: ConversationMessage): boolean {
    // Only filter user messages with text content
    if (message.type !== 'user') {
      return true;
    }

    const textContent = this.extractTextContent(message.message);
    if (!textContent) {
      return true; // Keep messages without text content
    }

    // Check if the text starts with any filtered prefix
    const shouldFilter = this.filteredPrefixes.some(prefix =>
      textContent.trim().startsWith(prefix)
    );

    return !shouldFilter;
  }

  /**
   * Extract text content from Anthropic message object
   *
   * @description
   * Extracts plain text content from various Anthropic SDK message formats. This method
   * handles the polymorphic nature of message content, which can be a simple string,
   * a Message object with string content, or a Message object with an array of content
   * blocks (text, images, tool uses, etc.).
   *
   * The extraction process attempts to find text content using multiple strategies,
   * trying simpler formats first before parsing complex content block arrays.
   *
   * **Extraction Strategy:**
   * 1. **String Messages**: Return immediately if message is already a string
   * 2. **String Content**: Return content if message.content is a string
   * 3. **Content Block Arrays**: Search for first text block in content array
   * 4. **No Text Found**: Return null if no text content is available
   *
   * **Supported Message Formats:**
   * - `string`: Plain text messages (returned as-is)
   * - `Anthropic.Message`: SDK Message object with content property
   * - `Anthropic.MessageParam`: Message parameter object with content property
   *
   * **Content Block Handling:**
   * When message.content is an array, the method searches for the first content block
   * with `type: 'text'` and extracts its text property. Other block types (image,
   * tool_use, tool_result) are ignored in the search.
   *
   * @private
   * @param {Anthropic.Message | Anthropic.MessageParam | string} message
   *        The message to extract text from. Can be a string, Message object, or MessageParam.
   *
   * @returns {string | null} The extracted text content, or null if no text content exists.
   *                          Returns null for messages with only non-text content blocks
   *                          (images, tool uses, etc.).
   *
   * @example
   * ```typescript
   * // String message
   * const text1 = extractTextContent('Hello world');
   * // Result: 'Hello world'
   *
   * // Message with string content
   * const text2 = extractTextContent({
   *   role: 'user',
   *   content: 'Hello world'
   * });
   * // Result: 'Hello world'
   *
   * // Message with content blocks
   * const text3 = extractTextContent({
   *   role: 'assistant',
   *   content: [
   *     { type: 'text', text: 'Here is the answer' },
   *     { type: 'tool_use', name: 'calculator', input: {} }
   *   ]
   * });
   * // Result: 'Here is the answer' (first text block)
   *
   * // Message with no text content
   * const text4 = extractTextContent({
   *   role: 'user',
   *   content: [
   *     { type: 'image', source: { ... } }
   *   ]
   * });
   * // Result: null (no text blocks)
   * ```
   *
   * @see {@link shouldKeepMessage} - Uses this method to extract text for filtering
   * @see {@link https://docs.anthropic.com/claude/reference/messages_post|Anthropic Messages API} - Message format documentation
   */
  private extractTextContent(message: Anthropic.Message | Anthropic.MessageParam | string): string | null {
    if (typeof message === 'string') {
      return message;
    }

    if (message.content) {
      if (typeof message.content === 'string') {
        return message.content;
      }

      if (Array.isArray(message.content)) {
        // Find first text content block
        const textBlock = message.content.find((block) => block.type === 'text');
        return textBlock && 'text' in textBlock ? textBlock.text : null;
      }
    }

    return null;
  }
}