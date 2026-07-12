#!/bin/sh
set -e

npx prisma migrate deploy --schema prisma/schema
npx ts-node --transpile-only prisma/seed.ts

exec "$@"
