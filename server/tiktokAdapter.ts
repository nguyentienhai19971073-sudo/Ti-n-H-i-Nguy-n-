import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import {
  ConnectionStatus,
  TikTokNormalizedEvent,
  ServerConnectionSnapshot,
  normalizeGiftId,
} from '../src/types/temple.ts';
import { getVieNeuServerConfig } from './ttsProxy.ts';

const BLOCKED_PATTERNS = [
  /\b(đm|địt|vl|vcl|đéo|ngu\s*ngốc|lừa\s*đảo|cờ\s*bạc|casino|bet88|kubet|sex|xxx|fuck|shit|bitch|scam)\b/i,
  /https?:\/\//i,
];

export function sanitizeAndFilterComment(raw: string): string | null {
  const trimmed = raw.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!trimmed) return null;
  for (const regex of BLOCKED_PATTERNS) {
    if (regex.test(trimmed)) {
      return null;
    }
  }
  return trimmed;
}

export class TikTokLiveAdapter {
  private connection: TikTokLiveConnection | null = null;
  private status: ConnectionStatus = ConnectionStatus.DEMO;
  private tiktokUsername = '';
  private roomId = '';
  private viewerCount = 0;
  private incomingEventCount = 0;
  private lastError = '';
  private manualDisconnect = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;

  // Rate limit comments per user (1 comment every 1.2s)
  private userCommentTimestamps = new Map<string, number>();
  // Deduplicate gift streaks & msgIds so repeated packets aren't double-counted
  private processedStreakTotals = new Map<string, number>();
  private completedStreakTotals = new Map<string, number>();
  private processedMsgIds = new Set<string>();
  // Track backend-verified cumulative likes per user during live session
  private userLikeTotals = new Map<string, number>();

  private onEventCallback: (event: TikTokNormalizedEvent) => void;
  private onStatusCallback: (snapshot: ServerConnectionSnapshot) => void;

  constructor(
    onEvent: (event: TikTokNormalizedEvent) => void,
    onStatus: (snapshot: ServerConnectionSnapshot) => void,
  ) {
    this.onEventCallback = onEvent;
    this.onStatusCallback = onStatus;
  }

  public getSnapshot(): ServerConnectionSnapshot {
    const vieneuCfg = getVieNeuServerConfig();
    return {
      status: this.status,
      tiktokUsername: this.tiktokUsername,
      roomId: this.roomId || undefined,
      viewerCount: this.viewerCount || undefined,
      incomingEventCount: this.incomingEventCount,
      lastError: this.lastError || undefined,
      receiverActive: this.status === ConnectionStatus.LIVE,
      isCloudRuntime: vieneuCfg.isCloudRuntime,
      availableServerTts: {
        vieneuCloudKeyConfigured: vieneuCfg.apiKeyConfigured,
        vieneuCloudEndpoint: vieneuCfg.cloudSpeechUrl,
        vieneuLocalEndpoint: vieneuCfg.localSpeechUrl,
        vieneuEnvUrlWasLocalhost: vieneuCfg.envWasLocalhost,
        gemini: Boolean(
          process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
        ),
        elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY),
      },
    };
  }

  private emitStatus() {
    this.onStatusCallback(this.getSnapshot());
  }

  public async connect(rawUsername: string): Promise<ServerConnectionSnapshot> {
    const cleanUsername = rawUsername.trim().replace(/^@+/, '');
    if (!cleanUsername || !/^[a-zA-Z0-9._]{2,40}$/.test(cleanUsername)) {
      this.status = ConnectionStatus.ERROR;
      this.lastError = 'Tên tài khoản TikTok không hợp lệ (ví dụ: @chuaonline.vn).';
      this.emitStatus();
      return this.getSnapshot();
    }

    await this.cleanupConnection();
    this.manualDisconnect = false;
    this.tiktokUsername = cleanUsername;
    this.lastError = '';
    this.status = ConnectionStatus.CONNECTING;
    this.emitStatus();

    try {
      const signApiKey = process.env.TIKTOK_SIGN_API_KEY?.trim() || undefined;
      const conn = new TikTokLiveConnection(cleanUsername, {
        processInitialData: false,
        fetchRoomInfoOnConnect: true,
        enableExtendedGiftInfo: true,
        ...(signApiKey ? { signApiKey } : {}),
      });

      this.connection = conn;
      this.bindEvents(conn);

      const state = await conn.connect();
      this.roomId = String(state?.roomId || '');
      this.status = ConnectionStatus.LIVE;
      this.lastError = '';
      this.reconnectAttempts = 0;
      this.emitStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.status = ConnectionStatus.ERROR;
      this.roomId = '';
      if (/offline|not live|room_id/i.test(msg)) {
        this.lastError = `Tài khoản @${cleanUsername} hiện không phát LIVE trên TikTok.`;
      } else {
        this.lastError = `Không thể kết nối TikTok LIVE (@${cleanUsername}): ${msg.slice(0, 140)}`;
      }
      await this.cleanupConnection();
      this.emitStatus();
    }

    return this.getSnapshot();
  }

  public async disconnect(switchToDemo = false): Promise<ServerConnectionSnapshot> {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await this.cleanupConnection();
    this.roomId = '';
    this.viewerCount = 0;
    this.lastError = '';
    this.status = switchToDemo ? ConnectionStatus.DEMO : ConnectionStatus.DISCONNECTED;
    this.emitStatus();
    return this.getSnapshot();
  }

  private async cleanupConnection() {
    if (this.connection) {
      try {
        this.connection.removeAllListeners();
        await this.connection.disconnect();
      } catch {
        // Ignore cleanup errors
      }
      this.connection = null;
    }
  }

  private scheduleReconnect() {
    if (this.manualDisconnect || !this.tiktokUsername || this.reconnectAttempts >= 4) {
      return;
    }
    this.reconnectAttempts += 1;
    const delayMs = Math.min(15000, 2500 * Math.pow(1.8, this.reconnectAttempts - 1));
    this.status = ConnectionStatus.CONNECTING;
    this.lastError = `Mất kết nối tạm thời, đang thử kết nối lại lần ${this.reconnectAttempts}...`;
    this.emitStatus();

    this.reconnectTimer = setTimeout(() => {
      if (!this.manualDisconnect && this.tiktokUsername) {
        void this.connect(this.tiktokUsername);
      }
    }, delayMs);
  }

  private extractAvatar(user: any): string | undefined {
    const urls =
      user?.profilePicture?.url ||
      user?.profilePicture?.urls ||
      user?.avatarThumb?.urlList ||
      [];
    if (Array.isArray(urls) && typeof urls[0] === 'string') {
      return urls[0];
    }
    if (typeof user?.profilePictureUrl === 'string') {
      return user.profilePictureUrl;
    }
    return undefined;
  }

  private extractUserFields(data: any) {
    const user = data?.user || data || {};
    const userId = String(user?.userId || user?.id || data?.userId || user?.uniqueId || '');
    const username = String(user?.uniqueId || data?.uniqueId || user?.nickname || userId || 'phattu');
    const nickname = String(user?.nickname || username);
    const avatarUrl = this.extractAvatar(user);
    return { userId, username, nickname, avatarUrl };
  }

  private bindEvents(conn: TikTokLiveConnection) {
    conn.on(ControlEvent.DISCONNECTED, () => {
      if (!this.manualDisconnect) {
        this.status = ConnectionStatus.DISCONNECTED;
        this.emitStatus();
        this.scheduleReconnect();
      }
    });

    conn.on(ControlEvent.ERROR, (err: any) => {
      const msg = err?.exception?.message || err?.message || String(err || '');
      if (msg) {
        this.lastError = msg.slice(0, 140);
        this.emitStatus();
      }
    });

    conn.on(WebcastEvent.STREAM_END, () => {
      this.manualDisconnect = true;
      this.status = ConnectionStatus.DISCONNECTED;
      this.lastError = `Phiên LIVE của @${this.tiktokUsername} đã kết thúc.`;
      void this.cleanupConnection();
      this.emitStatus();
    });

    conn.on(WebcastEvent.ROOM_USER, (data: any) => {
      if (typeof data?.viewerCount === 'number') {
        this.viewerCount = data.viewerCount;
        this.emitStatus();
      }
    });

    conn.on(WebcastEvent.CHAT, (data: any) => {
      const { userId, username, nickname, avatarUrl } = this.extractUserFields(data);
      if (!userId) return;

      const now = Date.now();
      const prevTime = this.userCommentTimestamps.get(userId) || 0;
      if (now - prevTime < 1200) return;

      const cleanComment = sanitizeAndFilterComment(String(data?.comment || ''));
      if (!cleanComment) return;
      this.userCommentTimestamps.set(userId, now);

      const event: TikTokNormalizedEvent = {
        eventId: String(data?.common?.msgId || `chat-${userId}-${now}`),
        type: 'comment',
        userId,
        username,
        nickname,
        avatarUrl,
        comment: cleanComment,
        isDemo: false,
        timestamp: now,
      };
      this.dispatchNormalized(event);
    });

    conn.on(WebcastEvent.GIFT, (data: any) => {
      const { userId, username, nickname, avatarUrl } = this.extractUserFields(data);
      if (!userId) return;

      const now = Date.now();
      const rawGiftId =
        data?.giftId ?? data?.giftDetails?.giftId ?? data?.extendedGiftInfo?.id ?? '';
      const giftId = normalizeGiftId(rawGiftId);
      if (!giftId) return; // Never invent fake fallback Gift IDs

      const giftName = String(
        data?.giftDetails?.giftName ||
          data?.extendedGiftInfo?.name ||
          data?.giftName ||
          `Gift #${giftId}`,
      );
      const giftPictureUrl =
        typeof data?.giftDetails?.giftPictureUrl === 'string'
          ? data.giftDetails.giftPictureUrl
          : Array.isArray(data?.extendedGiftInfo?.icon?.url_list) &&
              typeof data.extendedGiftInfo.icon.url_list[0] === 'string'
            ? data.extendedGiftInfo.icon.url_list[0]
            : typeof data?.giftPictureUrl === 'string'
              ? data.giftPictureUrl
              : undefined;

      const diamondCount = Math.max(
        0,
        Number(
          data?.giftDetails?.diamondCount ??
            data?.extendedGiftInfo?.diamond_count ??
            data?.diamondCount ??
            1,
        ),
      );
      const repeatCount = Math.max(1, Math.round(Number(data?.repeatCount || 1)));
      const giftType = Number(data?.giftDetails?.giftType ?? data?.giftType ?? 0);
      const repeatEnd = giftType === 1 ? Boolean(data?.repeatEnd) : true;

      const rawMsgId = data?.common?.msgId ? String(data.common.msgId) : '';
      if (rawMsgId) {
        if (this.processedMsgIds.has(rawMsgId)) return;
        this.processedMsgIds.add(rawMsgId);
        if (this.processedMsgIds.size > 4000) {
          const oldest = this.processedMsgIds.values().next().value;
          if (oldest) this.processedMsgIds.delete(oldest);
        }
      }

      // Streakable gifts (giftType === 1): compute exact delta so streaks & reconnects never double-count
      const groupToken = String(data?.groupId ?? data?.streakId ?? data?.comboId ?? 'default');
      const streakKey = `${userId}:${giftId}:${groupToken}`;
      let deltaCount = repeatCount;
      let isStreakCompletionOnly = false;

      if (giftType === 1) {
        const completedMax = this.completedStreakTotals.get(streakKey);
        if (completedMax !== undefined && repeatCount <= completedMax) {
          return;
        }

        const previousCount = this.processedStreakTotals.get(streakKey) || 0;
        if (repeatCount < previousCount || (repeatCount === previousCount && !repeatEnd)) {
          return;
        }

        deltaCount = Math.max(0, repeatCount - previousCount);
        if (deltaCount === 0 && repeatEnd) {
          isStreakCompletionOnly = true;
        }

        if (repeatEnd) {
          this.processedStreakTotals.delete(streakKey);
          this.completedStreakTotals.set(streakKey, repeatCount);
          if (this.completedStreakTotals.size > 2000) {
            const firstKey = this.completedStreakTotals.keys().next().value;
            if (firstKey) this.completedStreakTotals.delete(firstKey);
          }
        } else {
          this.processedStreakTotals.set(streakKey, repeatCount);
        }
      }

      const event: TikTokNormalizedEvent = {
        eventId: rawMsgId || `gift-${streakKey}-${repeatCount}-${repeatEnd ? 'end' : 'step'}-${now}`,
        type: 'gift',
        userId,
        username,
        nickname,
        avatarUrl,
        giftId,
        giftName,
        giftPictureUrl,
        giftCount: deltaCount,
        totalStreakCount: repeatCount,
        giftType,
        diamondCount,
        repeatEnd,
        streakKey,
        isStreakCompletionOnly,
        verifiedBackend: true,
        isDemo: false,
        timestamp: now,
      };
      this.dispatchNormalized(event);
    });

    conn.on(WebcastEvent.FOLLOW, (data: any) => {
      const { userId, username, nickname, avatarUrl } = this.extractUserFields(data);
      if (!userId) return;
      const now = Date.now();
      this.dispatchNormalized({
        eventId: String(data?.common?.msgId || `follow-${userId}-${now}`),
        type: 'follow',
        userId,
        username,
        nickname,
        avatarUrl,
        isDemo: false,
        timestamp: now,
      });
    });

    conn.on(WebcastEvent.LIKE, (data: any) => {
      const { userId, username, nickname, avatarUrl } = this.extractUserFields(data);
      if (!userId) return;
      const now = Date.now();
      const rawMsgId = data?.common?.msgId ? String(data.common.msgId) : '';
      if (rawMsgId) {
        if (this.processedMsgIds.has(rawMsgId)) return;
        this.processedMsgIds.add(rawMsgId);
      }

      const deltaLikes = Math.max(1, Math.min(500, Number(data?.likeCount || 1)));
      const prevTotal = this.userLikeTotals.get(userId) || 0;
      const nextTotal = prevTotal + deltaLikes;
      this.userLikeTotals.set(userId, nextTotal);

      this.dispatchNormalized({
        eventId: rawMsgId || `like-${userId}-${nextTotal}-${now}`,
        type: 'like',
        userId,
        username,
        nickname,
        avatarUrl,
        likeCount: deltaLikes,
        cumulativeUserLikes: nextTotal,
        verifiedBackend: true,
        isDemo: false,
        timestamp: now,
      });
    });

    conn.on(WebcastEvent.SHARE, (data: any) => {
      const { userId, username, nickname, avatarUrl } = this.extractUserFields(data);
      if (!userId) return;
      const now = Date.now();
      this.dispatchNormalized({
        eventId: String(data?.common?.msgId || `share-${userId}-${now}`),
        type: 'share',
        userId,
        username,
        nickname,
        avatarUrl,
        isDemo: false,
        timestamp: now,
      });
    });

    conn.on(WebcastEvent.MEMBER, (data: any) => {
      const { userId, username, nickname, avatarUrl } = this.extractUserFields(data);
      if (!userId) return;
      const now = Date.now();
      this.dispatchNormalized({
        eventId: String(data?.common?.msgId || `join-${userId}-${now}`),
        type: 'join',
        userId,
        username,
        nickname,
        avatarUrl,
        isDemo: false,
        timestamp: now,
      });
    });
  }

  public ingestExternalWebhookEvent(payload: Partial<TikTokNormalizedEvent>): TikTokNormalizedEvent | null {
    if (!payload.type || !payload.userId || !payload.username) {
      return null;
    }
    const now = Date.now();
    let comment = payload.comment;
    if (payload.type === 'comment') {
      const filtered = sanitizeAndFilterComment(String(comment || ''));
      if (!filtered) return null;
      comment = filtered;
    }

    const normalizedGiftId =
      payload.giftId !== undefined ? normalizeGiftId(payload.giftId) : undefined;
    if (payload.type === 'gift' && !normalizedGiftId) {
      return null;
    }

    let giftCount =
      payload.giftCount !== undefined ? Math.max(0, Math.round(Number(payload.giftCount))) : undefined;
    let totalStreakCount =
      payload.totalStreakCount !== undefined
        ? Math.max(1, Math.round(Number(payload.totalStreakCount)))
        : giftCount;
    let isStreakCompletionOnly = Boolean(payload.isStreakCompletionOnly);

    // Apply streak delta deduplication if a streakKey + giftType===1 is sent via webhook or demo broadcast
    if (payload.type === 'gift' && payload.giftType === 1 && payload.streakKey && totalStreakCount) {
      const sk = String(payload.streakKey);
      const completedMax = this.completedStreakTotals.get(sk);
      if (completedMax !== undefined && totalStreakCount <= completedMax) {
        return null;
      }
      const prev = this.processedStreakTotals.get(sk) || 0;
      const repEnd = Boolean(payload.repeatEnd);
      if (totalStreakCount < prev || (totalStreakCount === prev && !repEnd)) {
        return null;
      }
      giftCount = Math.max(0, totalStreakCount - prev);
      if (giftCount === 0 && repEnd) {
        isStreakCompletionOnly = true;
      }
      if (repEnd) {
        this.processedStreakTotals.delete(sk);
        this.completedStreakTotals.set(sk, totalStreakCount);
      } else {
        this.processedStreakTotals.set(sk, totalStreakCount);
      }
    }

    const normalized: TikTokNormalizedEvent = {
      eventId: String(payload.eventId || `ext-${payload.type}-${payload.userId}-${now}-${Math.random().toString(36).slice(2, 6)}`),
      type: payload.type,
      userId: String(payload.userId),
      username: String(payload.username).replace(/^@+/, ''),
      nickname: payload.nickname ? String(payload.nickname) : String(payload.username),
      avatarUrl: payload.avatarUrl,
      comment,
      giftId: normalizedGiftId,
      giftName: payload.giftName,
      giftPictureUrl: payload.giftPictureUrl,
      giftCount,
      totalStreakCount,
      giftType: payload.giftType,
      diamondCount: payload.diamondCount !== undefined ? Number(payload.diamondCount) : undefined,
      repeatEnd: payload.repeatEnd,
      streakKey: payload.streakKey,
      isStreakCompletionOnly,
      likeCount: payload.likeCount !== undefined ? Number(payload.likeCount) : undefined,
      cumulativeUserLikes:
        payload.cumulativeUserLikes !== undefined ? Number(payload.cumulativeUserLikes) : undefined,
      verifiedBackend: true,
      isDemo: Boolean(payload.isDemo),
      timestamp: payload.timestamp || now,
    };

    this.dispatchNormalized(normalized);
    return normalized;
  }

  private dispatchNormalized(event: TikTokNormalizedEvent) {
    this.incomingEventCount += 1;
    this.onEventCallback(event);
    if (this.incomingEventCount % 5 === 0 || this.incomingEventCount <= 5) {
      this.emitStatus();
    }
  }
}
