const AI_ENABLED_KEY = 'prompt-organizer:aiEnabled';

/** Whether AI features are shown. On by default; stored per machine. */
export function loadAiEnabled(): boolean {
  try {
    return localStorage.getItem(AI_ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveAiEnabled(enabled: boolean) {
  try {
    localStorage.setItem(AI_ENABLED_KEY, String(enabled));
  } catch {
    // Storage blocked; the choice just won't persist across restarts.
  }
}
