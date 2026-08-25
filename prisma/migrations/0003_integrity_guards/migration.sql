-- Impede que o mesmo e-mail ou a mesma solicitação gerem registros duplicados.
ALTER TABLE "purchase_requests" ADD COLUMN "email_message_id" TEXT;

CREATE UNIQUE INDEX "purchase_requests_email_message_id_key"
  ON "purchase_requests"("email_message_id");

CREATE UNIQUE INDEX "purchase_orders_request_id_key"
  ON "purchase_orders"("request_id");
