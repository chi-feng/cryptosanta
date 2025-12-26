/**
 * Zustand store for room state.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RoomStatus = 'OPEN' | 'SORTED' | 'MESSAGING';

interface RoomMembership {
  isChair: boolean;
  chairSecret: string | null;
  registered: boolean;
  messageSent: boolean;
}

interface RoomState {
  // Current room being viewed
  currentRoomId: string | null;

  // Room memberships (persisted)
  memberships: Record<string, RoomMembership>;

  // Transient room data (not persisted)
  status: RoomStatus | null;
  participantCount: number;
  sortedKeys: string[];
  messages: string[];

  // Computed assignment (transient)
  myPosition: number | null;
  santaKey: string | null;  // Who gives to me
  santeeKey: string | null; // Who I give to

  // Actions
  setCurrentRoom: (roomId: string | null) => void;
  joinRoom: (roomId: string, isChair: boolean, chairSecret: string | null) => void;
  markRegistered: (roomId: string) => void;
  markMessageSent: (roomId: string) => void;
  updateRoomData: (data: {
    status?: RoomStatus;
    participantCount?: number;
    sortedKeys?: string[];
    messages?: string[];
  }) => void;
  computeAssignment: (myPublicKey: string) => void;
  leaveRoom: (roomId: string) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set, get) => ({
      currentRoomId: null,
      memberships: {},
      status: null,
      participantCount: 0,
      sortedKeys: [],
      messages: [],
      myPosition: null,
      santaKey: null,
      santeeKey: null,

      setCurrentRoom: (roomId) =>
        set({
          currentRoomId: roomId,
          // Reset transient data when switching rooms
          status: null,
          participantCount: 0,
          sortedKeys: [],
          messages: [],
          myPosition: null,
          santaKey: null,
          santeeKey: null,
        }),

      joinRoom: (roomId, isChair, chairSecret) =>
        set((state) => ({
          memberships: {
            ...state.memberships,
            [roomId]: {
              isChair,
              chairSecret,
              registered: false,
              messageSent: false,
            },
          },
        })),

      markRegistered: (roomId) =>
        set((state) => ({
          memberships: {
            ...state.memberships,
            [roomId]: {
              ...state.memberships[roomId],
              registered: true,
            },
          },
        })),

      markMessageSent: (roomId) =>
        set((state) => ({
          memberships: {
            ...state.memberships,
            [roomId]: {
              ...state.memberships[roomId],
              messageSent: true,
            },
          },
        })),

      updateRoomData: (data) =>
        set((state) => ({
          ...state,
          ...data,
        })),

      computeAssignment: (myPublicKey) => {
        const { sortedKeys } = get();
        const n = sortedKeys.length;

        if (n === 0) {
          set({ myPosition: null, santaKey: null, santeeKey: null });
          return;
        }

        const myIndex = sortedKeys.findIndex((key) => key === myPublicKey);

        if (myIndex === -1) {
          set({ myPosition: null, santaKey: null, santeeKey: null });
          return;
        }

        // In the cycle:
        // - Santa (who gives to me) is the previous key
        // - Santee (who I give to) is the next key
        const santaIndex = (myIndex - 1 + n) % n;
        const santeeIndex = (myIndex + 1) % n;

        set({
          myPosition: myIndex,
          santaKey: sortedKeys[santaIndex],
          santeeKey: sortedKeys[santeeIndex],
        });
      },

      leaveRoom: (roomId) =>
        set((state) => {
          const { [roomId]: _, ...memberships } = state.memberships;
          return {
            memberships,
            currentRoomId: state.currentRoomId === roomId ? null : state.currentRoomId,
          };
        }),

      reset: () =>
        set({
          currentRoomId: null,
          status: null,
          participantCount: 0,
          sortedKeys: [],
          messages: [],
          myPosition: null,
          santaKey: null,
          santeeKey: null,
        }),
    }),
    {
      name: 'cryptosanta-room',
      partialize: (state) => ({
        // Only persist memberships, not transient data
        memberships: state.memberships,
      }),
    }
  )
);
