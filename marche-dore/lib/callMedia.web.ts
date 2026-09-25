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
  remoteEl: HTMLAudioElement;
  poll: ReturnType<typeof setInterval> | null;
  playIv: ReturnType<typeof setInterval> | null;
  afterId: number;
  closed: boolean;
  remoteSet: boolean;
  audioSrc: MediaStreamAudioSourceNode | null;
  outGain: GainNode | null;
};

let session: Session | null = null;
let ring: { ctx: AudioContext; stop: () => void } | null = null;
let outCtx: AudioContext | null = null;
let mediaGen = 0;

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

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!outCtx || outCtx.state === 'closed') outCtx = new Ctx();
  void outCtx.resume().catch(() => undefined);
  return outCtx;
}

function ensureAudioEl(): HTMLAudioElement | null {
  if (typeof document === 'undefined') return null;
  const id = 'superu-remote-audio';
  let el = document.getElementById(id) as HTMLAudioElement | null;
  if (!el) {
    el = document.createElement('audio');
    el.id = id;
    el.autoplay = true;
    el.controls = false;
    el.preload = 'auto';
    el.defaultMuted = false;
    el.muted = false;
    el.volume = 1;
    el.setAttribute('playsinline', 'true');
    el.setAttribute('webkit-playsinline', 'true');
    el.setAttribute('autoplay', 'true');
    el.style.cssText =
      'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:1';
    document.body.appendChild(el);
  }
  el.muted = false;
  el.volume = 1;
  return el;
}

function partial(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  dur: number,
  gain: number,
  type: OscillatorType,
  filterHz: number,
) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterHz, time);
  filter.Q.value = 0.85;
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), time + 0.014);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * 0.42), time + Math.min(0.09, dur * 0.28));
  amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(filter);
  filter.connect(amp);
  amp.connect(dest);
  osc.start(time);
  osc.stop(time + dur + 0.03);
}

function bell(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number, gain: number) {
  partial(ctx, dest, time, freq, dur, gain, 'sine', 3800);
  partial(ctx, dest, time, freq * 2.004, dur * 0.62, gain * 0.2, 'sine', 6200);
  partial(ctx, dest, time, freq * 0.5, dur * 1.15, gain * 0.1, 'triangle', 1600);
}

function ringBus(ctx: AudioContext) {
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  master.gain.value = 0.9;
  comp.threshold.value = -16;
  comp.knee.value = 10;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.004;
  comp.release.value = 0.14;
  master.connect(comp);
  comp.connect(ctx.destination);
  return { master, disconnect: () => { master.disconnect(); comp.disconnect(); } };
}

function shopIncoming(ctx: AudioContext, dest: AudioNode, t0: number) {
  bell(ctx, dest, t0, 783.99, 0.22, 0.16);
  bell(ctx, dest, t0 + 0.13, 659.25, 0.22, 0.15);
  bell(ctx, dest, t0 + 0.26, 587.33, 0.26, 0.14);
  bell(ctx, dest, t0 + 0.52, 392.0, 0.7, 0.11);
  bell(ctx, dest, t0 + 0.52, 493.88, 0.7, 0.1);
  bell(ctx, dest, t0 + 0.52, 587.33, 0.62, 0.09);
  bell(ctx, dest, t0 + 0.58, 783.99, 0.42, 0.08);
}

function shopOutgoing(ctx: AudioContext, dest: AudioNode, t0: number) {
  bell(ctx, dest, t0, 392.0, 0.95, 0.1);
  bell(ctx, dest, t0, 587.33, 0.95, 0.09);
  bell(ctx, dest, t0 + 1.18, 392.0, 0.95, 0.1);
  bell(ctx, dest, t0 + 1.18, 587.33, 0.95, 0.09);
}

export function primeCallAudio() {
  const ctx = audioContext();
  const el = ensureAudioEl();
  if (el) void el.play().catch(() => undefined);
  if (!ctx) return;
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
  } catch {
    /* ignore */
  }
}

export function unlockAudio() {
  primeCallAudio();
}

export async function captureLocalMic() {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new Error('Les appels web nécessitent localhost ou HTTPS (pas une IP brute).');
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Micro indisponible dans ce navigateur.');
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });
}

export function startRingtone(kind: 'in' | 'out') {
  stopRingtone();
  const ctx = audioContext();
  if (!ctx) return;
  const bus = ringBus(ctx);
  let live = true;
  const burst = () => {
    if (!live) return;
    const t0 = ctx.currentTime + 0.03;
    if (kind === 'in') shopIncoming(ctx, bus.master, t0);
    else shopOutgoing(ctx, bus.master, t0);
  };
  burst();
  const iv = setInterval(burst, kind === 'in' ? 2900 : 3800);
  ring = {
    ctx,
    stop: () => {
      live = false;
      clearInterval(iv);
      const now = ctx.currentTime;
      try {
        bus.master.gain.cancelScheduledValues(now);
        bus.master.gain.setValueAtTime(bus.master.gain.value, now);
        bus.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        try {
          bus.disconnect();
        } catch {
          /* ignore */
        }
      }, 140);
    },
  };
}

export function stopRingtone() {
  ring?.stop();
  ring = null;
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
      usernameFragment: typeof payload.usernameFragment === 'string' ? payload.usernameFragment : undefined,
    };
  }
  return null;
}

function attachRemote(stream: MediaStream, remoteEl: HTMLAudioElement) {
  stream.getAudioTracks().forEach((t) => {
    t.enabled = true;
  });
  if (remoteEl.srcObject !== stream) remoteEl.srcObject = stream;
  remoteEl.muted = false;
  remoteEl.defaultMuted = false;
  remoteEl.volume = 1;
  void remoteEl.play().catch(() => undefined);
  void audioContext()?.resume().catch(() => undefined);
}

export function resumeCallPlayback() {
  primeCallAudio();
  const el = session?.remoteEl ?? ensureAudioEl();
  if (!el) return;
  el.muted = false;
  el.volume = 1;
  void el.play().catch(() => undefined);
  void audioContext()?.resume().catch(() => undefined);
}

function applyCallOutput(speakerOn: boolean) {
  const el = session?.remoteEl ?? (typeof document !== 'undefined' ? ensureAudioEl() : null);
  if (!el) return;
  el.volume = 1;
  const setSink = (el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }).setSinkId;
  if (typeof setSink !== 'function') return;
  void (async () => {
    try {
      if (speakerOn) {
        await setSink.call(el, '');
        return;
      }
      let sink = 'communications';
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const ear = devices.find(
          (d) =>
            d.kind === 'audiooutput' &&
            /earpiece|écouteur|ecouteur|receiver|handset|headset|headphone|écouteurs|communications/i.test(d.label),
        );
        if (ear?.deviceId) sink = ear.deviceId;
      }
      await setSink.call(el, sink);
    } catch {
      try {
        await setSink.call(el, speakerOn ? '' : 'communications');
      } catch {
        /* navigateur sans routage écouteur / HP */
      }
    }
  })();
}

export function updateCallMedia(opts: {
  muted?: boolean;
  held?: boolean;
  speakerOn?: boolean;
  live?: boolean;
}) {
  if (!session) return;
  const send = opts.live !== false && !opts.muted && !opts.held;
  for (const track of session.local.getAudioTracks()) track.enabled = send;
  session.remoteEl.muted = Boolean(opts.held) || opts.live === false;
  applyCallOutput(Boolean(opts.speakerOn));
  void session.remoteEl.play().catch(() => undefined);
  void audioContext()?.resume().catch(() => undefined);
}

export function stopCallMedia() {
  mediaGen += 1;
  if (!session) return;
  session.closed = true;
  if (session.poll) clearInterval(session.poll);
  if (session.playIv) clearInterval(session.playIv);
  try {
    session.audioSrc?.disconnect();
  } catch {
    /* ignore */
  }
  try {
    session.outGain?.disconnect();
  } catch {
    /* ignore */
  }
  session.local.getTracks().forEach((t) => t.stop());
  session.pc.close();
  session.remoteEl.pause();
  session.remoteEl.srcObject = null;
  session = null;
}

export async function startCallMedia(opts: StartOpts) {
  if (session && session.callId === opts.callId && !session.closed) {
    resumeCallPlayback();
    return;
  }
  const gen = ++mediaGen;
  stopCallMedia();
  mediaGen = gen;
  const RTC = typeof window !== 'undefined' ? window.RTCPeerConnection : undefined;
  if (!RTC) throw new Error('WebRTC indisponible dans ce navigateur.');

  primeCallAudio();
  const local = opts.localStream ?? (await captureLocalMic());
  if (gen !== mediaGen) {
    local.getTracks().forEach((t) => t.stop());
    return;
  }
  const remoteEl = ensureAudioEl();
  if (!remoteEl) {
    local.getTracks().forEach((t) => t.stop());
    return;
  }

  const pc = new RTC({
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun.cloudflare.com:3478',
        ],
      },
    ],
  });
  const pendingIce: RTCIceCandidateInit[] = [];
  local.getAudioTracks().forEach((track) => {
    track.enabled = true;
    pc.addTrack(track, local);
  });

  const s: Session = {
    callId: opts.callId,
    pc,
    local,
    remoteEl,
    poll: null,
    playIv: null,
    afterId: 0,
    closed: false,
    remoteSet: false,
    audioSrc: null,
    outGain: (() => {
      const ctx = audioContext();
      if (!ctx) return null;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(ctx.destination);
      return g;
    })(),
  };
  session = s;
  applyCallOutput(false);

  const kickPlay = () => {
    if (s.closed) return;
    remoteEl.muted = false;
    if (remoteEl.srcObject) void remoteEl.play().catch(() => undefined);
    void audioContext()?.resume().catch(() => undefined);
  };
  s.playIv = setInterval(kickPlay, 400);

  const takeRemoteTracks = () => {
    for (const recv of pc.getReceivers()) {
      if (recv.track?.kind === 'audio') {
        recv.track.enabled = true;
        attachRemote(new MediaStream([recv.track]), remoteEl);
      }
    }
  };

  pc.ontrack = (ev) => {
    ev.track.enabled = true;
    const stream = ev.streams[0] ?? new MediaStream([ev.track]);
    attachRemote(stream, remoteEl);
    kickPlay();
    ev.track.onunmute = () => {
      attachRemote(stream, remoteEl);
      kickPlay();
    };
  };

  pc.onicecandidate = (ev) => {
    if (s.closed || !ev.candidate) return;
    void opts.postSignal('ice', {
      candidate: ev.candidate.candidate,
      sdpMid: ev.candidate.sdpMid,
      sdpMLineIndex: ev.candidate.sdpMLineIndex,
      usernameFragment: ev.candidate.usernameFragment,
    });
  };

  pc.onconnectionstatechange = () => {
    if (s.closed) return;
    if (pc.connectionState === 'connected') {
      takeRemoteTracks();
      kickPlay();
    }
  };
  pc.oniceconnectionstatechange = () => {
    if (s.closed) return;
    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
      takeRemoteTracks();
      kickPlay();
    }
    if (pc.iceConnectionState === 'failed') {
      try {
        pc.restartIce();
      } catch {
        /* ignore */
      }
    }
  };

  const applyIce = async (cand: RTCIceCandidateInit) => {
    if (!cand.candidate) return;
    try {
      await pc.addIceCandidate(cand);
    } catch {
      /* ignore */
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
      kickPlay();
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
      kickPlay();
    }
    if (sig.signal_type === 'ice') {
      const cand = asIce(payload);
      if (!cand) return;
      if (s.remoteSet) await applyIce(cand);
      else pendingIce.push(cand);
    }
  };

  if (opts.isCaller) {
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
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
