-- AlterEnum
ALTER TYPE "DatasetFormat" ADD VALUE 'KMZ';

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "anexoKey" TEXT,
ADD COLUMN     "anexoNome" TEXT,
ADD COLUMN     "anexoUrl" TEXT;
