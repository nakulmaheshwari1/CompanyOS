interface LockoutState {
  count: number;
  lockedUntil: Date | null;
}

const lockoutStore = new Map<string, LockoutState>();

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

export function checkLockout(email: string): { isLocked: boolean; remainingTime: number } {
  const normalizedEmail = email.toLowerCase().trim();
  const state = lockoutStore.get(normalizedEmail);

  if (!state) {
    return { isLocked: false, remainingTime: 0 };
  }

  if (state.lockedUntil) {
    const now = new Date();
    if (now < state.lockedUntil) {
      const remainingTime = Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 1000); // in seconds
      return { isLocked: true, remainingTime };
    } else {
      // Cooldown expired, reset
      lockoutStore.delete(normalizedEmail);
    }
  }

  return { isLocked: false, remainingTime: 0 };
}

export function registerFailure(email: string): { attemptsLeft: number; lockedUntil: Date | null } {
  const normalizedEmail = email.toLowerCase().trim();
  let state = lockoutStore.get(normalizedEmail);

  if (!state) {
    state = { count: 0, lockedUntil: null };
  }

  state.count += 1;

  if (state.count >= MAX_ATTEMPTS) {
    state.lockedUntil = new Date(Date.now() + COOLDOWN_MS);
  }

  lockoutStore.set(normalizedEmail, state);

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - state.count);
  return { attemptsLeft, lockedUntil: state.lockedUntil };
}

export function resetFailure(email: string): void {
  const normalizedEmail = email.toLowerCase().trim();
  lockoutStore.delete(normalizedEmail);
}
