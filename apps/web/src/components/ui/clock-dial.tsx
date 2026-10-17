import { useState } from 'react';

import { cn } from '@/lib/utils';

export interface Time {
  h: number;
  m: number;
}

// Geometria do mostrador (viewBox 256×256): anel externo 0–11, interno 12–23.
const SIZE = 256;
const C = SIZE / 2;
const R_OUTER = 100;
const R_INNER = 64;
const KNOB = 18;
const CENTER_ORIGIN = {
  transformBox: 'view-box',
  transformOrigin: `${C}px ${C}px`,
} as const;

// eslint-disable-next-line react-refresh/only-export-components
export function parseTime(str: string): Time | undefined {
  const match = str.trim().match(/^(\d{1,2}):?(\d{2})(?::\d{2})?$/);
  if (!match) return undefined;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  return h > 23 || m > 59 ? undefined : { h, m };
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatTime({ h, m }: Time): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Converte um ponto (coordenadas do viewBox) em hora (0–23) ou minuto (0–59). */
// eslint-disable-next-line react-refresh/only-export-components
export function pointToValue(x: number, y: number, mode: 'hour' | 'minute'): number {
  const dx = x - C;
  const dy = y - C;
  const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  if (mode === 'minute') return Math.round(deg / 6) % 60;
  const h = Math.round(deg / 30) % 12;
  return Math.hypot(dx, dy) < (R_OUTER + R_INNER) / 2 ? h + 12 : h;
}

function polar(index: number, steps: number, r: number) {
  const a = (index / steps) * 2 * Math.PI;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
}

// eslint-disable-next-line react-refresh/only-export-components
export function now(): Time {
  const d = new Date();
  return { h: d.getHours(), m: d.getMinutes() };
}

interface ClockDialProps {
  mode: 'hour' | 'minute';
  time: Time;
  onSelect: (v: number) => void;
  onRelease: () => void;
  label: string;
}

export function ClockDial({ mode, time, onSelect, onRelease, label }: ClockDialProps) {
  const [dragging, setDragging] = useState(false);
  const selected = mode === 'hour' ? time.h : time.m;
  const deg = mode === 'hour' ? (time.h % 12) * 30 : time.m * 6;
  const handR = mode === 'hour' && time.h >= 12 ? R_INNER : R_OUTER;

  // Rotação acumulada: gira pelo menor caminho (11h → 0h não dá a volta inteira).
  const [rot, setRot] = useState(deg);
  if (((rot % 360) + 360) % 360 !== deg) {
    setRot(rot + ((((deg - rot) % 360) + 540) % 360) - 180);
  }

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE;
    onSelect(pointToValue(x, y, mode));
  };

  const labels =
    mode === 'hour'
      ? Array.from({ length: 24 }, (_, h) => ({
          v: h,
          text: String(h).padStart(2, '0'),
          ...polar(h % 12, 12, h >= 12 ? R_INNER : R_OUTER),
          inner: h >= 12,
        }))
      : Array.from({ length: 12 }, (_, i) => ({
          v: i * 5,
          text: String(i * 5).padStart(2, '0'),
          ...polar(i * 5, 60, R_OUTER),
          inner: false,
        }));

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={label}
      className="mx-auto block h-64 w-64 cursor-pointer touch-none select-none"
      onPointerDown={(e) => {
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e) => dragging && pick(e)}
      onPointerUp={() => {
        if (!dragging) return;
        setDragging(false);
        onRelease();
      }}
      onPointerCancel={() => setDragging(false)}
    >
      <circle cx={C} cy={C} r={C - 2} className="fill-muted" />
      {/* Troca de modo remonta o grupo: números e ponteiro entram com pop-in. */}
      <g key={mode} className="animate-pop-in" style={CENTER_ORIGIN}>
        <circle cx={C} cy={C} r={4} className="fill-primary" />
        {/* Ponteiro desenhado para cima e girado; clique anima, arraste segue o dedo. */}
        <g
          className={cn(!dragging && 'transition-transform')}
          style={{ ...CENTER_ORIGIN, transform: `rotate(${rot}deg)` }}
        >
          <line
            x1={C}
            y1={C}
            x2={C}
            y2={C - handR}
            className="stroke-primary"
            strokeWidth={2}
          />
          <circle cx={C} cy={C - handR} r={KNOB} className="fill-primary" />
          {mode === 'minute' && time.m % 5 !== 0 && (
            <circle cx={C} cy={C - handR} r={3} className="fill-primary-foreground" />
          )}
        </g>
        {labels.map((l) => (
          <text
            key={l.v}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            dominantBaseline="central"
            className={cn(
              'pointer-events-none',
              l.inner ? 'text-[11px]' : 'text-[13px]',
              l.v === selected
                ? 'fill-primary-foreground font-semibold'
                : l.inner
                  ? 'fill-muted-foreground'
                  : 'fill-foreground'
            )}
          >
            {l.text}
          </text>
        ))}
      </g>
    </svg>
  );
}
