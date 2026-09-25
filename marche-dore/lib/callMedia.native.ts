/**
 * Native WebRTC audio (iOS/Android) via react-native-webrtc.
 * Web path lives in callMedia.web.ts (browser getUserMedia + HTMLAudioElement).
 */
import { Platform } from 'react-native';
import {
  mediaDevices,
  MediaStream,
  RTCPeerConnection,
  RTCIceCandidate,
  type MediaStreamTrack,
} from 'react-native-webrtc';

type Signal = {
  id: number;
  signal_type: string;
  sender_kind?: string;
  payload: Record<string, unknown> | string | null;
};

type StartOpts = {
  callId: string;
  isCaller: boolean;
  selfKind: 'customer' | 'staff';
  localStream?: MediaStream | null;
  postSignal: (type: string, payload: unknown) => Promise<void>;
  fetchSignals: (afterId: number) => Promise<Signal[]>;
  onRemoteEnd?: () => void;
};

type Session = {
  callId: string;
  pc: RTCPeerConnection;
  local: MediaStream;
  remote: MediaStream | null;
  poll: ReturnType<typeof setInterval> | null;
  afterId: number;
  closed: boolean;
  remoteSet: boolean;
};

let session: Session | null = null;
let mediaGen = 0;
let speakerForced = false;

type InCallManagerLike = {
  start: (opts: { media?: string; auto?: boolean; ringback?: string }) => void;
  stop: (opts?: { busysound?: string }) => void;
  setForceSpeakerphoneOn: (flag: boolean | null) => void;
  setSpeakerphoneOn: (enable: boolean) => void;
  startRingtone: (ringtone: string) => void;
  stopRingtone: () => void;
  startRingback: (ringback: string) => void;
  stopRingback: () => void;
};

function getInCallManager(): InCallManagerLike | null {
  try {
    // Optional peer dep — audio still works if missing, speaker routing may not.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-incall-manager');
    return (mod?.default ?? mod) as InCallManagerLike;
  } catch {
    return null;
  }
}

function parsePayload(raw: Signal['payload']): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw;
}

function iceServers() {
  return [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
      ],
    },
  ];
}

function enableAudioTracks(stream: MediaStream | null | undefined) {
  if (!stream) return;
  stream.getAudioTracks().forEach((t: MediaStreamTrack) => {
    t.enabled = true;
  });
}

function applySpeaker(on: boolean) {
  speakerForced = on;
  const icm = getInCallManager();
  if (!icm) return;
  try {
    icm.setForceSpeakerphoneOn(on ? true : false);
    if (Platform.OS === 'android') {
      icm.setSpeakerphoneOn(on);
    }
  } catch {
    /* ignore */
  }
}

function startAudioSession() {
  const icm = getInCallManager();
  if (!icm) return;
  try {
    icm.start({ media: 'audio', auto: true });
    applySpeaker(speakerForced);
  } catch {
    /* ignore */
  }
}

function stopAudioSession() {
  const icm = getInCallManager();
  if (!icm) return;
  try {
    icm.stop();
  } catch {
    /* ignore */
  }
}

export function primeCallAudio() {
  startAudioSession();
}

export function unlockAudio() {
  primeCallAudio();
}

export async function captureLocalMic(): Promise<MediaStream> {
  // Native: never require secure context / HTTPS (fixes TestFlight IP/false isSecureContext).
  const stream = (await mediaDevices.getUserMedia({
    audio: true,
    video: false,
  })) as unknown as MediaStream;
  enableAudioTracks(stream);
  return stream;
}

export function startRingtone(kind: 'in' | 'out') {
  stopRingtone();
  const icm = getInCallManager();
  if (!icm) return;
  try {
    if (kind === 'in') {
      icm.startRingtone('_DEFAULT_');
    } else {
      // Outgoing ringback tone
      icm.startRingback('_BUNDLE_');
    }
  } catch {
    try {
      icm.startRingtone('_DEFAULT_');
    } catch {
      /* ignore */
    }
  }
}

export function stopRingtone() {
  const icm = getInCallManager();
  if (!icm) return;
  try {
    icm.stopRingtone();
  } catch {
    /* ignore */
  }
  try {
    icm.stopRingback();
  } catch {
    /* ignore */
  }
}

function asIce(payload: Record<string, unknown>): RTCIceCandidateInit | null {
  const nested = payload.candidate;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as RTCIceCandidateInit;
  }
  if (typeof payload.candidate === 'string') {
    return {
      candidate: payload.candidate,
      sdpMid: typeof payload.sdpMid === 'string' ? payload.sdpMid : null,
      sdpMLineIndex: typeof payload.sdpMLineIndex === 'number' ? payload.sdpMLineIndex : 0,
      usernameFragment:
        typeof payload.usernameFragment === 'string' ? payload.usernameFragment : undefined,
    };
  }
  return null;
}

function attachRemote(stream: MediaStream) {
  enableAudioTracks(stream);
  if (session) session.remote = stream;
}

export function resumeCallPlayback() {
  startAudioSession();
  if (session?.remote) enableAudioTracks(session.remote);
  for (const recv of session?.pc.getReceivers() ?? []) {
    const track = recv.track as MediaStreamTrack | null;
    if (track?.kind === 'audio') track.enabled = true;
  }
}

export function updateCallMedia(opts: {
  muted?: boolean;
  held?: boolean;
  speakerOn?: boolean;
  live?: boolean;
}) {
  if (!session) {
    if (typeof opts.speakerOn === 'boolean') applySpeaker(opts.speakerOn);
    return;
  }
  const send = opts.live !== false && !opts.muted && !opts.held;
  for (const track of session.local.getAudioTracks()) {
    track.enabled = send;
  }
  if (session.remote) {
    const play = opts.live !== false && !opts.held;
    session.remote.getAudioTracks().forEach((t: MediaStreamTrack) => {
      t.enabled = play;
    });
  }
  if (typeof opts.speakerOn === 'boolean') applySpeaker(opts.speakerOn);
}

export function stopCallMedia() {
  mediaGen += 1;
  stopRingtone();
  if (!session) {
    stopAudioSession();
    return;
  }
  session.closed = true;
  if (session.poll) clearInterval(session.poll);
  try {
    session.local.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
  try {
    session.remote?.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
  try {
    session.pc.close();
  } catch {
    /* ignore */
  }
  session = null;
  stopAudioSession();
}

export async function startCallMedia(opts: StartOpts) {
  if (session && session.callId === opts.callId && !session.closed) {
    resumeCallPlayback();
    return;
  }
  const gen = ++mediaGen;
  stopCallMedia();
  mediaGen = gen;

  startAudioSession();
  const local = (opts.localStream ?? (await captureLocalMic())) as MediaStream;
  if (gen !== mediaGen) {
    local.getTracks().forEach((t) => t.stop());
    return;
  }

  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  const pendingIce: RTCIceCandidateInit[] = [];
  local.getAudioTracks().forEach((track) => {
    track.enabled = true;
    pc.addTrack(track, local);
  });

  const s: Session = {
    callId: opts.callId,
    pc,
    local,
    remote: null,
    poll: null,
    afterId: 0,
    closed: false,
    remoteSet: false,
  };
  session = s;

  const takeRemoteTracks = () => {
    for (const recv of pc.getReceivers()) {
      const track = recv.track as MediaStreamTrack | null;
      if (track?.kind === 'audio') {
        track.enabled = true;
        attachRemote(new MediaStream([track]));
      }
    }
  };

  // react-native-webrtc: remote audio plays when tracks are enabled (no HTMLAudioElement / RTCView needed for audio-only).
  // @ts-expect-error RN WebRTC event typing
  pc.ontrack = (ev: { track: MediaStreamTrack; streams: MediaStream[] }) => {
    ev.track.enabled = true;
    const stream = ev.streams[0] ?? new MediaStream([ev.track]);
    attachRemote(stream);
    // @ts-expect-error
    ev.track.onunmute = () => {
      attachRemote(stream);
    };
  };

  // @ts-expect-error
  pc.onicecandidate = (ev: { candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null; usernameFragment?: string | null } | null }) => {
    if (s.closed || !ev.candidate) return;
    void opts.postSignal('ice', {
      candidate: ev.candidate.candidate,
      sdpMid: ev.candidate.sdpMid,
      sdpMLineIndex: ev.candidate.sdpMLineIndex,
      usernameFragment: ev.candidate.usernameFragment,
    });
  };

  // @ts-expect-error
  pc.onconnectionstatechange = () => {
    if (s.closed) return;
    // @ts-expect-error
    if (pc.connectionState === 'connected') takeRemoteTracks();
  };
  // @ts-expect-error
  pc.oniceconnectionstatechange = () => {
    if (s.closed) return;
    // @ts-expect-error
    const st = pc.iceConnectionState;
    if (st === 'connected' || st === 'completed') takeRemoteTracks();
    if (st === 'failed') {
      try {
        // @ts-expect-error
        pc.restartIce?.();
      } catch {
        /* ignore */
      }
    }
  };

  const applyIce = async (cand: RTCIceCandidateInit) => {
    if (!cand.candidate) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(cand));
    } catch {
      try {
        await pc.addIceCandidate(cand);
      } catch {
        /* ignore */
      }
    }
  };

  const handle = async (sig: Signal) => {
    if (s.closed || session !== s) return;
    if (sig.sender_kind && sig.sender_kind === opts.selfKind) return;
    if (sig.signal_type === 'hangup' || sig.signal_type === 'reject') {
      opts.onRemoteEnd?.();
      return;
    }
    const payload = parsePayload(sig.payload);
    if (sig.signal_type === 'offer' && !opts.isCaller) {
      const sdp = String(payload.sdp ?? '');
      if (!sdp || s.remoteSet) return;
      await pc.setRemoteDescription({ type: 'offer', sdp });
      s.remoteSet = true;
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await opts.postSignal('answer', { type: 'answer', sdp: answer.sdp });
      takeRemoteTracks();
      const queued = pendingIce.splice(0, pendingIce.length);
      for (const c of queued) await applyIce(c);
    }
    if (sig.signal_type === 'answer' && opts.isCaller) {
      const sdp = String(payload.sdp ?? '');
      if (!sdp || s.remoteSet) return;
      await pc.setRemoteDescription({ type: 'answer', sdp });
      s.remoteSet = true;
      const queued = pendingIce.splice(0, pendingIce.length);
      for (const c of queued) await applyIce(c);
      takeRemoteTracks();
    }
    if (sig.signal_type === 'ice') {
      const cand = asIce(payload);
      if (!cand) return;
      if (s.remoteSet) await applyIce(cand);
      else pendingIce.push(cand);
    }
  };

  if (opts.isCaller) {
    // Local mic track already added → Unified Plan negotiates sendrecv audio.
    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);
    await opts.postSignal('offer', { type: 'offer', sdp: offer.sdp });
  }

  let pulling = false;
  const pull = async () => {
    if (s.closed || session !== s || pulling) return;
    pulling = true;
    try {
      const rows = await opts.fetchSignals(s.afterId);
      for (const row of rows) {
        s.afterId = Math.max(s.afterId, Number(row.id) || 0);
        try {
          await handle(row);
        } catch {
          /* signal isolé */
        }
      }
    } catch {
      /* réseau */
    } finally {
      pulling = false;
    }
  };
  await pull();
  if (s.closed || session !== s) return;
  s.poll = setInterval(() => void pull(), 180);
}
