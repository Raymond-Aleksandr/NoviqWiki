#!/bin/sh

resolve_noviqwiki_secret() {
  secret_dir=$(node -e 'process.stdout.write(require("path").resolve(process.argv[1]))' "${NOVIQWIKI_SECRET_DIR:-/app/secrets}")
  secret_file="$secret_dir/noviqwiki-secret"

  if [ "$secret_dir" = "/" ]; then
    echo "Refusing to use the filesystem root as NOVIQWIKI_SECRET_DIR." >&2
    exit 1
  fi

  load_persisted_secret() {
    secret_metadata=$(node -e 'const value = require("fs").statSync(process.argv[1]); process.stdout.write(`${value.uid} ${(value.mode & 0o777).toString(8)}`)' "$secret_file")
    secret_owner=${secret_metadata%% *}
    if [ "$secret_owner" != "$(id -u)" ]; then
      echo "Refusing a fallback secret owned by another user: $secret_file" >&2
      exit 1
    fi
    secret_mode=${secret_metadata#* }
    if [ "$secret_mode" != "600" ]; then
      chmod 600 "$secret_file"
    fi
    NOVIQWIKI_SECRET=$(cat "$secret_file")
  }

  if [ -L "$secret_dir" ]; then
    echo "Refusing a symbolic-link NOVIQWIKI_SECRET_DIR: $secret_dir" >&2
    exit 1
  fi

  if [ -n "${NOVIQWIKI_SECRET:-}" ] && [ "${#NOVIQWIKI_SECRET}" -lt 32 ]; then
    echo "NOVIQWIKI_SECRET must contain at least 32 characters." >&2
    exit 1
  fi

  if [ -n "${NOVIQWIKI_SECRET:-}" ]; then
    if [ -e "$secret_file" ] || [ -L "$secret_file" ]; then
      rm -f "$secret_file"
      echo "Removed the persisted fallback because an explicit NOVIQWIKI_SECRET is active."
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
      secret_tmp=$(mktemp "$secret_file.tmp.XXXXXX")
      trap 'rm -f "$secret_tmp"' EXIT HUP INT TERM
      (umask 077; printf '%s\n' "$generated_secret" > "$secret_tmp")
      published_secret=0
      if ln "$secret_tmp" "$secret_file" 2>/dev/null; then
        published_secret=1
      elif [ -L "$secret_file" ] || [ ! -f "$secret_file" ] || [ ! -s "$secret_file" ]; then
        echo "Another process published an invalid fallback secret: $secret_file" >&2
        exit 1
      fi
      load_persisted_secret
      if [ "$published_secret" -eq 1 ]; then
        echo "Generated a persistent NOVIQWIKI_SECRET in $secret_file."
      fi
      rm -f "$secret_tmp"
      trap - EXIT HUP INT TERM
    fi
  fi

  if [ "${#NOVIQWIKI_SECRET}" -lt 32 ]; then
    echo "NOVIQWIKI_SECRET must contain at least 32 characters." >&2
    exit 1
  fi
  export NOVIQWIKI_SECRET
}
