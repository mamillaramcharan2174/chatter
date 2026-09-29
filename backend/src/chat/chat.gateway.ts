import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient, MessageType } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const pub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const sub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const JWT_SECRET = process.env.JWT_SECRET || 'x-chatter-super-secret-jwt-key';

export interface EncryptedMessagePayload {
  recipientId: string;
  encryptedPayload: string; // Double Ratchet ciphertext
  iv: string;               // Initialization vector
  keyId?: number;           // PreKey identifier used
  messageType: MessageType;
  mediaUrl?: string;        // S3 URL for encrypted media (if photo/video/voice note)
  mediaMimeType?: string;
  clientMessageId: string;  // Client-generated UUID for optimistic UI
}

export class ChatGateway {
  private io: Server;

  constructor(server: any) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Socket Authentication Middleware
   * Verifies JWT and checks Redis token blacklist
   */
  private setupMiddleware() {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Check if token was blacklisted on logout
        const isBlacklisted = await redis.get(`bl_${token}`);
        if (isBlacklisted) {
          return next(new Error('Token revoked'));
        }

        const decoded: any = jwt.verify(token, JWT_SECRET);
        socket.data.userId = decoded.sub;
        socket.data.username = decoded.username;
        next();
      } catch (err) {
        return next(new Error('Invalid or expired token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', async (socket: Socket) => {
      const userId = socket.data.userId;
      console.log(`[X Chatter Gateway] User connected: ${userId} (Socket: ${socket.id})`);

      // 1. Join user's personal communication room
      await socket.join(`user:${userId}`);

      // 2. Track active socket mapping in Redis
      await redis.sadd(`online_users`, userId);
      await redis.set(`user_socket:${userId}`, socket.id);

      // 3. Broadcast online status to friends
      socket.broadcast.emit('user_presence_change', {
        userId,
        status: 'ONLINE',
        lastSeenAt: new Date(),
      });

      // ----------------------------------------------------------------------
      // A. SEND ENCRYPTED MESSAGE (E2EE)
      // ----------------------------------------------------------------------
      socket.on('send_message', async (data: EncryptedMessagePayload, ackCallback) => {
        try {
          const {
            recipientId,
            encryptedPayload,
            iv,
            keyId,
            messageType,
            mediaUrl,
            mediaMimeType,
            clientMessageId,
          } = data;

          // 1. Check if recipient has blocked sender
          const isBlocked = await prisma.friendship.findFirst({
            where: {
              requesterId: recipientId,
              addresseeId: userId,
              status: 'BLOCKED',
            },
          });

          if (isBlocked) {
            return ackCallback?.({ success: false, error: 'Cannot send message to this user' });
          }

          // 2. Check if recipient is currently online
          const isRecipientOnline = await redis.sismember('online_users', recipientId);

          // 3. Persist encrypted envelope to database
          // (No auto-delete: stored securely for multi-device sync and offline delivery)
          const savedMessage = await prisma.messageEnvelope.create({
            data: {
              senderId: userId,
              recipientId,
              encryptedPayload,
              iv,
              keyId,
              messageType: messageType || 'TEXT',
              mediaUrl,
              mediaMimeType,
              isDelivered: Boolean(isRecipientOnline),
              deliveredAt: isRecipientOnline ? new Date() : null,
            },
          });

          // 4. Dispatch real-time event to recipient's room
          this.io.to(`user:${recipientId}`).emit('new_message', {
            id: savedMessage.id,
            senderId: userId,
            encryptedPayload,
            iv,
            keyId,
            messageType: savedMessage.messageType,
            mediaUrl: savedMessage.mediaUrl,
            mediaMimeType: savedMessage.mediaMimeType,
            createdAt: savedMessage.createdAt,
            clientMessageId,
          });

          // 5. Acknowledge back to sender with server message ID
          ackCallback?.({
            success: true,
            messageId: savedMessage.id,
            clientMessageId,
            delivered: Boolean(isRecipientOnline),
          });
        } catch (error: any) {
          console.error('[X Chatter Gateway] Message relay error:', error);
          ackCallback?.({ success: false, error: error.message });
        }
      });

      // ----------------------------------------------------------------------
      // B. REAL-TIME TYPING INDICATORS
      // ----------------------------------------------------------------------
      socket.on('typing_start', ({ recipientId }) => {
        socket.to(`user:${recipientId}`).emit('user_typing', {
          userId,
          isTyping: true,
        });
      });

      socket.on('typing_stop', ({ recipientId }) => {
        socket.to(`user:${recipientId}`).emit('user_typing', {
          userId,
          isTyping: false,
        });
      });

      // ----------------------------------------------------------------------
      // C. READ RECEIPTS
      // ----------------------------------------------------------------------
      socket.on('mark_as_read', async ({ messageIds, senderId }: { messageIds: string[]; senderId: string }) => {
        const readAt = new Date();

        await prisma.messageEnvelope.updateMany({
          where: {
            id: { in: messageIds },
            recipientId: userId,
          },
          data: {
            isRead: true,
            readAt,
          },
        });

        // Notify sender that their messages have been read
        socket.to(`user:${senderId}`).emit('messages_read_receipt', {
          readerId: userId,
          messageIds,
          readAt,
        });
      });

      // ----------------------------------------------------------------------
      // D. DISCONNECT & PRESENCE CLEANUP
      // ----------------------------------------------------------------------
      socket.on('disconnect', async () => {
        console.log(`[X Chatter Gateway] User disconnected: ${userId}`);
        await redis.srem('online_users', userId);
        await redis.del(`user_socket:${userId}`);

        const lastSeenAt = new Date();
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'OFFLINE', lastSeenAt },
        });

        socket.broadcast.emit('user_presence_change', {
          userId,
          status: 'OFFLINE',
          lastSeenAt,
        });
      });
    });
  }
}
