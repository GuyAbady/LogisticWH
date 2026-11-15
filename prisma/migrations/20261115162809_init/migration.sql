-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'UNIT_MANAGER', 'WAREHOUSE_MANAGER');

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('IN_STOCK', 'ALLOCATED', 'PENDING_ACK', 'SIGNED', 'PENDING_RETURN', 'IN_REPAIR', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING_MANAGER', 'REJECTED_MANAGER', 'PENDING_WAREHOUSE', 'REJECTED_WAREHOUSE', 'ALLOCATED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SummonsStatus" AS ENUM ('PENDING_RETURN', 'RETURNED_CREDITED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('STOCK_IN', 'ALLOCATE', 'ISSUE', 'RETURN', 'TRANSFER', 'ADJUST', 'REPAIR_OUT', 'REPAIR_IN', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "SignatureKind" AS ENUM ('RECEIPT', 'RETURN', 'MANAGER_BULK', 'EMPLOYEE_ACK');

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "requiresSerial" BOOLEAN NOT NULL DEFAULT false,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "availableQty" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySerial" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" "SerialStatus" NOT NULL DEFAULT 'IN_STOCK',
    "catalogItemId" TEXT NOT NULL,
    "holderId" TEXT,
    "allocatedRequestId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySerial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuantityHolding" (
    "id" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "pendingAckQty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuantityHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING_MANAGER',
    "justification" TEXT,
    "managerId" TEXT,
    "managerNote" TEXT,
    "managerDecidedAt" TIMESTAMP(3),
    "warehouseNote" TEXT,
    "pickupDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "kind" "SignatureKind" NOT NULL,
    "signerId" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "documentJson" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "serialId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "performedById" TEXT NOT NULL,
    "signatureId" TEXT,
    "requestId" TEXT,
    "requiresAck" BOOLEAN NOT NULL DEFAULT false,
    "ackAt" TIMESTAMP(3),
    "ackSignatureId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnSummons" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "serialId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "SummonsStatus" NOT NULL DEFAULT 'PENDING_RETURN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ReturnSummons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeNumber_key" ON "User"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_unitId_idx" ON "User"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_sku_key" ON "CatalogItem"("sku");

-- CreateIndex
CREATE INDEX "CatalogItem_category_idx" ON "CatalogItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySerial_serialNumber_key" ON "InventorySerial"("serialNumber");

-- CreateIndex
CREATE INDEX "InventorySerial_catalogItemId_status_idx" ON "InventorySerial"("catalogItemId", "status");

-- CreateIndex
CREATE INDEX "InventorySerial_holderId_idx" ON "InventorySerial"("holderId");

-- CreateIndex
CREATE INDEX "QuantityHolding_userId_idx" ON "QuantityHolding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuantityHolding_catalogItemId_userId_key" ON "QuantityHolding"("catalogItemId", "userId");

-- CreateIndex
CREATE INDEX "EquipmentRequest_unitId_status_idx" ON "EquipmentRequest"("unitId", "status");

-- CreateIndex
CREATE INDEX "EquipmentRequest_requesterId_idx" ON "EquipmentRequest"("requesterId");

-- CreateIndex
CREATE INDEX "Signature_signerId_idx" ON "Signature"("signerId");

-- CreateIndex
CREATE INDEX "Transaction_catalogItemId_createdAt_idx" ON "Transaction"("catalogItemId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_serialId_idx" ON "Transaction"("serialId");

-- CreateIndex
CREATE INDEX "Transaction_toUserId_idx" ON "Transaction"("toUserId");

-- CreateIndex
CREATE INDEX "Transaction_fromUserId_idx" ON "Transaction"("fromUserId");

-- CreateIndex
CREATE INDEX "ReturnSummons_userId_status_idx" ON "ReturnSummons"("userId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySerial" ADD CONSTRAINT "InventorySerial_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySerial" ADD CONSTRAINT "InventorySerial_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySerial" ADD CONSTRAINT "InventorySerial_allocatedRequestId_fkey" FOREIGN KEY ("allocatedRequestId") REFERENCES "EquipmentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuantityHolding" ADD CONSTRAINT "QuantityHolding_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuantityHolding" ADD CONSTRAINT "QuantityHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentRequest" ADD CONSTRAINT "EquipmentRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentRequest" ADD CONSTRAINT "EquipmentRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentRequest" ADD CONSTRAINT "EquipmentRequest_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentRequest" ADD CONSTRAINT "EquipmentRequest_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "InventorySerial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "Signature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EquipmentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_ackSignatureId_fkey" FOREIGN KEY ("ackSignatureId") REFERENCES "Signature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnSummons" ADD CONSTRAINT "ReturnSummons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnSummons" ADD CONSTRAINT "ReturnSummons_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnSummons" ADD CONSTRAINT "ReturnSummons_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "InventorySerial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnSummons" ADD CONSTRAINT "ReturnSummons_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
