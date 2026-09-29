# X Chatter - Full-Stack Architecture & Implementation

A modern, cyberpunk-themed real-time chatting and streak platform built with high performance, sleek dark aesthetics (pure black with neon pink `#FF007F` and cyan `#00F0FF`), Signal Protocol End-to-End Encryption, and 24-hour disappearing stories.

## Repository Structure
```
x-chatter/
├── backend/
│   ├── src/
│   │   ├── auth/
│   │   │   └── auth.service.ts        # Login, Logout, 2FA TOTP, Refresh Token Rotation
│   │   ├── chat/
│   │   │   └── chat.gateway.ts        # Socket.io E2EE Envelope Relay, Typing, Read Receipts
│   │   ├── streaks/
│   │   │   └── streak.service.ts      # 24h Daily Snap Engine, Expiry Worker, Leaderboard
│   │   └── models/
│   │       └── schema.prisma          # PostgreSQL Schema (E2EE keys, Users, Streaks, Stories)
│   └── package.json
└── README.md
```

## Core Pillars
1. **App Identity**: Obsidian dark backdrop `#070709`, glowing neon pink & cyan accents, glassmorphic cards.
2. **Security**: Signal Protocol Double Ratchet E2EE (chats are encrypted; no server decryption), 2FA TOTP, JWT + Redis revocation blacklist.
3. **No Auto-Delete on Messages**: Chat history is persisted securely; only 24h Stories disappear.
4. **Streaks Engine**: Bidirectional daily photo exchange, 4h urgency countdown, push notifications, and friend leaderboards.
