-- CreateTable
CREATE TABLE "public"."UserAvailability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "UserAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserAvailabilityOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DOUBLE PRECISION,

    CONSTRAINT "UserAvailabilityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAvailability_userId_dayOfWeek_key" ON "public"."UserAvailability"("userId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "UserAvailabilityOverride_userId_date_key" ON "public"."UserAvailabilityOverride"("userId", "date");

-- AddForeignKey
ALTER TABLE "public"."UserAvailability" ADD CONSTRAINT "UserAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserAvailabilityOverride" ADD CONSTRAINT "UserAvailabilityOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
