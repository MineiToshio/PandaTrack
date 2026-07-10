-- Additive-only: compound indexes backing the hot list queries (orders/deliveries filtered and
-- sorted per user). No columns, tables, or existing indexes are altered or dropped.

-- CreateIndex
CREATE INDEX "order_userId_orderDate_idx" ON "order"("userId", "orderDate");

-- CreateIndex
CREATE INDEX "order_userId_status_idx" ON "order"("userId", "status");

-- CreateIndex
CREATE INDEX "delivery_userId_deliveryDate_idx" ON "delivery"("userId", "deliveryDate");

-- CreateIndex
CREATE INDEX "order_item_userId_deliveryState_idx" ON "order_item"("userId", "deliveryState");
