-- Onda 4: autenticação, governança e alçadas
CREATE TABLE "sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "approval_rules" (
  "id" UUID NOT NULL,
  "unit_id" UUID,
  "role_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "min_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "max_amount" DECIMAL(15,2),
  "require_on_divergence" BOOLEAN NOT NULL DEFAULT false,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "approval_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "approval_rules_unit_id_active_priority_idx" ON "approval_rules"("unit_id", "active", "priority");
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approvals" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "approvals" ADD COLUMN "rule_id" UUID;
CREATE INDEX "approvals_status_approver_id_idx" ON "approvals"("status", "approver_id");
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "approval_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
