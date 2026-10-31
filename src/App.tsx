/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  DEFAULT_GIFT_MAPPINGS,
  DEFAULT_OVERLAY_SETTINGS,
  DEFAULT_VOICE_SETTINGS,
  GiftMapping,
  ServerConnectionSnapshot,
  StreamOverlaySettings,
  TikTokNormalizedEvent,
  VoiceSettings,
} from './types/temple';
import { liveConnectionManager } from './systems/LiveConnectionManager';
import {
  TempleCongregationState,
  tiktokEventManager,
} from './systems/TikTokEventManager';
import { voiceManager, VoiceStateSnapshot } from './systems/VoiceManager';
import {
  PRIMARY_DEMO_VIEWER,
  clearPendingDemoBatches,
  createSampleFirstCommentEvent,
  createSampleFollowIncenseEvent,
  createSampleLikeMilestoneEvent,
  createSamplePrayerCommentEvent,
  createSampleRoseGiftSameAccountEvent,
  createSampleShareLanternEvent,
  scheduleDemoParticipantsBatch,
} from './systems/DemoEventManager';
import { TempleScene } from './components/three/TempleScene';
import { StreamingOverlay } from './components/ui/StreamingOverlay';
import { AdminDashboard } from './components/ui/AdminDashboard';

export default function App() {
  const [congregation, setCongregation] = useState<TempleCongregationState>(() =>
    tiktokEventManager.getSnapshot(),
  );
  const [connectionSnapshot, setConnectionSnapshot] = useState<ServerConnectionSnapshot>(() =>
    liveConnectionManager.getSnapshot(),
  );
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceStateSnapshot>(() =>
    voiceManager.getSnapshot(),
  );
  const [giftMappings, setGiftMappings] = useState<GiftMapping[]>(() => [
    ...DEFAULT_GIFT_MAPPINGS,
  ]);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => ({
    ...DEFAULT_VOICE_SETTINGS,
  }));
  const [overlaySettings, setOverlaySettings] = useState<StreamOverlaySettings>(() => {
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const obsParam = params?.get('obs') === '1' || params?.get('mode') === 'obs';
    return {
      ...DEFAULT_OVERLAY_SETTINGS,
      obsCleanView: Boolean(obsParam),
    };
  });

  const [mobileAdminOpen, setMobileAdminOpen] = useState(false);

  // Initialize Real-Time Socket.IO & Event Subscriptions
  useEffect(() => {
    liveConnectionManager.init();

    const unsubCongregation = tiktokEventManager.subscribe(setCongregation);
    const unsubStatus = liveConnectionManager.onStatus(setConnectionSnapshot);
    const unsubVoice = voiceManager.subscribe(setVoiceSnapshot);

    const unsubLiveEvents = liveConnectionManager.onEvent((event: TikTokNormalizedEvent) => {
      tiktokEventManager.processEvent(event);
    });

    const unsubAdminCmd = liveConnectionManager.onAdminCommand((cmd) => {
      if (cmd.action === 'clear_participants') {
        clearPendingDemoBatches();
        tiktokEventManager.clearParticipants();
      } else if (cmd.action === 'reset_seating') {
        tiktokEventManager.resetSeating();
      }
    });

    // Initial launch demonstration: spawns 1 worshipper walking to their seat, then standing up to offer Hoa Hồng at the Buddha Altar and returning to the exact same seat
    const params = new URLSearchParams(window.location.search);
    let demoIntroTimer1: number | undefined;
    let demoIntroTimer2: number | undefined;
    if (params.get('empty') !== '1') {
      demoIntroTimer1 = window.setTimeout(() => {
        if (tiktokEventManager.getSnapshot().participants.length === 0) {
          tiktokEventManager.processEvent(createSampleFirstCommentEvent());
        }
      }, 900);

      demoIntroTimer2 = window.setTimeout(() => {
        const snap = tiktokEventManager.getSnapshot();
        if (snap.participants.length === 1 && snap.participants[0].giftCount === 0) {
          tiktokEventManager.processEvent(createSampleRoseGiftSameAccountEvent());
        }
      }, 8600);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOverlaySettings((prev) =>
          prev.obsCleanView ? { ...prev, obsCleanView: false } : prev,
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      if (demoIntroTimer1) window.clearTimeout(demoIntroTimer1);
      if (demoIntroTimer2) window.clearTimeout(demoIntroTimer2);
      clearPendingDemoBatches();
      unsubCongregation();
      unsubStatus();
      unsubVoice();
      unsubLiveEvents();
      unsubAdminCmd();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const dispatchDemoEvent = useCallback((ev: TikTokNormalizedEvent) => {
    liveConnectionManager.broadcastDemoEvent(ev);
  }, []);

  const handleEnableAudio = useCallback(() => {
    voiceManager.enableAudio();
  }, []);

  // Trigger any of the 5 configured ceremonial offerings for PRIMARY_DEMO_VIEWER
  const handleSimulateGiftMapping = useCallback(
    (mapping: GiftMapping) => {
      const now = Date.now();
      dispatchDemoEvent({
        eventId: `demo-ceremony-${mapping.id}-${now}`,
        type: 'gift',
        userId: PRIMARY_DEMO_VIEWER.userId,
        username: PRIMARY_DEMO_VIEWER.username,
        nickname: PRIMARY_DEMO_VIEWER.nickname,
        avatarUrl: PRIMARY_DEMO_VIEWER.avatarUrl,
        giftId: mapping.giftId,
        giftName: mapping.giftName,
        giftCount: 1,
        diamondCount: mapping.referenceCoins || 1,
        isDemo: true,
        timestamp: now,
      });
    },
    [dispatchDemoEvent],
  );

  // Trigger 10, 100, or 1000 Likes on an existing seated character (never spawning from likes alone in LIVE;
  // in Demo mode if the hall was cleared empty, seats PRIMARY_DEMO_VIEWER first so the test button works seamlessly)
  const handleSimulateLikeMilestone = useCallback(
    (likes: 10 | 100 | 1000) => {
      const snap = tiktokEventManager.getSnapshot();
      const primary = snap.participants.find((p) => p.userId === PRIMARY_DEMO_VIEWER.userId);
      const target = primary || snap.participants[0];

      if (!target) {
        dispatchDemoEvent(createSampleFirstCommentEvent());
        window.setTimeout(() => {
          dispatchDemoEvent(createSampleLikeMilestoneEvent(likes, PRIMARY_DEMO_VIEWER));
        }, 450);
        return;
      }

      dispatchDemoEvent(
        createSampleLikeMilestoneEvent(likes, {
          userId: target.userId,
          username: target.username,
          nickname: target.nickname,
          avatarUrl: target.avatarUrl,
        }),
      );
    },
    [dispatchDemoEvent],
  );

  const handleUpdateGiftMappings = useCallback((next: GiftMapping[]) => {
    setGiftMappings(next);
    tiktokEventManager.setGiftMappings(next);
  }, []);

  const handleUpdateVoiceSettings = useCallback((next: VoiceSettings) => {
    setVoiceSettings(next);
    voiceManager.updateSettings(next);
  }, []);

  const handleUpdateOverlaySettings = useCallback((next: StreamOverlaySettings) => {
    setOverlaySettings(next);
    tiktokEventManager.setMaxParticipants(next.maxParticipants);
    tiktokEventManager.setMaxConcurrentCeremonies(next.maxConcurrentCeremonies);
    tiktokEventManager.setEffectsEnabled(next.effectsEnabled);
  }, []);

  const handleClearParticipants = useCallback(() => {
    clearPendingDemoBatches();
    tiktokEventManager.clearParticipants();
    liveConnectionManager.broadcastAdminCommand('clear_participants');
  }, []);

  const handleResetSeating = useCallback(() => {
    tiktokEventManager.resetSeating();
    liveConnectionManager.broadcastAdminCommand('reset_seating');
  }, []);

  const handleResetDemo = useCallback(() => {
    clearPendingDemoBatches();
    voiceManager.stopAndClearQueue();
    tiktokEventManager.clearParticipants();
    liveConnectionManager.broadcastAdminCommand('clear_participants');
    window.setTimeout(() => {
      dispatchDemoEvent(createSampleFirstCommentEvent());
    }, 450);
  }, [dispatchDemoEvent]);

  // FULL-SCREEN OBS STREAMING CLEAN VIEW (No Admin Controls)
  if (overlaySettings.obsCleanView) {
    return (
      <main className="w-screen h-screen bg-[#090503] flex items-center justify-center overflow-hidden">
        <div
          className={
            overlaySettings.vertical916
              ? 'relative h-full aspect-[9/16] max-w-full overflow-hidden shadow-2xl bg-[#130804]'
              : 'relative w-full h-full overflow-hidden bg-[#130804]'
          }
        >
          <TempleScene
            participants={congregation.participants}
            activeEffects={congregation.activeEffects}
            altarGlowUntil={congregation.altarGlowUntil}
            bellRingUntil={congregation.bellRingUntil}
            incenseGlowUntil={congregation.incenseGlowUntil}
            fruitGlowUntil={congregation.fruitGlowUntil}
            lotusGlowUntil={congregation.lotusGlowUntil}
            pagodaGlowUntil={congregation.pagodaGlowUntil}
            floatingLanternCount={congregation.floatingLanternCount}
            overlaySettings={overlaySettings}
          />
          <StreamingOverlay
            participantsCount={congregation.participants.length}
            waitingCount={congregation.waitingOverflowCount}
            activeAltarCount={congregation.activeAltarCount}
            queuedAltarCount={congregation.queuedAltarCount}
            totalLikesCount={congregation.totalLikesCount}
            totalWoodenFishCount={congregation.totalWoodenFishCount}
            leaderboard={congregation.leaderboard}
            giftMappings={giftMappings}
            giftEventCounts={congregation.giftEventCounts}
            activeLotusBadges={congregation.activeLotusBadges}
            notifications={congregation.notifications}
            prominentGiftBanner={congregation.prominentGiftBanner}
            connectionSnapshot={connectionSnapshot}
            voiceSnapshot={voiceSnapshot}
            overlaySettings={overlaySettings}
            onEnableAudio={handleEnableAudio}
            onTriggerDemoGift={handleSimulateGiftMapping}
            onToggleObsCleanView={() =>
              handleUpdateOverlaySettings({
                ...overlaySettings,
                obsCleanView: false,
              })
            }
          />
        </div>
      </main>
    );
  }

  // STUDIO MODE: Left/Center 9:16 Vertical TikTok LIVE Viewport + Right Administrator Control Panel
  return (
    <div className="w-screen h-screen bg-[#0a0503] flex flex-col lg:flex-row overflow-hidden">
      <main className="relative flex-1 h-full flex items-center justify-center bg-gradient-to-b from-[#160a06] to-[#080402] p-0 sm:p-3 overflow-hidden">
        <div
          className={
            overlaySettings.vertical916
              ? 'relative h-full max-h-full aspect-[9/16] max-w-full sm:rounded-xl sm:border sm:border-[#d4af37]/45 overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.88)] bg-[#130804]'
              : 'relative w-full h-full sm:rounded-xl sm:border sm:border-[#d4af37]/45 overflow-hidden bg-[#130804]'
          }
        >
          <TempleScene
            participants={congregation.participants}
            activeEffects={congregation.activeEffects}
            altarGlowUntil={congregation.altarGlowUntil}
            bellRingUntil={congregation.bellRingUntil}
            incenseGlowUntil={congregation.incenseGlowUntil}
            fruitGlowUntil={congregation.fruitGlowUntil}
            lotusGlowUntil={congregation.lotusGlowUntil}
            pagodaGlowUntil={congregation.pagodaGlowUntil}
            floatingLanternCount={congregation.floatingLanternCount}
            overlaySettings={overlaySettings}
          />
          <StreamingOverlay
            participantsCount={congregation.participants.length}
            waitingCount={congregation.waitingOverflowCount}
            activeAltarCount={congregation.activeAltarCount}
            queuedAltarCount={congregation.queuedAltarCount}
            totalLikesCount={congregation.totalLikesCount}
            totalWoodenFishCount={congregation.totalWoodenFishCount}
            leaderboard={congregation.leaderboard}
            giftMappings={giftMappings}
            giftEventCounts={congregation.giftEventCounts}
            activeLotusBadges={congregation.activeLotusBadges}
            notifications={congregation.notifications}
            prominentGiftBanner={congregation.prominentGiftBanner}
            connectionSnapshot={connectionSnapshot}
            voiceSnapshot={voiceSnapshot}
            overlaySettings={overlaySettings}
            onEnableAudio={handleEnableAudio}
            onTriggerDemoGift={handleSimulateGiftMapping}
            onToggleObsCleanView={() =>
              handleUpdateOverlaySettings({
                ...overlaySettings,
                obsCleanView: true,
              })
            }
          />
        </div>

        <button
          type="button"
          onClick={() => setMobileAdminOpen(true)}
          className="lg:hidden absolute bottom-3 left-3 z-30 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#240a0e]/95 border border-[#d4af37]/55 text-xs font-semibold text-[#ffe082] shadow-lg cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Quản trị &amp; Demo</span>
        </button>
      </main>

      {/* DESKTOP ADMINISTRATOR DASHBOARD SIDEBAR */}
      <div className="hidden lg:block w-[435px] xl:w-[465px] h-full shrink-0">
        <AdminDashboard
          connectionSnapshot={connectionSnapshot}
          participantsCount={congregation.participants.length}
          occupiedMainSeats={congregation.occupiedMainSeats}
          waitingOverflowCount={congregation.waitingOverflowCount}
          totalEventsProcessed={congregation.totalEventsProcessed}
          totalLikesCount={congregation.totalLikesCount}
          totalWoodenFishCount={congregation.totalWoodenFishCount}
          giftMappings={giftMappings}
          giftEventCounts={congregation.giftEventCounts}
          voiceSettings={voiceSettings}
          voiceSnapshot={voiceSnapshot}
          overlaySettings={overlaySettings}
          onConnectTikTok={async (u) => {
            await liveConnectionManager.connectTikTok(u);
          }}
          onDisconnectTikTok={async () => {
            await liveConnectionManager.disconnectTikTok(true);
          }}
          onSimulateFirstComment={() => dispatchDemoEvent(createSampleFirstCommentEvent())}
          onSimulateLikeMilestone={handleSimulateLikeMilestone}
          onSimulateGiftMapping={handleSimulateGiftMapping}
          onSimulateFollowIncense={() => dispatchDemoEvent(createSampleFollowIncenseEvent())}
          onSimulateShareLantern={() => dispatchDemoEvent(createSampleShareLanternEvent())}
          onSimulatePrayerComment={() => dispatchDemoEvent(createSamplePrayerCommentEvent(true))}
          onAddParticipantsBatch={(count) =>
            scheduleDemoParticipantsBatch(count, dispatchDemoEvent)
          }
          onCustomSimulatedEvent={dispatchDemoEvent}
          onResetDemo={handleResetDemo}
          onClearParticipants={handleClearParticipants}
          onResetSeating={handleResetSeating}
          onUpdateGiftMappings={handleUpdateGiftMappings}
          onUpdateVoiceSettings={handleUpdateVoiceSettings}
          onTestVoice={() => voiceManager.testVoice()}
          onClearVoiceQueue={() => voiceManager.stopAndClearQueue()}
          onEnableAudio={handleEnableAudio}
          onUpdateOverlaySettings={handleUpdateOverlaySettings}
        />
      </div>

      {/* MOBILE / TABLET SLIDE-OVER ADMINISTRATOR DRAWER */}
      {mobileAdminOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end bg-black/70">
          <div className="relative w-full max-w-[425px] h-full">
            <button
              type="button"
              onClick={() => setMobileAdminOpen(false)}
              aria-label="Đóng bảng quản trị"
              className="absolute top-3 right-3 z-10 p-2 rounded-lg bg-[#290c11] border border-white/15 text-[#ffe082]"
            >
              <X className="w-4 h-4" />
            </button>
            <AdminDashboard
              connectionSnapshot={connectionSnapshot}
              participantsCount={congregation.participants.length}
              occupiedMainSeats={congregation.occupiedMainSeats}
              waitingOverflowCount={congregation.waitingOverflowCount}
              totalEventsProcessed={congregation.totalEventsProcessed}
              totalLikesCount={congregation.totalLikesCount}
              totalWoodenFishCount={congregation.totalWoodenFishCount}
              giftMappings={giftMappings}
              giftEventCounts={congregation.giftEventCounts}
              voiceSettings={voiceSettings}
              voiceSnapshot={voiceSnapshot}
              overlaySettings={overlaySettings}
              onConnectTikTok={async (u) => {
                await liveConnectionManager.connectTikTok(u);
              }}
              onDisconnectTikTok={async () => {
                await liveConnectionManager.disconnectTikTok(true);
              }}
              onSimulateFirstComment={() => dispatchDemoEvent(createSampleFirstCommentEvent())}
              onSimulateLikeMilestone={handleSimulateLikeMilestone}
              onSimulateGiftMapping={handleSimulateGiftMapping}
              onSimulateFollowIncense={() => dispatchDemoEvent(createSampleFollowIncenseEvent())}
              onSimulateShareLantern={() => dispatchDemoEvent(createSampleShareLanternEvent())}
              onSimulatePrayerComment={() =>
                dispatchDemoEvent(createSamplePrayerCommentEvent(true))
              }
              onAddParticipantsBatch={(count) =>
                scheduleDemoParticipantsBatch(count, dispatchDemoEvent)
              }
              onCustomSimulatedEvent={dispatchDemoEvent}
              onResetDemo={handleResetDemo}
              onClearParticipants={handleClearParticipants}
              onResetSeating={handleResetSeating}
              onUpdateGiftMappings={handleUpdateGiftMappings}
              onUpdateVoiceSettings={handleUpdateVoiceSettings}
              onTestVoice={() => voiceManager.testVoice()}
              onClearVoiceQueue={() => voiceManager.stopAndClearQueue()}
              onEnableAudio={handleEnableAudio}
              onUpdateOverlaySettings={handleUpdateOverlaySettings}
            />
          </div>
        </div>
      )}
    </div>
  );
}
