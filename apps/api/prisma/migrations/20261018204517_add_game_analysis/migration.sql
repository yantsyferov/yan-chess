-- CreateEnum
CREATE TYPE "MoveCategory" AS ENUM ('Brilliant', 'Great', 'Best', 'Excellent', 'Good', 'Book', 'Forced', 'Inaccuracy', 'Mistake', 'Blunder', 'Miss');

-- CreateTable
CREATE TABLE "game_analyses" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "classifier_version" INTEGER NOT NULL,
    "engine_depth" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_analysis_moves" (
    "id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "move_index" INTEGER NOT NULL,
    "player_color" TEXT NOT NULL,
    "category" "MoveCategory" NOT NULL,
    "evaluation_cp" INTEGER,
    "mate_in" INTEGER,
    "best_move_uci" VARCHAR(5) NOT NULL,

    CONSTRAINT "game_analysis_moves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_analyses_game_id_key" ON "game_analyses"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_analysis_moves_analysis_id_move_index_key" ON "game_analysis_moves"("analysis_id", "move_index");

-- AddForeignKey
ALTER TABLE "game_analyses" ADD CONSTRAINT "game_analyses_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_analysis_moves" ADD CONSTRAINT "game_analysis_moves_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "game_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
