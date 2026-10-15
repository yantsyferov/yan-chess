-- CreateEnum
CREATE TYPE "Lang" AS ENUM ('en', 'ru', 'es');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lang" "Lang";
