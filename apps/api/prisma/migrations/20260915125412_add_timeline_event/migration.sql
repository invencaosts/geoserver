-- CreateEnum
CREATE TYPE "TimelineEscopo" AS ENUM ('nacional', 'estadual');

-- CreateTable
CREATE TABLE "timeline_events" (
    "id" TEXT NOT NULL,
    "escopo" "TimelineEscopo" NOT NULL,
    "estado" TEXT,
    "startYear" INTEGER,
    "startMonth" INTEGER,
    "startDay" INTEGER,
    "endYear" INTEGER,
    "endMonth" INTEGER,
    "endDay" INTEGER,
    "displayDate" TEXT,
    "headline" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaCredit" TEXT,
    "mediaCaption" TEXT,
    "mediaThumb" TEXT,
    "type" TEXT,
    "background" TEXT,
    "order" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timeline_events_estado_idx" ON "timeline_events"("estado");

-- CreateIndex
CREATE INDEX "timeline_events_escopo_idx" ON "timeline_events"("escopo");
