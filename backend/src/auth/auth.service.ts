import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import { PrismaClient, User } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const JWT_SECRET = process.env.JWT_SECRET || 'x-chatter-super-secret-jwt-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'x-chatter-super-secret-refresh-key';
const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SignupDto {
  username: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  provider?: 'LOCAL' | 'GOOGLE' | 'APPLE';
  socialToken?: string;
}

export class AuthService {
  /**
   * Register a new user with email, phone, or social account
   */
  async signup(dto: SignupDto): Promise<{ user: Partial<User>; tokens: AuthTokens }> {
    // 1. Verify uniqueness
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(dto.phoneNumber ? [{ phoneNumber: dto.phoneNumber }] : []),
        ],
      },
    });

    if (existing) {
      throw new Error('Username, email, or phone number already in use');
    }

    // 2. Hash password if local auth
    let passwordHash: string | undefined = undefined;
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 12);
    }

    // 3. Create user
    const user = await prisma.user.create({
      data: {
        username: dto.username.toLowerCase(),
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        passwordHash,
      },
    });

    // 4. Generate token pair
    const tokens = await this.generateTokens(user.id, user.username);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      tokens,
    };
  }

  /**
   * Secure Login with 2FA verification check
   */
  async login(
    identifier: string, // username, email, or phone
    password?: string,
    totpCode?: string
  ): Promise<{ user: Partial<User>; tokens?: AuthTokens; requires2FA?: boolean; tempToken?: string }> {
    // 1. Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier.toLowerCase() },
          { email: identifier },
          { phoneNumber: identifier },
        ],
      },
    });

    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    // 2. Validate password
    const isPasswordValid = await bcrypt.compare(password || '', user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // 3. Check 2FA requirement
    if (user.twoFactorEnabled) {
      if (!totpCode) {
        // Issue temporary session token for 2FA challenge (5 min expiry)
        const tempToken = jwt.sign(
          { userId: user.id, purpose: '2FA_CHALLENGE' },
          JWT_SECRET,
          { expiresIn: '5m' }
        );
        return { user: { id: user.id, username: user.username }, requires2FA: true, tempToken };
      }

      // Verify TOTP token
      const isValidTotp = authenticator.verify({
        token: totpCode,
        secret: user.twoFactorSecret!,
      });

      if (!isValidTotp) {
        throw new Error('Invalid two-factor authentication code');
      }
    }

    // 4. Issue standard tokens
    const tokens = await this.generateTokens(user.id, user.username);

    // Update status to ONLINE
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ONLINE', lastSeenAt: new Date() },
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      tokens,
    };
  }

  /**
   * Secure Logout: Revokes refresh token in database & blacklists access token in Redis
   */
  async logout(userId: string, accessToken: string, refreshToken?: string): Promise<{ success: boolean }> {
    // 1. Blacklist current access token in Redis until its remaining TTL expires
    try {
      const decoded: any = jwt.decode(accessToken);
      if (decoded && decoded.exp) {
        const remainingTime = decoded.exp - Math.floor(Date.now() / 1000);
        if (remainingTime > 0) {
          await redis.setex(`bl_${accessToken}`, remainingTime, 'revoked');
        }
      }
    } catch (err) {
      console.warn('Failed to parse access token for blacklisting', err);
    }

    // 2. Revoke refresh token in PostgreSQL
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await prisma.refreshToken.updateMany({
        where: { tokenHash, userId },
        data: { isRevoked: true },
      });
    }

    // 3. Mark user offline & publish presence event
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'OFFLINE', lastSeenAt: new Date() },
    });

    await redis.publish('presence:channel', JSON.stringify({ userId, status: 'OFFLINE' }));

    return { success: true };
  }

  /**
   * Refresh Token Rotation with Replay Attack Detection
   */
  async refreshTokens(oldRefreshToken: string): Promise<AuthTokens> {
    const tokenHash = crypto.createHash('sha256').update(oldRefreshToken).digest('hex');

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new Error('Invalid refresh token');
    }

    // Reuse detection: If token was already revoked, someone is replaying a stolen token!
    // Revoke all refresh tokens for this user immediately as security precaution.
    if (storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId },
        data: { isRevoked: true },
      });
      throw new Error('Compromised session detected. All sessions terminated.');
    }

    // Invalidate old token (Single-use rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // Issue new pair
    return this.generateTokens(storedToken.userId, storedToken.user.username);
  }

  /**
   * Helper: Generate Access and Refresh Token Pair
   */
  private async generateTokens(userId: string, username: string): Promise<AuthTokens> {
    const accessToken = jwt.sign(
      { sub: userId, username },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL }
    );

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);

    await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL,
    };
  }

  /**
   * Enable 2FA: Generates QR Code Secret & URI
   */
  async generate2FASecret(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.username, 'X Chatter', secret);

    // Save temporary secret to user until verified
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return { secret, otpAuthUrl };
  }

  /**
   * Verify and confirm 2FA activation
   */
  async confirm2FA(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) throw new Error('2FA not initiated');

    const isValid = authenticator.verify({
      token,
      secret: user.twoFactorSecret,
    });

    if (!isValid) throw new Error('Invalid verification code');

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { success: true, message: '2FA enabled successfully' };
  }
}
