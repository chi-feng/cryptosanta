import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRoom } from '../api/client';
import { useRoomStore, useKeyStore } from '../store';
import LobbyScreen from '../components/LobbyScreen';
import AssignmentScreen from '../components/AssignmentScreen';
import InboxScreen from '../components/InboxScreen';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionPublicKey, setSessionPublicKey] = useState<string | null>(null);

  const {
    memberships,
    status,
    updateRoomData,
    computeAssignment,
    setCurrentRoom,
  } = useRoomStore();

  const { getPersonalKeypair } = useKeyStore();

  const membership = roomId ? memberships[roomId] : undefined;

  const fetchRoom = useCallback(async () => {
    if (!roomId) return;

    try {
      const room = await getRoom(roomId);

      setSessionPublicKey(room.sessionPublicKey);
      updateRoomData({
        status: room.status,
        participantCount: room.participantCount,
        sortedKeys: room.sortedKeys,
        messages: room.messages,
      });

      // Compute assignment if sorted and we have our key
      if (room.status !== 'OPEN') {
        const keypair = getPersonalKeypair(roomId);
        if (keypair) {
          computeAssignment(keypair.publicKey.toString());
        }
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room');
    } finally {
      setLoading(false);
    }
  }, [roomId, getPersonalKeypair, updateRoomData, computeAssignment]);

  // Set current room and fetch initial data
  useEffect(() => {
    if (roomId) {
      setCurrentRoom(roomId);
      fetchRoom();
    }
  }, [roomId, setCurrentRoom, fetchRoom]);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(fetchRoom, 3000);
    return () => clearInterval(interval);
  }, [fetchRoom]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
          <p className="text-white/80 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-white/20 hover:bg-white/30 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!roomId || !sessionPublicKey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Room not found</div>
      </div>
    );
  }

  // Show appropriate screen based on room status
  if (status === 'OPEN') {
    return (
      <LobbyScreen
        roomId={roomId}
        sessionPublicKey={sessionPublicKey}
        isChair={membership?.isChair ?? false}
        chairSecret={membership?.chairSecret ?? null}
        onRefresh={fetchRoom}
      />
    );
  }

  if (status === 'SORTED' || status === 'MESSAGING') {
    const keypair = getPersonalKeypair(roomId);
    const messageSent = membership?.messageSent ?? false;

    // User missed registration - show message
    if (!keypair) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full text-center">
            <span className="text-6xl mb-4 block">🎅</span>
            <h2 className="text-2xl font-bold text-yellow-300 mb-4">
              Registration Closed
            </h2>
            <p className="text-white/80 mb-6">
              This Secret Santa event has already started. Registration is closed
              and you cannot participate in this round.
            </p>
            <button
              onClick={() => navigate('/')}
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    // If user hasn't sent their address yet, show assignment screen
    if (!messageSent) {
      return (
        <AssignmentScreen
          roomId={roomId}
          onRefresh={fetchRoom}
        />
      );
    }

    // Otherwise show inbox
    return <InboxScreen roomId={roomId} />;
  }

  return null;
}
