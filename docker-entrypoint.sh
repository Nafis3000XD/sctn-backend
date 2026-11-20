#!/bin/sh
set -eu

if [ "${SCTN_RUN_MIGRATIONS:-1}" = "1" ]; then
  npm run db:deploy
  npm run admin:bootstrap
fi

exec "$@"
