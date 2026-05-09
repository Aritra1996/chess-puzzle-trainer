import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_health_returns_200(client):
    response = await client.get("/health")
    assert response.status_code == 200


async def test_health_returns_ok(client):
    response = await client.get("/health")
    assert response.json() == {"status": "ok"}


async def test_sample_puzzle_returns_200(client):
    response = await client.get("/puzzle/sample")
    assert response.status_code == 200


async def test_sample_puzzle_has_fen(client):
    response = await client.get("/puzzle/sample")
    data = response.json()
    assert "fen" in data
    assert data["fen"].count(" ") == 5  # valid FEN has 6 space-separated fields


async def test_sample_puzzle_turn_is_black(client):
    response = await client.get("/puzzle/sample")
    assert response.json()["turn"] == "black"  # SAMPLE_FEN has black to move


async def test_sample_puzzle_has_legal_moves(client):
    response = await client.get("/puzzle/sample")
    data = response.json()
    assert "legal_moves" in data
    assert len(data["legal_moves"]) > 0


async def test_sample_puzzle_legal_moves_are_uci(client):
    response = await client.get("/puzzle/sample")
    moves = response.json()["legal_moves"]
    for move in moves:
        assert len(move) in (4, 5), f"Expected UCI move (4-5 chars), got: {move}"


async def test_cors_header_present(client):
    response = await client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert "access-control-allow-origin" in response.headers
