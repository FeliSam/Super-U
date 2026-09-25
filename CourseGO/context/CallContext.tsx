import {
  acceptCall,
  cancelCall,
  hangupCall,
  startCall,
  fetchLiveCall,
  rejectCall,
  fetchCallSignals,
  postCallSignal,
  type CommsCall,
} from '@/lib/api/comms';
import { useStaffPrefs } from '@/context/StaffPrefsContext';
import { isCallSignal, isLiveConnected, subscribeLive } from '@/lib/live';
import { showToast } from '@/lib/toastBus';
import {
  startCallMedia,
  stopCallMedia,
  startRingtone,
  stopRingtone,
  updateCallMedia,
  primeCallAudio,
  unlockAudio,
  resumeCallPlayback,
  captureLocalMic,
} from '@/lib/callMedia';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

const IS_WEB = Platform.OS === 'web';

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'active';

export type CallControls = {
  muted: boolean;
  speakerOn: boolean;
  onHold: boolean;
  videoOn: boolean;
  keypadOpen: boolean;
  minimized: boolean;
};

const IDLE: CallControls = {
  muted: false,
  speakerOn: false,
  onHold: false,
  videoOn: false,
  keypadOpen: false,
  minimized: false,
};

function phaseFromLive(live: CommsCall): CallPhase {
  if (live.status === 'accepted') return 'active';
  if (live.role === 'callee') return 'incoming';
  return 'outgoing';
}

type Value = {
  call: { id: string; threadId: string; peerName: string } | null;
  phase: CallPhase;
  elapsedSec: number;
  controls: CallControls;
  startOutgoing: (threadId: string, peerName: string) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleHold: () => void;
  toggleVideo: () => void;
  toggleKeypad: () => void;
  minimize: () => void;
  expand: () => void;
};

const Ctx = createContext<Value | null>(null);

function safeStopMedia() {
  try {
    stopCallMedia();
  } catch {
    /* native / no WebRTC */
  }
}

function safeStopRing() {
  try {
    stopRingtone();
  } catch {
    /* ignore */
  }
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { prefs } = useStaffPrefs();
  const [remote, setRemote] = useState<CommsCall | null>(null);
  const [peerName, setPeerName] = useState('');
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [controls, setControls] = useState<CallControls>(IDLE);
  const missTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startingRef = useRef(false);
  const phaseRef = useRef<CallPhase>('idle');
  const remoteRef = useRef<CommsCall | null>(null);
  const mediaFor = useRef<string | null>(null);
  remoteRef.current = remote;
  phaseRef.current = phase;

  const clearMiss = () => {
    if (missTimer.current) clearTimeout(missTimer.current);
    missTimer.current = null;
  };

  const resetCall = useCallback(() => {
    safeStopMedia();
    safeStopRing();
    mediaFor.current = null;
    clearMiss();
    setRemote(null);
    setControls(IDLE);
    setPhase('idle');
  }, []);

  useEffect(() => {
    if (phase !== 'active' || !remote?.answered_at || controls.onHold) return;
    const start = new Date(remote.answered_at).getTime();
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [phase, remote?.answered_at, controls.onHold]);

  useEffect(() => {
    const poll = () => {
      void fetchLiveCall()
        .then((res) => {
          const live = res.call;
          if (!live?.id) {
            if (startingRef.current) return;
            if (phaseRef.current === 'idle') return;
            resetCall();
            return;
          }
          setRemote(live);
          if (live.peer_name?.trim()) setPeerName(live.peer_name.trim());
          const next = phaseFromLive(live);
          if (next === 'active') clearMiss();
          setPhase((prev) => {
            if (prev !== 'active' && next === 'active') {
              setControls((c) => ({ ...c, minimized: true, keypadOpen: false }));
            }
            if (next === 'incoming' || next === 'outgoing') {
              setControls((c) => ({ ...c, minimized: false }));
            }
            return next;
          });
        })
        .catch(() => undefined);
    };
    poll();
    // Sans appel en cours et flux temps réel ouvert : la sonnerie arrive par signal, relecture toutes les 3 s.
    let lastPoll = Date.now();
    const tick = () => {
      const idle = phaseRef.current === 'idle' && !startingRef.current;
      if (idle && isLiveConnected() && Date.now() - lastPoll < 3000) return;
      lastPoll = Date.now();
      poll();
    };
    const t = setInterval(tick, 400);
    const unsub = subscribeLive((s) => {
      if (!isCallSignal(s)) return;
      lastPoll = Date.now();
      poll();
    });
    return () => {
      clearInterval(t);
      unsub();
    };
  }, [resetCall]);

  // Web-only: unlock AudioContext after first gesture. RN exposes a `window`
  // polyfill without addEventListener — calling it crashes boot.
  useEffect(() => {
    if (!IS_WEB || typeof window === 'undefined') return;
    if (typeof window.addEventListener !== 'function') return;
    const unlock = () => {
      try {
        unlockAudio();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => {
      if (typeof window.removeEventListener === 'function') {
        window.removeEventListener('pointerdown', unlock);
      }
    };
  }, []);

  useEffect(() => {
    if (!IS_WEB) return;
    if (!prefs.sound) {
      safeStopRing();
      return;
    }
    try {
      if (phase === 'incoming') startRingtone('in');
      else if (phase === 'outgoing') startRingtone('out');
      else safeStopRing();
    } catch {
      /* Web Audio missing */
    }
  }, [phase, prefs.sound]);

  useEffect(() => {
    if (!IS_WEB) return;
    const id = remote?.id;
    if (!id || phase === 'idle') {
      if (mediaFor.current) {
        safeStopMedia();
        mediaFor.current = null;
      }
      return;
    }
    if (phase !== 'active') return;
    if (mediaFor.current === id) return;
    void startCallMedia({
      callId: id,
      isCaller: remote.role === 'caller',
      selfKind: 'staff',
      postSignal: (type, payload) => postCallSignal(id, type, payload).then(() => undefined),
      fetchSignals: async (afterId) => (await fetchCallSignals(id, afterId)).signals ?? [],
      onRemoteEnd: () => resetCall(),
    })
      .then(() => {
        mediaFor.current = id;
      })
      .catch(() => {
        if (mediaFor.current === id) mediaFor.current = null;
      });
  }, [remote?.id, remote?.role, phase, resetCall]);

  useEffect(() => {
    if (!IS_WEB) return;
    try {
      updateCallMedia({
        muted: controls.muted,
        held: controls.onHold,
        speakerOn: controls.speakerOn,
        live: phase === 'active',
      });
      if (phase === 'active') resumeCallPlayback();
    } catch {
      /* ignore */
    }
  }, [controls.muted, controls.onHold, controls.speakerOn, phase]);

  const startOutgoing = useCallback(
    async (threadId: string, peerNameValue: string) => {
      if (phaseRef.current !== 'idle') return;
      if (IS_WEB) {
        try {
          primeCallAudio();
        } catch {
          /* ignore */
        }
      }
      startingRef.current = true;
      setControls(IDLE);
      setElapsedSec(0);
      setPeerName(peerNameValue);
      setPhase('outgoing');
      try {
        const res = await startCall(threadId, 'audio');
        mediaFor.current = null;
        setRemote(res.call);
        setPhase(res.call.status === 'accepted' ? 'active' : 'outgoing');
        clearMiss();
        if (res.call.status === 'accepted') return;
        missTimer.current = setTimeout(() => {
          if (phaseRef.current === 'active') return;
          void hangupCall(res.call.id).catch(() => undefined);
          setPhase('idle');
          setRemote(null);
        }, 45000);
      } catch (e) {
        showToast({
          title: 'Appel',
          body: e instanceof Error ? e.message : 'Impossible de démarrer l’appel.',
          tone: 'error',
        });
        setPhase('idle');
        setRemote(null);
      } finally {
        startingRef.current = false;
      }
    },
    [],
  );

  const accept = useCallback(async () => {
    if (!remote) return;
    if (!IS_WEB) {
      try {
        const res = await acceptCall(remote.id);
        setRemote(res.call);
        setPhase('active');
        clearMiss();
      } catch (e) {
        showToast({
          title: 'Appel',
          body: e instanceof Error ? e.message : 'Impossible de décrocher.',
          tone: 'error',
        });
      }
      return;
    }
    try {
      primeCallAudio();
      resumeCallPlayback();
    } catch {
      /* ignore */
    }
    const id = remote.id;
    try {
      const local = await captureLocalMic();
      await startCallMedia({
        callId: id,
        isCaller: false,
        localStream: local,
        selfKind: 'staff',
        postSignal: (type, payload) => postCallSignal(id, type, payload).then(() => undefined),
        fetchSignals: async (afterId) => (await fetchCallSignals(id, afterId)).signals ?? [],
        onRemoteEnd: () => resetCall(),
      });
      mediaFor.current = id;
      const res = await acceptCall(id);
      setRemote(res.call);
      setPhase('active');
      clearMiss();
      resumeCallPlayback();
    } catch (e) {
      showToast({
        title: 'Appel',
        body: e instanceof Error ? e.message : 'Impossible de décrocher.',
        tone: 'error',
      });
    }
  }, [remote, resetCall]);

  const decline = useCallback(async () => {
    const id = remoteRef.current?.id;
    if (!id) return;
    void postCallSignal(id, 'reject', {}).catch(() => undefined);
    await rejectCall(id).catch(() => undefined);
    resetCall();
  }, [resetCall]);

  const hangupFn = useCallback(async () => {
    const id = remoteRef.current?.id;
    if (!id) {
      resetCall();
      return;
    }
    const outgoing = phaseRef.current === 'outgoing';
    void postCallSignal(id, 'hangup', {}).catch(() => undefined);
    if (outgoing) await cancelCall(id).catch(() => hangupCall(id));
    else await hangupCall(id).catch(() => undefined);
    resetCall();
  }, [resetCall]);

  const value = useMemo<Value>(
    () => ({
      call:
        phase !== 'idle'
          ? {
              id: remote?.id ?? 'pending',
              threadId: remote?.thread_id ?? '',
              peerName: peerName || remote?.peer_name || 'Client',
            }
          : null,
      phase,
      elapsedSec,
      controls,
      startOutgoing,
      accept,
      decline,
      hangup: hangupFn,
      toggleMute: () => setControls((c) => ({ ...c, muted: !c.muted })),
      toggleSpeaker: () => setControls((c) => ({ ...c, speakerOn: !c.speakerOn })),
      toggleHold: () => setControls((c) => ({ ...c, onHold: !c.onHold })),
      toggleVideo: () => setControls((c) => ({ ...c, videoOn: !c.videoOn })),
      toggleKeypad: () => setControls((c) => ({ ...c, keypadOpen: !c.keypadOpen })),
      minimize: () => setControls((c) => ({ ...c, minimized: true })),
      expand: () => setControls((c) => ({ ...c, minimized: false })),
    }),
    [remote, peerName, phase, elapsedSec, controls, startOutgoing, accept, decline, hangupFn],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCall() {
  const v = useContext(Ctx);
  if (!v) throw new Error('CallProvider missing');
  return v;
}
