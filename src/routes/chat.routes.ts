/**
 * Chat Routes - API endpoints for chat functionality
 *
 * Endpoints:
 * - POST /api/chat/sessions - Create new chat session
 * - GET /api/chat/sessions - Get all chat sessions
 * - GET /api/chat/sessions/:id - Get single chat session
 * - DELETE /api/chat/sessions/:id - Delete chat session
 * - POST /api/chat/sessions/:id/archive - Archive chat session
 * - GET /api/chat/sessions/:id/messages - Get messages for session
 * - POST /api/chat/sessions/:id/messages - Send message (SSE streaming)
 * - POST /api/chat/attachments - Upload file attachment
 */

import { Router, type Request, type Response } from 'express';
import { createLogger } from '../services/logger.js';
import { chatService } from '../services/chat-service.js';
import type {
  CreateChatSessionRequest,
  SendMessageRequest,
} from '../types/chat-types.js';

const logger = createLogger('ChatRoutes');
const router = Router();

/**
 * POST /api/chat/sessions
 * Create a new chat session
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { title, skillIds, agentId, customSystemPrompt, permissionMode } = req.body as CreateChatSessionRequest;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!skillIds || !Array.isArray(skillIds)) {
      return res.status(400).json({ error: 'skillIds array is required' });
    }

    // Get working directory from query or cookies
    const workingDirectory =
      (req.query.workingDirectory as string) ||
      req.cookies?.selectedDirectory ||
      process.cwd();

    const session = await chatService.createChatSession(
      title,
      skillIds,
      agentId,
      customSystemPrompt,
      workingDirectory,
      permissionMode
    );

    logger.info('Chat session created', {
      sessionId: session.documentId,
      title,
      skillCount: skillIds.length,
      agentId: agentId || 'none',
      customSystemPrompt: customSystemPrompt ? 'provided' : 'none',
      permissionMode: permissionMode || 'default',
    });

    res.json({ session });
  } catch (error) {
    logger.error('Failed to create chat session', error);
    res.status(500).json({
      error: 'Failed to create chat session',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/chat/sessions
 * Get all chat sessions
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const sessions = await chatService.getAllChatSessions();

    res.json({ sessions });
  } catch (error) {
    logger.error('Failed to get chat sessions', error);
    res.status(500).json({
      error: 'Failed to get chat sessions',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/chat/sessions/:id
 * Get single chat session
 */
router.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await chatService.getChatSession(id);

    res.json({ session });
  } catch (error) {
    logger.error('Failed to get chat session', error);
    res.status(500).json({
      error: 'Failed to get chat session',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/chat/sessions/:id
 * Delete chat session
 */
router.delete('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await chatService.deleteChatSession(id);

    logger.info('Chat session deleted', { sessionId: id });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete chat session', error);
    res.status(500).json({
      error: 'Failed to delete chat session',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/chat/sessions/:id/archive
 * Archive chat session
 */
router.post('/sessions/:id/archive', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await chatService.archiveChatSession(id);

    logger.info('Chat session archived', { sessionId: id });

    res.json({ session });
  } catch (error) {
    logger.error('Failed to archive chat session', error);
    res.status(500).json({
      error: 'Failed to archive chat session',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/chat/sessions/:id/messages
 * Get messages for chat session
 */
router.get('/sessions/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const messages = await chatService.getChatMessages(id);

    res.json({ messages });
  } catch (error) {
    logger.error('Failed to get chat messages', error);
    res.status(500).json({
      error: 'Failed to get chat messages',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/chat/sessions/:id/messages
 * Send message to chat session (SSE streaming)
 */
router.post('/sessions/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message, attachments, agentId, skillIds, permissionMode } = req.body as SendMessageRequest;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get working directory from query or cookies
    const workingDirectory =
      (req.query.workingDirectory as string) ||
      req.cookies?.selectedDirectory ||
      process.cwd();

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    logger.info('Streaming chat message', {
      sessionId: id,
      messageLength: message.length,
      attachmentCount: attachments?.length || 0,
      agentOverride: agentId ? 'yes' : 'no',
      skillsOverride: skillIds ? 'yes' : 'no',
      permissionMode: permissionMode || 'default',
    });

    try {
      // Stream messages from chat service
      for await (const event of chatService.sendMessage(
        id,
        message,
        attachments,
        workingDirectory,
        permissionMode,
        agentId,
        skillIds
      )) {
        // Send SSE event
        res.write(`data: ${JSON.stringify(event)}\n\n`);

        // Check if client disconnected
        if (res.writableEnded) {
          logger.warn('Client disconnected during streaming', { sessionId: id });
          break;
        }
      }
    } catch (streamError) {
      logger.error('Error during message streaming', streamError, { sessionId: id });

      // Send error event
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: streamError instanceof Error ? streamError.message : String(streamError),
        })}\n\n`
      );
    }

    // End response
    res.end();

    logger.info('Chat message streaming completed', { sessionId: id });
  } catch (error) {
    logger.error('Failed to send chat message', error);

    // If headers not sent yet, send JSON error
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to send chat message',
        message: error instanceof Error ? error.message : String(error),
      });
    } else {
      // If streaming already started, send error event
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        })}\n\n`
      );
      res.end();
    }
  }
});

/**
 * POST /api/chat/sessions/:sessionId/messages/:streamId/cancel
 * Cancel an active message stream
 */
router.post('/sessions/:sessionId/messages/:streamId/cancel', async (req: Request, res: Response) => {
  try {
    const { sessionId, streamId } = req.params;

    logger.info('Cancelling message stream', { sessionId, streamId });

    const cancelled = chatService.cancelMessage(streamId);

    if (cancelled) {
      res.json({
        success: true,
        message: 'Message stream cancelled successfully',
      });
    } else {
      res.status(404).json({
        error: 'Stream not found',
        message: 'Stream not found or already completed',
      });
    }
  } catch (error) {
    logger.error('Failed to cancel message stream', error);
    res.status(500).json({
      error: 'Failed to cancel message stream',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/chat/attachments
 * Upload file attachment (returns base64 data)
 */
router.post('/attachments', async (req: Request, res: Response) => {
  try {
    const { file, filename } = req.body;

    if (!file || !filename) {
      return res.status(400).json({ error: 'File and filename are required' });
    }

    // File is already base64 from frontend
    // Just validate and return
    const mimeType = req.body.mimeType || 'application/octet-stream';

    logger.info('File attachment received', {
      filename,
      mimeType,
      size: file.length,
    });

    res.json({
      filename,
      mimeType,
      data: file, // base64
      size: Buffer.from(file, 'base64').length,
    });
  } catch (error) {
    logger.error('Failed to process attachment', error);
    res.status(500).json({
      error: 'Failed to process attachment',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
