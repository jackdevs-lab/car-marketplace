-- Add the createdBy column as nullable temporarily
ALTER TABLE "Car" ADD COLUMN "createdBy" INTEGER;

-- Update existing rows with the admin's ID (using id: 1)
UPDATE "Car" SET "createdBy" = 1 WHERE "createdBy" IS NULL;

-- Make createdBy non-nullable
ALTER TABLE "Car" ALTER COLUMN "createdBy" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "Car" ADD CONSTRAINT "Car_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;