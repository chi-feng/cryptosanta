# CLAUDE.md

## Commands

```bash
# Backend
uv sync
uv run modal deploy backend/main.py

# Frontend
cd frontend && pnpm install
cd frontend && pnpm dev
cd frontend && pnpm build
```

## Architecture

- **Frontend**: React + Vite + Tailwind CSS v3, `pnpm`
- **Backend**: Python 3.12 + FastAPI on Modal, `uv`
- All cryptography is client-side (BigInt + Web Crypto API)
- Server is a stateless bulletin board using Modal Dict for persistence

## Key Files

- `backend/main.py` - Modal ASGI entry point
- `backend/api/routes.py` - REST endpoints
- `backend/storage/room_store.py` - Modal Dict with optimistic locking
- `frontend/src/crypto/` - ElGamal, hybrid encryption, encoding
- `frontend/src/store/` - Zustand stores (keys persisted to localStorage)
