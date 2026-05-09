from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import chess

app = FastAPI(title="Chess Puzzle Trainer API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

SAMPLE_FEN = "r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8"

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/puzzle/sample")
def get_sample_puzzle():
    board = chess.Board(SAMPLE_FEN)
    return {
        "fen": SAMPLE_FEN,
        "turn": "black" if board.turn == chess.BLACK else "white",
        "full_move_number": board.fullmove_number,
        "legal_moves": [m.uci() for m in board.legal_moves],
    }
