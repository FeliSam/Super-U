import type { MapMarker } from '@/constants/map';
import type { VehicleKind } from '@/lib/vehicleMotion';

const SVG: Record<VehicleKind | 'store' | 'home' | 'pin', string> = {
  moto: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="6.5" cy="17" r="2.2"/><circle cx="17.5" cy="17" r="2.2"/><path d="M8.5 17h5l2-6h-4L9 14H7l1.5 3zM14 11l2.5-4M16 7h3"/></svg>`,
  voiture: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8"><rect x="3" y="10" width="18" height="7" rx="2"/><path d="M6 10 8 6h8l2 4M7 17v1.5M17 17v1.5"/></svg>`,
  velo: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="6" cy="16" r="2.4"/><circle cx="17" cy="16" r="2.4"/><path d="M6 16h5l3-6h3M11 16 8 9h4"/></svg>`,
  tricycle: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="6" cy="17" r="2"/><circle cx="16" cy="17" r="1.8"/><circle cx="20" cy="17" r="1.8"/><path d="M6 17h6l3-7h4M15 10 12 17"/></svg>`,
  pied: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="12" cy="5" r="2"/><path d="M12 8v6m0 0-3 6m3-6 3 6M9 12h6"/></svg>`,
  store: `<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M4 10h16l-1 10H5L4 10zm1-2 2-5h10l2 5"/></svg>`,
  home: `<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M4 11 12 4l8 7v9H4z"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><circle cx="12" cy="10" r="4"/><path d="M12 14v7"/></svg>`,
};

export function mapPinHtml(
  marker: MapMarker,
  colors: { coral?: string; teal?: string; text?: string },
) {
  const kind = marker.kind ?? 'pin';
  const vehicle = (marker.vehicle ?? 'moto') as VehicleKind;
  const superU = kind === 'store';
  const bg =
    kind === 'home'
      ? colors.coral ?? '#e11d48'
      : kind === 'courier'
        ? '#111827'
        : superU
          ? '#e30613'
          : colors.teal ?? '#0f766e';
  const glyph = kind === 'courier' ? SVG[vehicle] ?? SVG.moto : SVG[kind === 'store' ? 'store' : kind === 'home' ? 'home' : 'pin'];
  const heading = kind === 'courier' && Number.isFinite(marker.heading) ? marker.heading : 0;
  const pulse = kind === 'courier' ? 'animation:cgPulse 1.6s ease-out infinite;' : '';
  const highlight = Boolean(marker.highlight);
  const count = Number(marker.badge ?? 0);
  const badge =
    count > 0
      ? `<span class="cg-badge" style="position:absolute;top:-6px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:${highlight ? '#0f766e' : '#111827'};color:#fff;border:2px solid #fff;font:800 11px/16px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(15,23,42,.35)">${count > 9 ? '9+' : count}</span>`
      : '';
  const waitBit = count > 0 ? ` · ${count} en attente` : '';
  const nearBit = highlight ? 'Plus proche · ' : '';
  const label = marker.label
    ? `<span style="background:${highlight ? '#0f766e' : 'rgba(17,24,39,0.9)'};color:#fff;font:700 10px/1.2 system-ui,sans-serif;padding:4px 8px;border-radius:999px;white-space:nowrap;max-width:168px;overflow:hidden;text-overflow:ellipsis">${nearBit}${marker.label}${waitBit}</span>`
    : '';
  return `<div class="cg-pin" data-kind="${kind}" style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translateY(-4px);will-change:transform;cursor:pointer">
    ${label}
    <span style="position:relative;width:${count || highlight ? 44 : 38}px;height:${count || highlight ? 44 : 38}px;border-radius:14px;background:${bg};border:${highlight ? '3px' : '2px'} solid ${highlight ? '#fbbf24' : '#fff'};display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(15,23,42,0.32);${pulse}transform:rotate(${heading}deg);transform-origin:center;transition:transform 280ms ease-out">
      ${glyph}${badge}
    </span>
  </div>
  <style>@keyframes cgPulse{0%{box-shadow:0 0 0 0 rgba(15,23,42,.35)}100%{box-shadow:0 0 0 12px rgba(15,23,42,0)}}</style>`;
}
