/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  BuddhaModelLoadStatus,
  DEFAULT_OVERLAY_SETTINGS,
  DEFAULT_VOICE_SETTINGS,
  GiftMapping,
  ServerConnectionSnapshot,
  StreamOverlaySettings,
  TikTokNormalizedEvent,
  VoiceSettings,
} from './types/temple';
import { GiftRegistrySnapshot, giftRegistry } from './systems/GiftRegistry';
import { liveConnectionManager } from './systems/LiveConnectionManager';
import {
  TempleCongregationState,
  tiktokEventManager,
} from './systems/TikTokEventManager';
import { voiceManager, VoiceStateSnapshot } from './systems/VoiceManager';
import {
  loadPersistedOverlaySettings,
  loadPersistedVoiceSettings,
  savePersistedOverlaySettings,
  savePersistedVoiceSettings,
} from './systems/OverlayTheme';
import {
  PRIMARY_DEMO_VIEWER,
  PrayerDemoTopic,
  clearPendingDemoBatches,
  createSampleFirstCommentEvent,
  createSampleFollowIncenseEvent,
  createSampleLikeMilestoneEvent,
  createSampleOrdinaryCommentEvent,
  createSamplePrayerCommentEvent,
  createSamplePrayerTopicEvent,
  createSampleRoseGiftSameAccountEvent,
  createSampleShareLanternEvent,
  scheduleDemoParticipantsBatch,
  scheduleGiftPriorityVoiceDemo,
  scheduleLeaderboardRanksDemo,
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
  const [registrySnapshot, setRegistrySnapshot] = useState<GiftRegistrySnapshot>(() =>
    giftRegistry.getSnapshot(),
  );
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() =>
    loadPersistedVoiceSettings(),
  );
  const [overlaySettings, setOverlaySettings] = useState<StreamOverlaySettings>(() => {
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const obsParam = Boolean(params?.get('obs') === '1' || params?.get('mode') === 'obs');
    return loadPersistedOverlaySettings(obsParam);
  });

  const [buddhaModelStatus, setBuddhaModelStatus] = useState<BuddhaModelLoadStatus>('builtin');
  const [buddhaModelDetail, setBuddhaModelDetail] = useState(
    'Đang sử dụng tôn tượng Đức Phật Vàng điêu khắc 3D tích hợp',
  );
  const [mobileAdminOpen, setMobileAdminOpen] = useState(false);

  const giftMappings = registrySnapshot.gifts;

  const handleBuddhaModelStatus = useCallback(
    (status: BuddhaModelLoadStatus, detail?: string) => {
      setBuddhaModelStatus(status);
      if (detail) setBuddhaModelDetail(detail);
    },
    [],
  );

  // Initialize Real-Time Socket.IO, Persistent GiftRegistry & Event Subscriptions
  useEffect(() => {
    liveConnectionManager.init();
    giftRegistry.init();

    voiceManager.updateSettings(voiceSettings);
    tiktokEventManager.setMaxParticipants(overlaySettings.maxParticipants);
    tiktokEventManager.setMaxConcurrentCeremonies(overlaySettings.maxConcurrentCeremonies);
    tiktokEventManager.setEffectsEnabled(overlaySettings.effectsEnabled);
    tiktokEventManager.setCeremonialPresentationSettings({
      centerPanelDurationMs: overlaySettings.centerPanelDuration,
    });
    tiktokEventManager.setInactivitySettings({
      enabled: overlaySettings.inactivityTimeoutEnabled,
      timeoutSec: overlaySettings.inactivityTimeoutSec,
      demoAccelerated: overlaySettings.demoAcceleratedTimeout,
    });

    const unsubRegistry = giftRegistry.subscribe(setRegistrySnapshot);
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
      unsubRegistry();
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

  // Trigger any configured ceremonial offering for PRIMARY_DEMO_VIEWER via exact normalized giftId
  const handleSimulateGiftMapping = useCallback(
    (mapping: GiftMapping) => {
      const now = Date.now();
      dispatchDemoEvent({
        eventId: `demo-ceremony-${mapping.giftId}-${now}`,
        type: 'gift',
        userId: PRIMARY_DEMO_VIEWER.userId,
        username: PRIMARY_DEMO_VIEWER.username,
        nickname: PRIMARY_DEMO_VIEWER.nickname,
        avatarUrl: PRIMARY_DEMO_VIEWER.avatarUrl,
        giftId: mapping.giftId,
        giftName: mapping.giftName,
        giftPictureUrl: mapping.uploadedImageData || mapping.iconUrl,
        giftCount: 1,
        diamondCount: mapping.referenceCoins || 1,
        isDemo: true,
        timestamp: now,
      });
    },
    [dispatchDemoEvent],
  );

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

  const handleSimulatePrayerTopic = useCallback(
    (topic: PrayerDemoTopic) => {
      dispatchDemoEvent(createSamplePrayerTopicEvent(topic, false));
    },
    [dispatchDemoEvent],
  );

  const handleUpdateGiftMappings = useCallback((next: GiftMapping[]) => {
    tiktokEventManager.setGiftMappings(next);
  }, []);

  const handleUpdateVoiceSettings = useCallback((next: VoiceSettings) => {
    setVoiceSettings(next);
    voiceManager.updateSettings(next);
    savePersistedVoiceSettings(next);
  }, []);

  const handleUpdateOverlaySettings = useCallback((next: StreamOverlaySettings) => {
    setOverlaySettings(next);
    savePersistedOverlaySettings(next);
    tiktokEventManager.setMaxParticipants(next.maxParticipants);
    tiktokEventManager.setMaxConcurrentCeremonies(next.maxConcurrentCeremonies);
    tiktokEventManager.setEffectsEnabled(next.effectsEnabled);
    tiktokEventManager.setCeremonialPresentationSettings({
      centerPanelDurationMs: next.centerPanelDuration,
    });
    tiktokEventManager.setInactivitySettings({
      enabled: next.inactivityTimeoutEnabled,
      timeoutSec: next.inactivityTimeoutSec,
      demoAccelerated: next.demoAcceleratedTimeout,
    });
  }, []);

  const handleManualRemoveInactive = useCallback(() => {
    return tiktokEventManager.removeInactiveParticipantsManual();
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
            currentSpeakerUserId={voiceSnapshot.currentSpeakerUserId}
            onBuddhaModelStatus={handleBuddhaModelStatus}
          />
          <StreamingOverlay
            participantsCount={congregation.activeParticipantCount}
            waitingCount={congregation.waitingOverflowCount}
            activeAltarCount={congregation.activeAltarCount}
            queuedAltarCount={congregation.queuedAltarCount}
            totalLikesCount={congregation.totalLikesCount}
            totalWoodenFishCount={congregation.totalWoodenFishCount}
            leaderboard={congregation.leaderboard}
            notifications={congregation.notifications}
            giftMappings={giftMappings}
            giftEventCounts={congregation.giftEventCounts}
            activeLotusBadges={congregation.activeLotusBadges}
            activeCenterAnnouncement={congregation.activeCenterAnnouncement}
            activeLotusBursts={congregation.activeLotusBursts}
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
            currentSpeakerUserId={voiceSnapshot.currentSpeakerUserId}
            onBuddhaModelStatus={handleBuddhaModelStatus}
          />
          <StreamingOverlay
            participantsCount={congregation.activeParticipantCount}
            waitingCount={congregation.waitingOverflowCount}
            activeAltarCount={congregation.activeAltarCount}
            queuedAltarCount={congregation.queuedAltarCount}
            totalLikesCount={congregation.totalLikesCount}
            totalWoodenFishCount={congregation.totalWoodenFishCount}
            leaderboard={congregation.leaderboard}
            notifications={congregation.notifications}
            giftMappings={giftMappings}
            giftEventCounts={congregation.giftEventCounts}
            activeLotusBadges={congregation.activeLotusBadges}
            activeCenterAnnouncement={congregation.activeCenterAnnouncement}
            activeLotusBursts={congregation.activeLotusBursts}
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
          className="lg:hidden absolute bottom-2 left-2 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#240a0e]/95 border border-[#d4af37]/55 text-[11px] font-semibold text-[#ffe082] shadow-lg cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Quản trị &amp; Demo</span>
        </button>
      </main>

      {/* DESKTOP ADMINISTRATOR DASHBOARD SIDEBAR */}
      <div className="hidden lg:block w-[460px] xl:w-[495px] h-full shrink-0">
        <AdminDashboard
          connectionSnapshot={connectionSnapshot}
          registrySnapshot={registrySnapshot}
          leaderboard={congregation.leaderboard}
          ceremonyQueueInspector={congregation.ceremonyQueueInspector}
          recentGiftLogs={congregation.recentGiftLogs}
          participantsCount={congregation.activeParticipantCount}
          departingCount={congregation.departingCount}
          sessionMeritUsersCount={congregation.sessionMeritUsersCount}
          departedUsersCount={congregation.departedUsersCount}
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
          buddhaModelStatus={buddhaModelStatus}
          buddhaModelDetail={buddhaModelDetail}
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
          onSimulatePrayerTopic={handleSimulatePrayerTopic}
          onSimulateOrdinaryComment={() => dispatchDemoEvent(createSampleOrdinaryCommentEvent())}
          onTestGiftPriorityVoice={() => scheduleGiftPriorityVoiceDemo(dispatchDemoEvent)}
          onPopulateLeaderboardDemo={() => scheduleLeaderboardRanksDemo(dispatchDemoEvent)}
          onAddParticipantsBatch={(count) =>
            scheduleDemoParticipantsBatch(count, dispatchDemoEvent)
          }
          onManualRemoveInactive={handleManualRemoveInactive}
          onCustomSimulatedEvent={dispatchDemoEvent}
          onResetDemo={handleResetDemo}
          onClearParticipants={handleClearParticipants}
          onResetSeating={handleResetSeating}
          onUpdateGiftMappings={handleUpdateGiftMappings}
          onUpdateVoiceSettings={handleUpdateVoiceSettings}
          onTestVoice={(sampleText) => voiceManager.testVoice(sampleText)}
          onClearVoiceQueue={() => voiceManager.stopAndClearQueue()}
          onEnableAudio={handleEnableAudio}
          onUpdateOverlaySettings={handleUpdateOverlaySettings}
        />
      </div>

      {/* MOBILE / TABLET SLIDE-OVER ADMINISTRATOR DRAWER */}
      {mobileAdminOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end bg-black/70">
          <div className="relative w-full max-w-[450px] h-full">
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
              registrySnapshot={registrySnapshot}
              leaderboard={congregation.leaderboard}
              ceremonyQueueInspector={congregation.ceremonyQueueInspector}
              recentGiftLogs={congregation.recentGiftLogs}
              participantsCount={congregation.activeParticipantCount}
              departingCount={congregation.departingCount}
              sessionMeritUsersCount={congregation.sessionMeritUsersCount}
              departedUsersCount={congregation.departedUsersCount}
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
              buddhaModelStatus={buddhaModelStatus}
              buddhaModelDetail={buddhaModelDetail}
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
              onSimulatePrayerTopic={handleSimulatePrayerTopic}
              onSimulateOrdinaryComment={() =>
                dispatchDemoEvent(createSampleOrdinaryCommentEvent())
              }
              onTestGiftPriorityVoice={() => scheduleGiftPriorityVoiceDemo(dispatchDemoEvent)}
              onPopulateLeaderboardDemo={() => scheduleLeaderboardRanksDemo(dispatchDemoEvent)}
              onAddParticipantsBatch={(count) =>
                scheduleDemoParticipantsBatch(count, dispatchDemoEvent)
              }
              onManualRemoveInactive={handleManualRemoveInactive}
              onCustomSimulatedEvent={dispatchDemoEvent}
              onResetDemo={handleResetDemo}
              onClearParticipants={handleClearParticipants}
              onResetSeating={handleResetSeating}
              onUpdateGiftMappings={handleUpdateGiftMappings}
              onUpdateVoiceSettings={handleUpdateVoiceSettings}
              onTestVoice={(sampleText) => voiceManager.testVoice(sampleText)}
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
