// Where the next playback starts, when the person just chose (resume, or
// from the start). After a reload there's no choice, and the SDK resumes
// where the profile left off.
import { go, replace } from './router.svelte';

let chosenStart: number | undefined;

/** play plays a title from positionMs; without it, where the profile left
 * off, as the server says when it starts. */
export function play(itemId: string, positionMs?: number) {
  chosenStart = positionMs;
  go(`/play/${itemId}`);
}

/** playInstead plays another title in the player's place (the next
 * episode): Back still leads where the player was opened from. */
export function playInstead(itemId: string, positionMs: number) {
  chosenStart = positionMs;
  replace(`/play/${itemId}`);
}

/** takeStart returns the chosen start, once. */
export function takeStart(): number | undefined {
  const start = chosenStart;
  chosenStart = undefined;
  return start;
}
