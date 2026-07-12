#!/bin/sh
set -e

npx prisma migrate deploy --schema prisma/schema
npx ts-node prisma/seed.ts

exec "$@"
