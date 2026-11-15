// A short message with "Undo", after an action that can be taken back
// (Not interested): it goes by itself after a few seconds.

export interface UndoOffer {
  message: string;
  undo: () => void | Promise<void>;
}

export const undoState = $state<{ current: UndoOffer | null }>({ current: null });

let timer: ReturnType<typeof setTimeout> | undefined;

/** offerUndo shows message with an Undo button, for about 8 seconds. */
export function offerUndo(message: string, undo: () => void | Promise<void>) {
  clearTimeout(timer);
  const offer = { message, undo };
  undoState.current = offer;
  timer = setTimeout(() => {
    if (undoState.current === offer) undoState.current = null;
  }, 8000);
}

/** undoNow takes the action back and closes the message. */
export async function undoNow() {
  const offer = undoState.current;
  clearTimeout(timer);
  undoState.current = null;
  await offer?.undo();
}
