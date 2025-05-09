/*
  Warnings:

  - You are about to drop the column `image` on the `Car` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Car" DROP COLUMN "image",
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY['https://images.unsplash.com/photo-1547036967-23d11aacaee0?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80']::TEXT[];
