// Times and ages, as people read them.
import { t } from './i18n.svelte';

/** ageText is the age a title is for: "All ages", "12+"; nothing when unknown. */
export function ageText(years?: number): string {
  if (typeof years !== 'number' || !Number.isFinite(years) || years < 0) return '';
  return years === 0 ? t('age.all') : t('age.from', { age: years });
}

/** duration is a length: "1 h 42 min". */
export function duration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  return minutes >= 60
    ? t('time.hoursMinutes', { h: Math.floor(minutes / 60), m: minutes % 60 })
    : t('time.minutes', { m: minutes });
}

/** clock is a position: "1:02:03" or "2:03". */
export function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor(s / 60) % 60;
  const ss = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return hh ? `${hh}:${two(mm)}:${two(ss)}` : `${mm}:${two(ss)}`;
}
