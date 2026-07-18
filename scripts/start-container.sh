#!/bin/sh
set -eu

secret_dir=$(node -e 'process.stdout.write(require("path").resolve(process.argv[1]))' "${NEXTWIKI_SECRET_DIR:-/app/secrets}")
secret_file="$secret_dir/nextwiki-secret"

if [ "$secret_dir" = "/" ]; then
  echo "Refusing to use the filesystem root as NEXTWIKI_SECRET_DIR." >&2
  exit 1
fi

load_persisted_secret() {
  secret_owner=$(stat -c '%u' "$secret_file")
  if [ "$secret_owner" != "$(id -u)" ]; then
    echo "Refusing a fallback secret owned by another user: $secret_file" >&2
    exit 1
  fi
  secret_mode=$(stat -c '%a' "$secret_file")
  if [ "$secret_mode" != "600" ]; then
    chmod 600 "$secret_file"
  fi
  NEXTWIKI_SECRET=$(cat "$secret_file")
}

if [ -L "$secret_dir" ]; then
  echo "Refusing a symbolic-link NEXTWIKI_SECRET_DIR: $secret_dir" >&2
  exit 1
fi

if [ -n "${NEXTWIKI_SECRET:-}" ] && [ "${#NEXTWIKI_SECRET}" -lt 32 ]; then
  echo "NEXTWIKI_SECRET must contain at least 32 characters." >&2
  exit 1
fi

if [ -n "${NEXTWIKI_SECRET:-}" ]; then
  if [ -e "$secret_file" ] || [ -L "$secret_file" ]; then
    rm -f "$secret_file"
    echo "Removed the persisted fallback because an explicit NEXTWIKI_SECRET is active."
  fi
else
  if [ ! -d "$secret_dir" ]; then
    (umask 077; mkdir -p "$secret_dir")
  fi
  if [ -L "$secret_file" ] || { [ -e "$secret_file" ] && [ ! -f "$secret_file" ]; }; then
    echo "Refusing a fallback secret path that is not a regular file: $secret_file" >&2
    exit 1
  fi
  if [ -f "$secret_file" ] && [ ! -s "$secret_file" ]; then
    echo "Refusing an empty persisted fallback secret: $secret_file" >&2
    exit 1
  fi
  if [ -s "$secret_file" ]; then
    load_persisted_secret
  else
    generated_secret=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    secret_tmp="$secret_file.tmp.$$"
    trap 'rm -f "$secret_tmp"' EXIT HUP INT TERM
    (umask 077; printf '%s\n' "$generated_secret" > "$secret_tmp")
    if ln "$secret_tmp" "$secret_file" 2>/dev/null; then
      NEXTWIKI_SECRET=$generated_secret
      echo "Generated a persistent NEXTWIKI_SECRET in $secret_file."
    else
      if [ -L "$secret_file" ] || [ ! -f "$secret_file" ] || [ ! -s "$secret_file" ]; then
        echo "Another process published an invalid fallback secret: $secret_file" >&2
        exit 1
      fi
      load_persisted_secret
    fi
    rm -f "$secret_tmp"
    trap - EXIT HUP INT TERM
  fi
  export NEXTWIKI_SECRET
fi

if [ "${#NEXTWIKI_SECRET}" -lt 32 ]; then
  echo "NEXTWIKI_SECRET must contain at least 32 characters." >&2
  exit 1
fi

node node_modules/tsx/dist/cli.mjs scripts/migrate.ts
exec env HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js
