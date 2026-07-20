#!/usr/bin/env bash
# Promote a user to admin role on the production database.
#
#   ./scripts/make-admin.sh you@example.com
#
# Requires the local .pem and the droptrack DATABASE_URL from the .env on the
# EC2 — we read it over SSH so we don't have to keep a copy locally.
set -euo pipefail

EMAIL=${1:-}
if [[ -z "$EMAIL" ]]; then
  echo "usage: $0 <email>" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PEM="$REPO_ROOT/droptrack-portal-prod.pem"
HOST=ubuntu@15.134.170.217

ssh -i "$PEM" -o StrictHostKeyChecking=no "$HOST" "
  DATABASE_URL=\$(grep DATABASE_URL /home/ubuntu/droptrack/.env | cut -d= -f2-)
  psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -c \"
    UPDATE users SET role='admin' WHERE email='$EMAIL' RETURNING email, role;
  \"
"
