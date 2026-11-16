// The site's own dialogs, instead of the browser's prompt() and confirm():
// translated, styled, and usable with a TV remote.
export interface DialogRequest {
  kind: 'confirm' | 'pin' | 'notice';
  message: string;
  danger?: boolean;
  resolve: (value: string | boolean | null) => void;
}

export const dialog = $state<{ current: DialogRequest | null }>({ current: null });

// One at a time: one asked while another is open waits for it (replacing
// it would leave whoever asked first waiting forever).
let queue: Promise<unknown> = Promise.resolve();

function open(kind: DialogRequest['kind'], message: string, danger = false) {
  const shown = queue.then(() => new Promise<string | boolean | null>((resolve) => {
    dialog.current = { kind, message, danger, resolve };
  }));
  queue = shown.catch(() => {});
  return shown;
}

/** confirm asks yes or no. */
export async function confirm(message: string, danger = false): Promise<boolean> {
  return (await open('confirm', message, danger)) === true;
}

/** askPin asks for a PIN; null if the person cancels. */
export async function askPin(message: string): Promise<string | null> {
  const value = await open('pin', message);
  return typeof value === 'string' && value ? value : null;
}

/** notice tells something, until the person closes it. */
export async function notice(message: string): Promise<void> {
  await open('notice', message);
}
