import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hybridEncrypt, serializeHybrid } from '../crypto';
import { postMessage } from '../api/client';
import { useRoomStore } from '../store';

interface Props {
  roomId: string;
  onRefresh: () => void;
}

export default function AssignmentScreen({ roomId, onRefresh }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [wishlist, setWishlist] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sortedKeys, myPosition, santaKey, markMessageSent } = useRoomStore();

  const handleSendAddress = async () => {
    if (!santaKey) {
      setError('Santa key not found');
      return;
    }

    if (!name.trim() || !address.trim()) {
      setError('Please fill in your name and address');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      // Create message payload
      const payload = {
        name: name.trim(),
        address: address.trim(),
        wishlist: wishlist.trim() || undefined,
      };

      // Encrypt with Santa's public key using hybrid encryption
      const santaPK = BigInt(santaKey);
      const encrypted = await hybridEncrypt(santaPK, JSON.stringify(payload));
      const blob = serializeHybrid(encrypted);

      // Post to server
      await postMessage(roomId, { blob });

      // Mark as sent
      markMessageSent(roomId);

      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setIsSending(false);
    }
  };

  const truncateKey = (key: string) => {
    if (key.length <= 20) return key;
    return `${key.slice(0, 10)}...${key.slice(-10)}`;
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
        </div>

        <h1 className="text-3xl font-bold text-white text-center mb-2">
          Your Assignment
        </h1>
        <p className="text-green-300 text-center mb-6">
          Send your address to your Secret Santa
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 rounded-lg p-3 mb-6">
            {error}
          </div>
        )}

        {/* Position Info */}
        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <p className="text-white/60 text-sm">Your position in the cycle:</p>
          <p className="text-white font-mono text-lg">
            #{myPosition !== null ? myPosition + 1 : '?'} of {sortedKeys.length}
          </p>
        </div>

        {/* Santa Info */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
          <p className="text-green-300 text-sm mb-1">Your Secret Santa's Key:</p>
          <p className="text-white font-mono text-sm break-all">
            {santaKey ? truncateKey(santaKey) : 'Unknown'}
          </p>
          <p className="text-green-300/60 text-xs mt-2">
            This person will buy a gift for you. Send them your address below.
          </p>
        </div>

        {/* Address Form */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-white/80 text-sm mb-1">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Santa Claus"
              className="w-full bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-white/80 text-sm mb-1">
              Shipping Address
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 North Pole Lane&#10;Arctic Circle, AK 99705"
              rows={3}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-white/80 text-sm mb-1">
              Wishlist (optional)
            </label>
            <textarea
              value={wishlist}
              onChange={(e) => setWishlist(e.target.value)}
              placeholder="Things I'd love to receive..."
              rows={2}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>
        </div>

        <button
          onClick={handleSendAddress}
          disabled={isSending || !name.trim() || !address.trim()}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {isSending ? 'Encrypting & Sending...' : 'Send to My Santa'}
        </button>
        <p className="text-white/40 text-xs text-center mt-2">
          Your address will be encrypted so only your Santa can read it
        </p>
      </div>
    </div>
  );
}
