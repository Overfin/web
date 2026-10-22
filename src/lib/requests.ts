// Asking for a title no library has: the request, or why it failed, said
// to the person.
import type { TitleSummary } from './sdk/overfin.js';
import { explain, overfin } from './client';
import { notice } from './dialog.svelte';

/** ask requests a title (a season or an episode: its season; a series:
 * every season), and returns the request covering it, or null when it
 * failed (the person is told why). */
export async function ask(titleId: string, seasons?: number[]): Promise<TitleSummary['request'] | null> {
  try {
    const made = await overfin.requestTitle(titleId, seasons);
    return { id: made.id, status: made.status };
  } catch (err) {
    await notice(explain(err));
    return null;
  }
}
