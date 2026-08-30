import type { MapMarker } from '@/constants/map';
import type { VehicleKind } from '@/lib/vehicleMotion';

const SVG: Record<string, string> = {
  moto: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="6.5" cy="17" r="2.2"/><circle cx="17.5" cy="17" r="2.2"/><path d="M8.5 17h5l2-6h-4L9 14H7l1.5 3zM14 11l2.5-4M16 7h3"/></svg>`,
  voiture: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8"><rect x="3" y="10" width="18" height="7" rx="2"/><path d="M6 10 8 6h8l2 4M7 17v1.5M17 17v1.5"/></svg>`,
  velo: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="6" cy="16" r="2.4"/><circle cx="17" cy="16" r="2.4"/><path d="M6 16h5l3-6h3M11 16 8 9h4"/></svg>`,
  tricycle: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="6" cy="17" r="2"/><circle cx="16" cy="17" r="1.8"/><circle cx="20" cy="17" r="1.8"/><path d="M6 17h6l3-7h4M15 10 12 17"/></svg>`,
  pied: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="12" cy="5" r="2"/><path d="M12 8v6m0 0-3 6m3-6 3 6M9 12h6"/></svg>`,
};

export function shopCourierPinHtml(marker: MapMarker, bg: string) {
  const vehicle = (marker.vehicle ?? 'moto') as VehicleKind;
  const heading = Number.isFinite(marker.heading) ? marker.heading : 0;
  const glyph = SVG[vehicle] ?? SVG.moto;
  const label = marker.label
    ? `<span style="background:rgba(20,17,15,0.82);color:#fff;font:600 10px/1.2 system-ui,sans-serif;padding:4px 8px;border-radius:999px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis">${marker.label}</span>`
    : '';
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translateY(-4px)">
    ${label}
    <span style="width:38px;height:38px;border-radius:14px;background:${bg};border:2px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(0,0,0,0.32);transform:rotate(${heading}deg);transition:transform 280ms ease-out">${glyph}</span>
  </div>`;
}
