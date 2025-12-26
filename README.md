# CryptoSanta

A cryptographic Secret Santa web application using ElGamal public key encryption. The server acts only as a bulletin board—it never knows who is gifting to whom.

## Features

- **No Central Authority**: Server stores encrypted blobs only, performs no cryptography
- **Anonymity**: Participants only know who they're gifting to, not who gifts to them
- **Client-Side Cryptography**: All keys generated and stored locally in the browser
- **2048-bit ElGamal**: Uses RFC 3526 MODP Group 14 for strong security
- **Hybrid Encryption**: AES-GCM + ElGamal for messages of any length

## How It Works

1. **Chair creates a room** with cryptographic parameters and a session keypair
2. **Participants register** by encrypting their public key with the session key
3. **Chair sorts keys** numerically after decrypting, creating a deterministic cycle
4. **Assignment**: Each participant's Santa is the previous key in the sorted cycle
5. **Address exchange**: Users encrypt their address with their Santa's public key
6. **Retrieval**: Each user decrypts all messages—only one will succeed

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS v3
- **Backend**: Python + FastAPI on Modal
- **Cryptography**: Native BigInt + Web Crypto API

## Development

```bash
# Backend
uv sync
uv run modal deploy backend/main.py

# Frontend
cd frontend
pnpm install
pnpm dev      # Development server
pnpm build    # Production build
```

## Configuration

Create `frontend/.env`:
```
VITE_API_URL=https://your-modal-deployment.modal.run
```

## Security Model

The Chair is "honest-but-curious"—they can potentially correlate registration timestamps to keys, but cannot determine the gift assignments without breaking ElGamal encryption. Future versions could implement blind signatures or mixnets to eliminate this correlation.

## License

MIT
