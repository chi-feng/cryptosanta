import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  generateKeypair,
  encrypt,
  decrypt,
  serializeCiphertext,
  deserializeCiphertext,
} from '../crypto';
import { registerKey, getParticipants, sortKeys } from '../api/client';
import { useKeyStore, useRoomStore } from '../store';

interface Props {
  roomId: string;
  sessionPublicKey: string;
  isChair: boolean;
  chairSecret: string | null;
  onRefresh: () => void;
}

export default function LobbyScreen({
  roomId,
  sessionPublicKey,
  isChair,
  chairSecret,
  onRefresh,
}: Props) {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setPersonalKeypair, getPersonalKeypair, getSessionKeypair } = useKeyStore();
  const { participantCount, memberships, markRegistered } = useRoomStore();

  const personalKeypair = getPersonalKeypair(roomId);
  const isRegistered = memberships[roomId]?.registered ?? false;

  const handleGenerateAndRegister = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Generate personal keypair
      const keypair = generateKeypair();

      // Encrypt public key with session public key
      const sessionPK = BigInt(sessionPublicKey);
      const encrypted = encrypt(sessionPK, keypair.publicKey);
      const encryptedJson = serializeCiphertext(encrypted);

      // Register with server
      await registerKey(roomId, { encryptedKey: encryptedJson });

      // Store keypair locally
      setPersonalKeypair(roomId, keypair.privateKey, keypair.publicKey);
      markRegistered(roomId);

      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSort = async () => {
    if (!isChair || !chairSecret) return;

    setIsSorting(true);
    setError(null);

    try {
      // Get session private key
      const sessionKeypair = getSessionKeypair(roomId);
      if (!sessionKeypair) {
        throw new Error('Session keypair not found');
      }

      // Get all encrypted keys
      const { participants } = await getParticipants(roomId);

      if (participants.length < 3) {
        throw new Error('Need at least 3 participants');
      }

      // Decrypt all keys
      const decryptedKeys: bigint[] = [];
      for (const encryptedJson of participants) {
        const encrypted = deserializeCiphertext(encryptedJson);
        const decrypted = decrypt(sessionKeypair.privateKey, encrypted);
        decryptedKeys.push(decrypted);
      }

      // Sort numerically
      decryptedKeys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

      // Upload sorted keys
      await sortKeys(
        roomId,
        { sortedKeys: decryptedKeys.map((k) => k.toString()) },
        chairSecret
      );

      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sort');
    } finally {
      setIsSorting(false);
    }
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-lg w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-white/60 hover:text-white transition-colors"
          >
            &larr; Back
          </button>
          {isChair && (
            <span className="bg-yellow-500/20 text-yellow-300 text-sm px-3 py-1 rounded-full">
              Chair
            </span>
          )}
        </div>

        <h1 className="text-3xl font-bold text-white text-center mb-2">
          Secret Santa Lobby
        </h1>
        <p className="text-green-300 text-center mb-6">
          {participantCount} participant{participantCount !== 1 ? 's' : ''} registered
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 rounded-lg p-3 mb-6">
            {error}
          </div>
        )}

        {/* Invite Link */}
        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <p className="text-white/60 text-sm mb-2">Share this room:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={roomId}
              readOnly
              className="flex-1 bg-white/10 text-white text-sm rounded px-3 py-2"
            />
            <button
              onClick={copyInviteLink}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded transition-colors"
            >
              Copy Link
            </button>
          </div>
        </div>

        {/* Registration Status */}
        {!isRegistered ? (
          <div className="mb-6">
            <button
              onClick={handleGenerateAndRegister}
              disabled={isGenerating}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isGenerating ? 'Generating Key...' : 'Generate Key & Register'}
            </button>
            <p className="text-white/60 text-sm mt-2 text-center">
              Generate your cryptographic key to participate
            </p>
          </div>
        ) : (
          <div className="bg-green-500/20 border border-green-500 text-green-200 rounded-lg p-4 mb-6 text-center">
            <p className="font-semibold">You're registered!</p>
            <p className="text-sm mt-1">
              Key: {personalKeypair?.publicKey.toString().slice(0, 16)}...
            </p>
          </div>
        )}

        {/* Chair Controls */}
        {isChair && (
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-white font-semibold mb-3">Chair Controls</h3>
            <button
              onClick={handleSort}
              disabled={isSorting || participantCount < 3}
              className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isSorting ? 'Sorting...' : 'Close Registration & Sort Keys'}
            </button>
            {participantCount < 3 && (
              <p className="text-yellow-300/60 text-sm mt-2 text-center">
                Need at least 3 participants to continue
              </p>
            )}
          </div>
        )}

        {/* Waiting Message */}
        {!isChair && isRegistered && (
          <div className="text-center text-white/60">
            <p>Waiting for the Chair to close registration...</p>
          </div>
        )}
      </div>
    </div>
  );
}
