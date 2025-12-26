import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateKeypair, P, g } from '../crypto';
import { createRoom } from '../api/client';
import { useKeyStore, useRoomStore } from '../store';

export default function HomePage() {
  const navigate = useNavigate();
  const [joinRoomId, setJoinRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setSessionKeypair } = useKeyStore();
  const { joinRoom } = useRoomStore();

  const handleCreateRoom = async () => {
    setIsCreating(true);
    setError(null);

    try {
      // Generate session keypair for the Chair
      const sessionKeypair = generateKeypair();

      // Generate chair secret for authentication
      const chairSecret = crypto.randomUUID();
      const chairSecretHash = await sha256(chairSecret);

      // Create room on server
      const response = await createRoom({
        P: P.toString(),
        g: g.toString(),
        sessionPublicKey: sessionKeypair.publicKey.toString(),
        chairSecretHash,
      });

      // Store session keypair and membership
      setSessionKeypair(response.roomId, sessionKeypair.privateKey, sessionKeypair.publicKey);
      joinRoom(response.roomId, true, chairSecret);

      // Navigate to room
      navigate(`/room/${response.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = () => {
    if (!joinRoomId.trim()) {
      setError('Please enter a room ID');
      return;
    }

    // Mark as participant (not chair)
    joinRoom(joinRoomId.trim(), false, null);
    navigate(`/room/${joinRoomId.trim()}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <h1 className="text-4xl font-bold text-white text-center mb-2">
          CryptoSanta
        </h1>
        <p className="text-green-300 text-center mb-8">
          Cryptographic Secret Santa
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 rounded-lg p-3 mb-6">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Create Room */}
          <div>
            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create New Room'}
            </button>
            <p className="text-white/60 text-sm mt-2 text-center">
              Start a new Secret Santa event as the Chair
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-white/40 text-sm">or</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* Join Room */}
          <div>
            <input
              type="text"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              placeholder="Enter Room ID"
              className="w-full bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-lg py-3 px-4 mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={handleJoinRoom}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Join Room
            </button>
            <p className="text-white/60 text-sm mt-2 text-center">
              Join an existing Secret Santa event
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
