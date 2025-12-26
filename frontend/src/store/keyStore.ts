/**
 * Zustand store for cryptographic keypairs.
 * Persisted to localStorage to survive browser sessions.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface KeyState {
  // Personal keypair for participation (per room)
  // Map of roomId -> { privateKey, publicKey }
  personalKeys: Record<string, { privateKey: string; publicKey: string }>;

  // Session keypair (Chair only, per room)
  // Map of roomId -> { privateKey, publicKey }
  sessionKeys: Record<string, { privateKey: string; publicKey: string }>;

  // Actions
  setPersonalKeypair: (roomId: string, privateKey: bigint, publicKey: bigint) => void;
  setSessionKeypair: (roomId: string, privateKey: bigint, publicKey: bigint) => void;
  getPersonalKeypair: (roomId: string) => { privateKey: bigint; publicKey: bigint } | null;
  getSessionKeypair: (roomId: string) => { privateKey: bigint; publicKey: bigint } | null;
  clearRoomKeys: (roomId: string) => void;
}

export const useKeyStore = create<KeyState>()(
  persist(
    (set, get) => ({
      personalKeys: {},
      sessionKeys: {},

      setPersonalKeypair: (roomId, privateKey, publicKey) =>
        set((state) => ({
          personalKeys: {
            ...state.personalKeys,
            [roomId]: {
              privateKey: privateKey.toString(),
              publicKey: publicKey.toString(),
            },
          },
        })),

      setSessionKeypair: (roomId, privateKey, publicKey) =>
        set((state) => ({
          sessionKeys: {
            ...state.sessionKeys,
            [roomId]: {
              privateKey: privateKey.toString(),
              publicKey: publicKey.toString(),
            },
          },
        })),

      getPersonalKeypair: (roomId) => {
        const keys = get().personalKeys[roomId];
        if (!keys) return null;
        return {
          privateKey: BigInt(keys.privateKey),
          publicKey: BigInt(keys.publicKey),
        };
      },

      getSessionKeypair: (roomId) => {
        const keys = get().sessionKeys[roomId];
        if (!keys) return null;
        return {
          privateKey: BigInt(keys.privateKey),
          publicKey: BigInt(keys.publicKey),
        };
      },

      clearRoomKeys: (roomId) =>
        set((state) => {
          const { [roomId]: _p, ...personalKeys } = state.personalKeys;
          const { [roomId]: _s, ...sessionKeys } = state.sessionKeys;
          return { personalKeys, sessionKeys };
        }),
    }),
    {
      name: 'cryptosanta-keys',
    }
  )
);
