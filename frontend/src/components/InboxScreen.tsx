import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hybridDecrypt, deserializeHybrid } from '../crypto';
import { useKeyStore, useRoomStore } from '../store';

interface DecryptedMessage {
  name: string;
  address: string;
  wishlist?: string;
}

interface Props {
  roomId: string;
}

export default function InboxScreen({ roomId }: Props) {
  const navigate = useNavigate();
  const [decryptedMessage, setDecryptedMessage] = useState<DecryptedMessage | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(true);
  const [decryptedCount, setDecryptedCount] = useState(0);

  const { getPersonalKeypair } = useKeyStore();
  const { messages, santeeKey, sortedKeys, myPosition } = useRoomStore();

  useEffect(() => {
    const decryptMessages = async () => {
      const keypair = getPersonalKeypair(roomId);
      if (!keypair || messages.length === 0) {
        setIsDecrypting(false);
        return;
      }

      setIsDecrypting(true);
      let found: DecryptedMessage | null = null;
      let attempted = 0;

      for (const blob of messages) {
        attempted++;
        setDecryptedCount(attempted);

        try {
          const hybrid = deserializeHybrid(blob);
          const plaintext = await hybridDecrypt(keypair.privateKey, hybrid);

          if (plaintext) {
            const parsed = JSON.parse(plaintext);
            if (parsed.name && parsed.address) {
              found = parsed as DecryptedMessage;
              break;
            }
          }
        } catch {
          // Decryption failed - not intended for us
        }
      }

      setDecryptedMessage(found);
      setIsDecrypting(false);
    };

    decryptMessages();
  }, [roomId, messages, getPersonalKeypair]);

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
          Your Inbox
        </h1>
        <p className="text-green-300 text-center mb-6">
          {messages.length} message{messages.length !== 1 ? 's' : ''} on the bulletin board
        </p>

        {/* Position Info */}
        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-white/60">Your position:</span>
            <span className="text-white font-mono">
              #{myPosition !== null ? myPosition + 1 : '?'} of {sortedKeys.length}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-white/60">You're buying for:</span>
            <span className="text-white font-mono">
              {santeeKey ? truncateKey(santeeKey) : 'Unknown'}
            </span>
          </div>
        </div>

        {/* Decryption Status */}
        {isDecrypting ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4" />
            <p className="text-white/80">
              Decrypting messages... ({decryptedCount}/{messages.length})
            </p>
            <p className="text-white/40 text-sm mt-1">
              Trying to find the message meant for you
            </p>
          </div>
        ) : decryptedMessage ? (
          /* Success - Show decrypted message */
          <div className="bg-green-500/20 border border-green-500 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🎁</span>
              <h2 className="text-xl font-bold text-green-300">
                Gift Recipient Found!
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-green-300/80 text-sm">Name:</p>
                <p className="text-white text-lg font-semibold">
                  {decryptedMessage.name}
                </p>
              </div>

              <div>
                <p className="text-green-300/80 text-sm">Shipping Address:</p>
                <p className="text-white whitespace-pre-wrap">
                  {decryptedMessage.address}
                </p>
              </div>

              {decryptedMessage.wishlist && (
                <div>
                  <p className="text-green-300/80 text-sm">Wishlist:</p>
                  <p className="text-white whitespace-pre-wrap">
                    {decryptedMessage.wishlist}
                  </p>
                </div>
              )}
            </div>

            <p className="text-green-300/60 text-xs mt-6 text-center">
              This is the person you need to buy a gift for!
            </p>
          </div>
        ) : (
          /* No message found */
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-6 text-center">
            <span className="text-4xl mb-4 block">📭</span>
            <h2 className="text-xl font-bold text-yellow-300 mb-2">
              No Message Yet
            </h2>
            <p className="text-yellow-200/80">
              The person you're buying for hasn't sent their address yet.
              Check back later!
            </p>
          </div>
        )}

        {/* Reminder about own submission */}
        <div className="mt-6 text-center">
          <p className="text-white/40 text-sm">
            Your address has been sent to your Secret Santa
          </p>
        </div>
      </div>
    </div>
  );
}
