ALTER TABLE "User" ADD COLUMN "adminLoginId" TEXT;
ALTER TABLE "User" ADD COLUMN "staffTitle" TEXT;
ALTER TABLE "User" ADD COLUMN "department" TEXT;
ALTER TABLE "User" ADD COLUMN "emergencyContact" TEXT;
ALTER TABLE "User" ADD COLUMN "staffNotes" TEXT;

CREATE UNIQUE INDEX "User_adminLoginId_key" ON "User"("adminLoginId");
