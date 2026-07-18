#!/bin/sh
set -eu

entrypoint_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)
. "$entrypoint_dir/container-secret.sh"
resolve_noviqwiki_secret

node node_modules/tsx/dist/cli.mjs scripts/migrate.ts
exec env HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js
