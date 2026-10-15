-- CreateEnum
CREATE TYPE "GameResult" AS ENUM ('white_win', 'black_win', 'draw');

-- CreateEnum
CREATE TYPE "GameEndReason" AS ENUM ('checkmate', 'resignation', 'flag', 'flag_vs_insufficient_material', 'stalemate', 'insufficient_material', 'threefold_repetition', 'fifty_move', 'agreement');

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "mode" "Mode" NOT NULL,
    "time_control_ms" INTEGER NOT NULL,
    "white_user_id" UUID NOT NULL,
    "black_user_id" UUID NOT NULL,
    "result" "GameResult" NOT NULL,
    "end_reason" "GameEndReason" NOT NULL,
    "pgn" TEXT NOT NULL,
    "final_fen" TEXT NOT NULL,
    "white_rating_before" INTEGER NOT NULL,
    "white_rating_after" INTEGER NOT NULL,
    "black_rating_before" INTEGER NOT NULL,
    "black_rating_after" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "games_white_user_id_started_at_idx" ON "games"("white_user_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "games_black_user_id_started_at_idx" ON "games"("black_user_id", "started_at" DESC);

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_white_user_id_fkey" FOREIGN KEY ("white_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_black_user_id_fkey" FOREIGN KEY ("black_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
