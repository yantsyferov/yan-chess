-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('Bullet', 'Blitz', 'Rapid', 'Classical');

-- CreateTable
CREATE TABLE "ratings_by_mode" (
    "user_id" UUID NOT NULL,
    "mode" "Mode" NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1500,
    "rd" DOUBLE PRECISION NOT NULL DEFAULT 350,
    "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0.06,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_by_mode_pkey" PRIMARY KEY ("user_id","mode")
);

-- AddForeignKey
ALTER TABLE "ratings_by_mode" ADD CONSTRAINT "ratings_by_mode_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
