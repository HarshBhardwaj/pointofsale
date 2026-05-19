#!/bin/sh
set -e

cd /app/packages/db

echo "Generating Prisma client for container runtime..."
npx prisma generate

echo "Applying database schema..."
if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  set +e
  MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
  MIGRATE_STATUS=$?
  set -e

  if [ "$MIGRATE_STATUS" -ne 0 ]; then
    if echo "$MIGRATE_OUTPUT" | grep -q "P3005"; then
      echo "Database exists without migration history (likely created via db push)."
      echo "Syncing schema and baselining migrations..."
      npx prisma db push --skip-generate --accept-data-loss
      for migration_dir in prisma/migrations/*/; do
        migration_name=$(basename "$migration_dir")
        npx prisma migrate resolve --applied "$migration_name"
      done
    else
      echo "$MIGRATE_OUTPUT"
      exit "$MIGRATE_STATUS"
    fi
  fi
else
  echo "No migrations found — using prisma db push."
  npx prisma db push --skip-generate
fi

if [ "$RUN_DB_SEED" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed
fi

cd /app
exec "$@"
