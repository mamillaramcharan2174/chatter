import { PrismaClient, StreakState } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const STREAK_CYCLE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const EXPIRATION_WARNING_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours remaining

export interface StreakStatusResponse {
  streakId: string;
  currentStreak: number;
  longestStreak: number;
  state: StreakState;
  cycleExpiresAt: Date;
  hoursRemaining: number;
  hasUserSentToday: boolean;
  hasFriendSentToday: boolean;
}

export class StreakService {
  /**
   * Record a photo snap sent between two users and update streak status
   */
  async recordPhotoSnap(senderId: string, recipientId: string): Promise<StreakStatusResponse> {
    // 1. Order IDs deterministically so user1Id < user2Id
    const [u1, u2] = senderId < recipientId ? [senderId, recipientId] : [recipientId, senderId];
    const isSenderUser1 = senderId === u1;

    const now = new Date();

    // 2. Fetch or create streak record
    let streak = await prisma.streak.findUnique({
      where: {
        user1Id_user2Id: { user1Id: u1, user2Id: u2 },
      },
    });

    if (!streak) {
      // First snap initiated between these users
      const initialCycleExpiresAt = new Date(now.getTime() + STREAK_CYCLE_DURATION_MS);
      streak = await prisma.streak.create({
        data: {
          user1Id: u1,
          user2Id: u2,
          currentStreak: 0,
          longestStreak: 0,
          state: StreakState.ACTIVE,
          user1LastSnapAt: isSenderUser1 ? now : null,
          user2LastSnapAt: !isSenderUser1 ? now : null,
          cycleExpiresAt: initialCycleExpiresAt,
        },
      });

      return this.formatStreakResponse(streak, senderId);
    }

    // 3. Check if streak has expired past deadline
    if (streak.cycleExpiresAt < now) {
      // Streak broken, reset to day 1 cycle
      const newDeadline = new Date(now.getTime() + STREAK_CYCLE_DURATION_MS);
      streak = await prisma.streak.update({
        where: { id: streak.id },
        data: {
          currentStreak: 0,
          state: StreakState.ACTIVE,
          user1LastSnapAt: isSenderUser1 ? now : null,
          user2LastSnapAt: !isSenderUser1 ? now : null,
          cycleExpiresAt: newDeadline,
        },
      });

      return this.formatStreakResponse(streak, senderId);
    }

    // 4. Update the sender's timestamp
    const senderLastSnap = isSenderUser1 ? streak.user1LastSnapAt : streak.user2LastSnapAt;
    const friendLastSnap = isSenderUser1 ? streak.user2LastSnapAt : streak.user1LastSnapAt;

    // Has friend already sent a snap during this active cycle?
    const friendSentInCycle = friendLastSnap && friendLastSnap >= new Date(streak.cycleExpiresAt.getTime() - STREAK_CYCLE_DURATION_MS);

    // Has sender already sent one in this cycle?
    const senderSentInCycle = senderLastSnap && senderLastSnap >= new Date(streak.cycleExpiresAt.getTime() - STREAK_CYCLE_DURATION_MS);

    let updatedStreakCount = streak.currentStreak;
    let newExpiresAt = streak.cycleExpiresAt;
    let shouldIncrement = false;

    // Both parties have now completed their daily snap requirement for this cycle!
    if (friendSentInCycle && !senderSentInCycle) {
      shouldIncrement = true;
      updatedStreakCount += 1;
      // Extend streak deadline by a new 24h cycle
      newExpiresAt = new Date(now.getTime() + STREAK_CYCLE_DURATION_MS);
    }

    const longestStreak = Math.max(updatedStreakCount, streak.longestStreak);

    streak = await prisma.streak.update({
      where: { id: streak.id },
      data: {
        currentStreak: updatedStreakCount,
        longestStreak,
        state: StreakState.ACTIVE,
        user1LastSnapAt: isSenderUser1 ? now : streak.user1LastSnapAt,
        user2LastSnapAt: !isSenderUser1 ? now : streak.user2LastSnapAt,
        cycleExpiresAt: newExpiresAt,
        lastIncrementedAt: shouldIncrement ? now : streak.lastIncrementedAt,
      },
    });

    // 5. If incremented, publish real-time notification to both users
    if (shouldIncrement) {
      await redis.publish(
        'streaks:incremented',
        JSON.stringify({
          streakId: streak.id,
          user1Id: streak.user1Id,
          user2Id: streak.user2Id,
          streakCount: updatedStreakCount,
        })
      );
    }

    return this.formatStreakResponse(streak, senderId);
  }

  /**
   * Cron/Worker: Run every 15 minutes to evaluate expiring & expired streaks
   */
  async evaluateExpiringStreaksWorker(): Promise<{ warnedCount: number; expiredCount: number }> {
    const now = new Date();
    const warningHorizon = new Date(now.getTime() + EXPIRATION_WARNING_THRESHOLD_MS);

    // A. Detect streaks that have officially expired
    const expiredStreaks = await prisma.streak.findMany({
      where: {
        cycleExpiresAt: { lte: now },
        state: { not: StreakState.EXPIRED },
        currentStreak: { gt: 0 },
      },
      include: { user1: true, user2: true },
    });

    for (const s of expiredStreaks) {
      await prisma.streak.update({
        where: { id: s.id },
        data: {
          currentStreak: 0,
          state: StreakState.EXPIRED,
        },
      });

      // Send push notification about lost streak
      await this.dispatchPushNotification([s.user1Id, s.user2Id], {
        title: '💔 Streak Lost',
        body: `Your 🔥 ${s.currentStreak}-day streak has ended. Send a snap to restart!`,
      });
    }

    // B. Detect streaks expiring in < 4 hours that haven't sent snap
    const expiringStreaks = await prisma.streak.findMany({
      where: {
        cycleExpiresAt: { gt: now, lte: warningHorizon },
        state: StreakState.ACTIVE,
        currentStreak: { gt: 0 },
      },
      include: { user1: true, user2: true },
    });

    for (const s of expiringStreaks) {
      await prisma.streak.update({
        where: { id: s.id },
        data: { state: StreakState.EXPIRING_SOON },
      });

      const hoursLeft = Math.ceil((s.cycleExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));

      // Check which user needs to send a snap
      const targetUserIds: string[] = [];
      const cycleStart = new Date(s.cycleExpiresAt.getTime() - STREAK_CYCLE_DURATION_MS);

      if (!s.user1LastSnapAt || s.user1LastSnapAt < cycleStart) targetUserIds.push(s.user1Id);
      if (!s.user2LastSnapAt || s.user2LastSnapAt < cycleStart) targetUserIds.push(s.user2Id);

      if (targetUserIds.length > 0) {
        await this.dispatchPushNotification(targetUserIds, {
          title: '⚡ Streak Expiring Soon!',
          body: `Keep your 🔥 ${s.currentStreak}-day streak alive! Expires in ${hoursLeft}h!`,
        });
      }
    }

    return {
      warnedCount: expiringStreaks.length,
      expiredCount: expiredStreaks.length,
    };
  }

  /**
   * Get Friend Streak Leaderboard
   */
  async getStreakLeaderboard(userId: string) {
    const streaks = await prisma.streak.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        currentStreak: { gt: 0 },
      },
      include: {
        user1: { select: { id: true, username: true, avatarUrl: true } },
        user2: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { currentStreak: 'desc' },
      take: 20,
    });

    return streaks.map((s) => {
      const friend = s.user1Id === userId ? s.user2 : s.user1;
      return {
        friendId: friend.id,
        username: friend.username,
        avatarUrl: friend.avatarUrl,
        streakCount: s.currentStreak,
        longestStreak: s.longestStreak,
        cycleExpiresAt: s.cycleExpiresAt,
        state: s.state,
      };
    });
  }

  private formatStreakResponse(streak: any, currentUserId: string): StreakStatusResponse {
    const isUser1 = currentUserId === streak.user1Id;
    const now = new Date();
    const cycleStart = new Date(streak.cycleExpiresAt.getTime() - STREAK_CYCLE_DURATION_MS);

    const userSnap = isUser1 ? streak.user1LastSnapAt : streak.user2LastSnapAt;
    const friendSnap = isUser1 ? streak.user2LastSnapAt : streak.user1LastSnapAt;

    const hoursRemaining = Math.max(0, (streak.cycleExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));

    return {
      streakId: streak.id,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      state: streak.state,
      cycleExpiresAt: streak.cycleExpiresAt,
      hoursRemaining: Number(hoursRemaining.toFixed(1)),
      hasUserSentToday: Boolean(userSnap && userSnap >= cycleStart),
      hasFriendSentToday: Boolean(friendSnap && friendSnap >= cycleStart),
    };
  }

  private async dispatchPushNotification(userIds: string[], payload: { title: string; body: string }) {
    // In production, integrate Firebase Cloud Messaging (FCM) / APNs
    console.log(`[Push Notification Alert] -> users: [${userIds.join(', ')}]`, payload);
  }
}
