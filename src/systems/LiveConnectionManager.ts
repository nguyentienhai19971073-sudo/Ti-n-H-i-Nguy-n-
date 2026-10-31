import { io, Socket } from 'socket.io-client';
import {
  ConnectionStatus,
  GiftActionPreset,
  GiftMapping,
  ServerConnectionSnapshot,
  TikTokNormalizedEvent,
  UnknownGiftRecord,
} from '../types/temple';

type EventSubscriber = (event: TikTokNormalizedEvent) => void;
type StatusSubscriber = (snapshot: ServerConnectionSnapshot) => void;
type AdminCmdSubscriber = (cmd: { action: string; payload?: any }) => void;
type GiftsUpdatedSubscriber = (payload: {
  gifts: GiftMapping[];
  presets: GiftActionPreset[];
}) => void;
type UnknownGiftsSubscriber = (payload: { unknownGifts: UnknownGiftRecord[] }) => void;

export class LiveConnectionManager {
  private socket: Socket | null = null;
  private snapshot: ServerConnectionSnapshot = {
    status: ConnectionStatus.DEMO,
    tiktokUsername: '',
    incomingEventCount: 0,
    receiverActive: false,
    isCloudRuntime: true,
    availableServerTts: {
      vieneuCloudKeyConfigured: false,
      vieneuCloudEndpoint: 'https://api.vieneu.io/api/v1/audio/speech',
      vieneuLocalEndpoint: 'http://127.0.0.1:8000/v1/audio/speech',
      gemini: false,
      elevenlabs: false,
      openai: false,
    },
  };

  private eventSubscribers = new Set<EventSubscriber>();
  private statusSubscribers = new Set<StatusSubscriber>();
  private adminCmdSubscribers = new Set<AdminCmdSubscriber>();
  private giftsSubscribers = new Set<GiftsUpdatedSubscriber>();
  private unknownGiftsSubscribers = new Set<UnknownGiftsSubscriber>();

  public init(): void {
    if (this.socket) return;

    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 8000,
    });

    this.socket = socket;

    socket.on('tiktok:status', (snap: ServerConnectionSnapshot) => {
      this.snapshot = snap;
      this.notifyStatus();
    });

    socket.on('tiktok:event', (ev: TikTokNormalizedEvent) => {
      for (const sub of this.eventSubscribers) {
        sub(ev);
      }
    });

    socket.on('temple:admin_command', (cmd: { action: string; payload?: any }) => {
      for (const sub of this.adminCmdSubscribers) {
        sub(cmd);
      }
    });

    socket.on('gifts:updated', (payload: { gifts: GiftMapping[]; presets: GiftActionPreset[] }) => {
      if (payload && Array.isArray(payload.gifts)) {
        for (const sub of this.giftsSubscribers) {
          sub(payload);
        }
      }
    });

    socket.on('gifts:unknown_updated', (payload: { unknownGifts: UnknownGiftRecord[] }) => {
      if (payload && Array.isArray(payload.unknownGifts)) {
        for (const sub of this.unknownGiftsSubscribers) {
          sub(payload);
        }
      }
    });

    // Initial health fetch
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        if (data?.connection) {
          this.snapshot = data.connection;
          this.notifyStatus();
        }
      })
      .catch(() => {
        // Stay in local DEMO mode cleanly if offline
      });
  }

  public getSnapshot(): ServerConnectionSnapshot {
    return this.snapshot;
  }

  private notifyStatus(): void {
    for (const sub of this.statusSubscribers) {
      sub(this.snapshot);
    }
  }

  public onEvent(cb: EventSubscriber): () => void {
    this.eventSubscribers.add(cb);
    return () => this.eventSubscribers.delete(cb);
  }

  public onStatus(cb: StatusSubscriber): () => void {
    this.statusSubscribers.add(cb);
    cb(this.snapshot);
    return () => this.statusSubscribers.delete(cb);
  }

  public onAdminCommand(cb: AdminCmdSubscriber): () => void {
    this.adminCmdSubscribers.add(cb);
    return () => this.adminCmdSubscribers.delete(cb);
  }

  public onGiftsUpdated(cb: GiftsUpdatedSubscriber): () => void {
    this.giftsSubscribers.add(cb);
    return () => this.giftsSubscribers.delete(cb);
  }

  public onUnknownGiftsUpdated(cb: UnknownGiftsSubscriber): () => void {
    this.unknownGiftsSubscribers.add(cb);
    return () => this.unknownGiftsSubscribers.delete(cb);
  }

  public async connectTikTok(username: string): Promise<ServerConnectionSnapshot> {
    const res = await fetch('/api/tiktok/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    const snap: ServerConnectionSnapshot = data?.snapshot || data;
    if (snap && snap.status) {
      this.snapshot = snap;
      this.notifyStatus();
    }
    return this.snapshot;
  }

  public async disconnectTikTok(switchToDemo = false): Promise<ServerConnectionSnapshot> {
    const res = await fetch('/api/tiktok/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ switchToDemo }),
    });
    const snap: ServerConnectionSnapshot = await res.json();
    if (snap && snap.status) {
      this.snapshot = snap;
      this.notifyStatus();
    }
    return this.snapshot;
  }

  public broadcastDemoEvent(event: TikTokNormalizedEvent): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('temple:broadcast_demo_event', event);
    } else {
      for (const sub of this.eventSubscribers) {
        sub(event);
      }
    }
  }

  public broadcastAdminCommand(action: string, payload?: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('temple:admin_command', { action, payload });
    }
  }
}

export const liveConnectionManager = new LiveConnectionManager();
