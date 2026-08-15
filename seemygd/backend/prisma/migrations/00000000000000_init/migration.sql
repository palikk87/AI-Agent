-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "heroImageUrl" TEXT,
    "primaryColorHex" TEXT NOT NULL DEFAULT '#2563EB',
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "vanitySlug" TEXT,
    "customSubdomain" TEXT,
    "customDomain" TEXT,
    "individualUrlEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tierType" TEXT NOT NULL DEFAULT 'starter',
    "squareCustomerId" TEXT,
    "squareCardId" TEXT,
    "squareSubscriptionId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "notificationEmail" TEXT,
    "resendApiKey" TEXT,
    "resendFromEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "twoCarMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.6,
    "tallMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.15,
    "vinylMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.15,
    "steelMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.35,
    "serviceCallFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairPrice" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "repairKey" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RepairPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "zipCode" TEXT,
    "styleId" TEXT,
    "styleName" TEXT,
    "colorName" TEXT,
    "manufacturerName" TEXT,
    "windowOption" TEXT,
    "notes" TEXT,
    "source" TEXT,
    "beforeImageBase64" TEXT,
    "afterImageBase64" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "serviceType" TEXT,
    "estimateTotal" DOUBLE PRECISION,
    "repairSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_vanitySlug_key" ON "Company"("vanitySlug");

-- CreateIndex
CREATE UNIQUE INDEX "Company_customSubdomain_key" ON "Company"("customSubdomain");

-- CreateIndex
CREATE UNIQUE INDEX "Company_customDomain_key" ON "Company"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "RepairSettings_companyId_key" ON "RepairSettings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairPrice_settingsId_repairKey_key" ON "RepairPrice"("settingsId", "repairKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- AddForeignKey
ALTER TABLE "RepairSettings" ADD CONSTRAINT "RepairSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairPrice" ADD CONSTRAINT "RepairPrice_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "RepairSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

