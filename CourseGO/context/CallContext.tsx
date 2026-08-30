import {
  acceptCall,
  cancelCall,
  hangupCall,
  startCall,
  fetchLiveCall,
  rejectCall,
  type CommsCall,
} from '@/lib/api/comms';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [remote, setRemote] = useState<CommsCall | null>(null);
  const [peerName, setPeerName] = useState('');
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [controls, setControls] = useState<CallControls>(IDLE);
  const missTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startingRef = useRef(false);

  const clearMiss = () => {
    if (missTimer.current) clearTimeout(missTimer.current);
    missTimer.current = null;
  };

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
            setPhase((prev) => {
              if (prev === 'idle') return prev;
              setRemote(null);
              setControls(IDLE);
              return 'idle';
            });
            return;
          }
          setRemote(live);
          if (live.peer_name?.trim()) setPeerName(live.peer_name.trim());
          const next = phaseFromLive(live);
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
    const t = setInterval(poll, 1000);
    return () => clearInterval(t);
  }, []);

  const startOutgoing = useCallback(async (threadId: string, peerNameValue: string) => {
    if (phase !== 'idle') return;
    startingRef.current = true;
    setControls(IDLE);
    setElapsedSec(0);
    setPeerName(peerNameValue);
    setPhase('outgoing');
    try {
      const res = await startCall(threadId, 'audio');
      setRemote(res.call);
      setPhase(res.call.status === 'accepted' ? 'active' : 'outgoing');
      clearMiss();
      if (res.call.status === 'accepted') return;
      missTimer.current = setTimeout(() => {
        void hangupCall(res.call.id).catch(() => undefined);
        setPhase('idle');
        setRemote(null);
      }, 25000);
    } catch {
      setPhase('idle');
      setRemote(null);
    } finally {
      startingRef.current = false;
    }
  }, [phase]);

  const accept = useCallback(async () => {
    if (!remote) return;
    const res = await acceptCall(remote.id);
    setRemote(res.call);
    setPhase('active');
    clearMiss();
  }, [remote]);

  const decline = useCallback(async () => {
    if (!remote) return;
    await rejectCall(remote.id).catch(() => undefined);
    setPhase('idle');
    setRemote(null);
    setControls(IDLE);
    clearMiss();
  }, [remote]);

  const hangupFn = useCallback(async () => {
    if (!remote) return;
    if (phase === 'outgoing') await cancelCall(remote.id).catch(() => hangupCall(remote.id));
    else await hangupCall(remote.id).catch(() => undefined);
    setPhase('idle');
    setRemote(null);
    setControls(IDLE);
    clearMiss();
  }, [remote, phase]);

  const value = useMemo<Value>(
    () => ({
      call: remote ? { id: remote.id, threadId: remote.thread_id, peerName } : null,
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
