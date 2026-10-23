// A title's users' score worth showing: TMDB's, from enough votes that it
// means something; null otherwise.
import type { TitleSummary } from './sdk/overfin.js';

const minVotes = 30;

export function score(title: Pick<TitleSummary, 'ratings'>): { value: string; votes: number } | null {
  const r = title.ratings?.find((x) => x.source === 'tmdb');
  if (!r || r.votes < minVotes) return null;
  return { value: r.value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), votes: r.votes };
}
