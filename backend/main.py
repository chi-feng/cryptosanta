"""Modal ASGI entry point for CryptoSanta API.

Deploy with: uv run modal deploy backend/main.py
"""

import modal
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Create Modal app
app = modal.App("cryptosanta")

# Define image with dependencies
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "fastapi[standard]>=0.115.0",
        "pydantic>=2.0",
    )
    .add_local_python_source("backend")
)


@app.function(
    image=image,
    timeout=60,
    cpu=1,
    memory=512,
)
@modal.concurrent(max_inputs=100)
@modal.asgi_app()
def fastapi_app():
    """Create and configure FastAPI application."""
    from backend.api.routes import router

    web_app = FastAPI(
        title="CryptoSanta API",
        description="Cryptographic Secret Santa with ElGamal encryption",
        version="0.1.0",
    )

    # CORS configuration for frontend on separate domain
    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allow all origins for development; restrict in production
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # Include API routes
    web_app.include_router(router)

    # Health check endpoint
    @web_app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    return web_app
