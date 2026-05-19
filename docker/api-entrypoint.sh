#!/bin/sh
set -e

cd /app/packages/db

echo "Applying database schema..."
if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  echo "No migrations found — using prisma db push (run 'prisma migrate dev' locally and commit migrations for production)."
  npx prisma db push
fi

if [ "$RUN_DB_SEED" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed
fi

cd /app
exec "$@"
