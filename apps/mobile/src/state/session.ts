import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppRole, Intent } from '@sst/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type SessionState = {
  /** What the user picked on the welcome screen. */
  intent: Intent | null;
  /** The role whose home screen was last shown. */
  lastRole: AppRole | null;
  /** An invite code from a deep link, kept until the invite screen uses it. */
  pendingInviteCode: string | null;
  setIntent: (intent: Intent | null) => void;
  setLastRole: (role: AppRole | null) => void;
  setPendingInviteCode: (code: string | null) => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      intent: null,
      lastRole: null,
      pendingInviteCode: null,
      setIntent: (intent) => set({ intent }),
      setLastRole: (lastRole) => set({ lastRole }),
      setPendingInviteCode: (pendingInviteCode) => set({ pendingInviteCode }),
    }),
    { name: 'session', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
