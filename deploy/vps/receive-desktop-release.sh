#!/usr/bin/env bash
# Put one desktop-app release live in the gated downloads folder, on the VPS. The ONLY command the desktop
# repo's release key may run (forced in root's ~/.ssh/authorized_keys, one line):
#   restrict,command="/root/deadly-drops/receive-desktop-release.sh" ssh-ed25519 AAAA... ddp-desktop-release
# GitHub Actions in the desktop repo (release-desktop.yml) and deploy/vps/publish-desktop.sh (a laptop) both pipe
# it an uncompressed tar of electron-builder's output, signed, the files at the top level:
#   latest.yml, DeadlyDropsPickleball-Setup-X.Y.Z.exe and (optional) DeadlyDropsPickleball-Setup-X.Y.Z.exe.blockmap
# deploy.sh and ci-deploy.sh install it as /root/deadly-drops/receive-desktop-release.sh, next to the public key
# it checks signatures with (desktop-update-signing.pub.pem). Operations: RUNBOOK.md, Desktop app releases.
#
# Nothing from the client reaches it but that archive: SSH_ORIGINAL_COMMAND is ignored and the forced command
# passes no arguments. The whole archive is checked before anything goes live:
#   - it arrives within 15 minutes, 600 MB at most;
#   - plain files with exactly those names (no folders, links, devices or paths), none listed (or unpacking)
#     larger than the archive may be, so a sparse entry can't blow up on disk;
#   - latest.yml's version, path, its one file entry (url, sha512, size) and top-level sha512 match the installer,
#     and its ddpSignature line is an ed25519 signature by the release key over
#       ddp-desktop-update-v1 \n version=… \n url=… \n sha512=… \n size=…   (no trailing newline)
#     checked with OpenSSL 3 (pkeyutl -rawin). The app checks the same signature with its own copy of the key.
#   - the version is newer than the live one (sort -V). The same version with the same sha512 is "already live"
#     (exit 0, so a re-run is harmless). The same version built again (another sha512), or an older one, is
#     refused: installed copies only ever move up, so a fix ships as a higher version.
# The installer and blockmap go into place first and latest.yml last, each by a rename, so the feed never names a
# file that isn't there. The 3 newest installers and their blockmaps stay (older copies update from them
# differentially); older ones are deleted, never the one latest.yml names. Dot-named files (the temp files below,
# the lock) are never served (Caddyfile: hide .*).
#
# Local tests only (run it directly):
#   --root <dir>     publish into <dir> instead of the server's folder
#   --pubkey <file>  check signatures with this public key instead of the server's
set -euo pipefail
umask 022
unset SSH_ORIGINAL_COMMAND   # whatever the client asked to run: never used

ROOT=/root/deadly-drops/downloads/desktop
PUBKEY=/root/deadly-drops/desktop-update-signing.pub.pem
FEED_URL=https://ddptournaments.com/downloads/desktop/
MAX_BYTES=$((600 * 1024 * 1024))   # the archive, all files together
READ_TIMEOUT=900                   # seconds for the whole upload: a sender that stalls is cut off
MAX_YML_BYTES=65536
KEEP=3
PREFIX=DeadlyDropsPickleball-Setup-
ver_re='^[0-9]+\.[0-9]+\.[0-9]+$'
exe_re='^DeadlyDropsPickleball-Setup-[0-9]+\.[0-9]+\.[0-9]+\.exe$'
sig_re='^[A-Za-z0-9+/]{86}==$'     # 64 bytes, standard base64 with padding

die() { echo "ERROR: $*" >&2; exit 1; }
usage() { echo "Usage: receive-desktop-release.sh [--root <dir>] [--pubkey <file>] < release.tar" >&2; exit 2; }
# a name or value from the archive, safe to print
safe() { printf '%s' "${1//[^A-Za-z0-9._+\/=: -]/?}"; }
# latest.yml's top-level `key: value` (the first one), without quotes, CR or trailing spaces
top() { sed -n "/^$1:/{s/^$1:[[:space:]]*//p;q}" "$2" | tr -d "\"'\r" | sed 's/[[:space:]]*$//'; }
top_count() { grep -c "^$1:" "$2" || true; }
# the same for the indented keys (the one entry under files:)
nested() { sed -E -n "s/^[[:space:]]+(-[[:space:]]+)?$1:[[:space:]]*//p" "$2" | tr -d "\"'\r" | sed 's/[[:space:]]*$//'; }
nested_count() { grep -Ec "^[[:space:]]+(-[[:space:]]+)?$1:" "$2" || true; }

while [ $# -gt 0 ]; do
  case "$1" in
    --root) if [ $# -lt 2 ] || [ -z "$2" ]; then usage; fi; ROOT=$2; shift 2 ;;
    --pubkey) if [ $# -lt 2 ] || [ -z "$2" ]; then usage; fi; PUBKEY=$2; shift 2 ;;
    *) usage ;;
  esac
done
if [ -t 0 ]; then die "pipe it a tar of the release (see deploy/vps/publish-desktop.sh)"; fi

# Signatures need OpenSSL 3 (ed25519 with -rawin). Without it, refuse: never publish unchecked.
ossl="$(openssl version 2>/dev/null || true)"
if [[ ! $ossl =~ ^OpenSSL\ ([0-9]+)\. ]] || [ "${BASH_REMATCH[1]}" -lt 3 ]; then
  die "checking release signatures needs OpenSSL 3 or newer (found: ${ossl:-no openssl}); nothing was published"
fi
[ -f "$PUBKEY" ] && [ -r "$PUBKEY" ] || die "no release-signing public key at $PUBKEY (a deploy installs it); nothing was published"
PUBKEY="$(cd "$(dirname -- "$PUBKEY")" && pwd)/$(basename -- "$PUBKEY")"
[[ "$(openssl pkey -pubin -in "$PUBKEY" -noout -text 2>/dev/null || true)" == ED25519* ]] ||
  die "$PUBKEY isn't an ed25519 public key; nothing was published"

mkdir -p -- "$ROOT"
cd -- "$ROOT"

# One publish at a time, taken before this run makes any temp file, so the holder may sweep up after runs that died
if command -v flock >/dev/null 2>&1; then
  exec 9>.release.lock
  flock -w 300 9 || die "another publish has held the lock for 5 minutes"
  find . -maxdepth 1 \( -name '.incoming.*' -o -name '.extract.*' \) -exec rm -rf -- {} +
else
  echo "WARNING: no flock on this machine, so no lock: never run two publishes at once here" >&2
fi

incoming=
work=
cleanup() {
  if [ -n "$incoming" ]; then rm -f -- "$incoming"; fi
  if [ -n "$work" ]; then rm -rf -- "$work"; fi
}
trap cleanup EXIT

# --- 1. Receive: capped in size and time ------------------------------------------------------------------------
incoming="$(mktemp .incoming.XXXXXX)"
timeout "$READ_TIMEOUT" head -c "$((MAX_BYTES + 1))" > "$incoming" ||
  die "the upload didn't arrive whole within $READ_TIMEOUT s (stalled or cut off)"
bytes="$(stat -c %s -- "$incoming")"
[ "$bytes" -gt 0 ] || die "nothing arrived on stdin"
[ "$bytes" -le "$MAX_BYTES" ] || die "the archive is over the $((MAX_BYTES / 1024 / 1024)) MB limit"

# --- 2. Check every entry before extracting anything ------------------------------------------------------------
names="$(tar -tf - < "$incoming")" || die "that isn't an uncompressed tar archive"
listing="$(tar --numeric-owner -tvf - < "$incoming")" || die "that isn't an uncompressed tar archive"
[ -n "$names" ] || die "the archive is empty"
exe= map= n_exe=0 n_map=0 n_yml=0 count=0
while IFS= read -r name; do
  count=$((count + 1))
  if [ "$name" = latest.yml ]; then
    n_yml=$((n_yml + 1))
  elif [[ $name =~ $exe_re ]]; then
    exe=$name
    n_exe=$((n_exe + 1))
  elif [[ $name == *.blockmap && ${name%.blockmap} =~ $exe_re ]]; then
    map=$name
    n_map=$((n_map + 1))
  else
    die "the archive may hold only latest.yml, the installer and its blockmap, not: $(safe "$name")"
  fi
done <<<"$names"
if [ "$n_yml" -ne 1 ] || [ "$n_exe" -ne 1 ] || [ "$n_map" -gt 1 ]; then
  die "the archive must hold latest.yml and one installer (and at most its blockmap), each once"
fi
if [ -n "$map" ] && [ "$map" != "$exe.blockmap" ]; then die "$map isn't the blockmap of $exe"; fi
# GNU tar's verbose listing: type+mode, uid/gid, size, date, time, name. Type '-' is a plain file ('d' a folder,
# 'l' a symlink, 'h' a hard link, 'S' or a GNU.sparse header a sparse file, ...). The size is what the entry
# unpacks to, so a sparse entry that would grow past the limit is caught here, before it touches the disk.
[ "$(wc -l <<<"$listing")" -eq "$count" ] || die "the archive's listings disagree"
declare -A listed=()
total=0
while IFS= read -r line; do
  read -r mode _ esize _ _ entry extra <<<"$line"
  [ "${mode:0:1}" = - ] || die "the archive may hold plain files only, not: $(safe "$line")"
  if [ -z "$entry" ] || [ -n "$extra" ] || [[ ! $esize =~ ^[0-9]{1,12}$ ]]; then
    die "can't read this archive entry: $(safe "$line")"
  fi
  [ "$esize" -le "$MAX_BYTES" ] || die "$(safe "$entry") would unpack to $esize bytes, over the limit"
  total=$((total + esize))
  listed[$entry]=$esize
done <<<"$listing"
[ "$total" -le "$MAX_BYTES" ] || die "the archive would unpack to $total bytes, over the limit"

# --- 3. Extract (named files only, no owners or modes from the archive) ---------------------------------------
files=(latest.yml "$exe")
if [ -n "$map" ]; then files+=("$map"); fi
for f in "${files[@]}"; do
  [ -n "${listed[$f]+set}" ] || die "the archive's listings disagree about $f"
done
work="$(mktemp -d .extract.XXXXXX)"
tar -xf - -C "$work" --no-same-owner --no-same-permissions "${files[@]}" < "$incoming"
rm -f -- "$incoming"
incoming=
for f in "${files[@]}"; do
  if [ ! -f "$work/$f" ] || [ -L "$work/$f" ]; then die "$f didn't arrive as a plain file"; fi
  [ "$(stat -c %s -- "$work/$f")" = "${listed[$f]}" ] || die "$f unpacked to another size than the archive lists"
done
[ "$(find "$work" -mindepth 1 | wc -l)" -eq "${#files[@]}" ] || die "the archive unpacked to more than its files"
[ -s "$work/$exe" ] || die "$exe is empty"

# --- 4. latest.yml: as electron-builder writes it, matching the installer, signed --------------------------------
yml="$work/latest.yml"
[ "$(stat -c %s -- "$yml")" -le "$MAX_YML_BYTES" ] || die "latest.yml is over $((MAX_YML_BYTES / 1024)) KB"
for key in version files path sha512 ddpSignature; do
  [ "$(top_count "$key" "$yml")" = 1 ] || die "latest.yml must have exactly one top-level '$key:' line"
done
[ "$(grep -Ec '^[[:space:]]+-[[:space:]]' "$yml" || true)" = 1 ] || die "latest.yml must list exactly one file"
for key in url sha512 size; do
  [ "$(nested_count "$key" "$yml")" = 1 ] || die "latest.yml's file entry must have exactly one '$key:'"
done

version="$(top version "$yml")"
[[ $version =~ $ver_re ]] || die "latest.yml's version must be X.Y.Z, not: $(safe "$version")"
[ "$exe" = "$PREFIX$version.exe" ] || die "latest.yml is for $version, but the installer is $exe"
[ "$(top path "$yml")" = "$exe" ] || die "latest.yml's path is '$(safe "$(top path "$yml")")', not $exe"
url="$(nested url "$yml")"
[ "$url" = "$exe" ] || die "latest.yml's file is '$(safe "$url")', not $exe"
size="$(nested size "$yml")"
[ "$size" = "$(stat -c %s -- "$work/$exe")" ] || die "latest.yml's size ('$(safe "$size")') isn't $exe's"
actual="$(openssl dgst -sha512 -binary "$work/$exe" | base64 -w0)"
sha="$(nested sha512 "$yml")"
[ "$sha" = "$actual" ] && [ "$(top sha512 "$yml")" = "$actual" ] ||
  die "latest.yml's sha512 doesn't match $exe (a stale or altered latest.yml?)"

sig="$(top ddpSignature "$yml")"
[[ $sig =~ $sig_re ]] || die "latest.yml's ddpSignature isn't 88 characters of base64"
printf 'ddp-desktop-update-v1\nversion=%s\nurl=%s\nsha512=%s\nsize=%s' "$version" "$url" "$sha" "$size" > "$work/.message"
printf '%s' "$sig" | base64 -d > "$work/.signature"
[ "$(stat -c %s -- "$work/.signature")" = 64 ] || die "latest.yml's ddpSignature isn't 64 bytes"
openssl pkeyutl -verify -pubin -inkey "$PUBKEY" -rawin -in "$work/.message" -sigfile "$work/.signature" \
  >/dev/null 2>&1 || die "latest.yml's ddpSignature doesn't verify: not signed with the release key, or changed after signing"
echo "Signature on $version verified."

# --- 5. Newer than the live one? ----------------------------------------------------------------------------------
if [ -f latest.yml ]; then
  live="$(top version latest.yml)"
  [[ $live =~ $ver_re ]] || die "the live latest.yml has no X.Y.Z version ('$(safe "$live")'): fix it by hand first"
  if [ "$version" = "$live" ]; then
    [ "$actual" = "$(top sha512 latest.yml)" ] ||
      die "$version is already live as a different build (another sha512): raise the version and release again"
    if [ -f "$exe" ]; then
      echo "$version is already live (the same build): nothing to do."
      exit 0
    fi
    echo "$version is live but $exe is missing: putting it back."
  elif [ "$(printf '%s\n%s\n' "$version" "$live" | sort -V | tail -n 1)" != "$version" ]; then
    die "$version is older than the live $live: installed copies never move down, so release a version above $live"
  fi
fi

# --- 6. Install: installer and blockmap first, latest.yml last ----------------------------------------------------
chmod 644 -- "${files[@]/#/$work/}"
if [ "$(id -u)" = 0 ]; then chown 0:0 -- "${files[@]/#/$work/}"; fi
mv -f -T -- "$work/$exe" "$exe"
if [ -n "$map" ]; then
  mv -f -T -- "$work/$map" "$map"
else
  rm -f -- "$exe.blockmap"   # one left by an earlier attempt would belong to another build
  echo "WARNING: no blockmap in this release, so updates to it download the whole installer" >&2
fi
mv -f -T -- "$work/latest.yml" latest.yml

# --- 7. Keep the newest installers (by version), never the one latest.yml names -----------------------------------
current="$(top path latest.yml)"
find . -maxdepth 1 -type f -name "$PREFIX*.exe" -printf '%f\n' |
  sed -E -n "s/^$PREFIX([0-9]+\.[0-9]+\.[0-9]+)\.exe\$/\1/p" | sort -V -r | tail -n +$((KEEP + 1)) |
  while IFS= read -r v; do
    old="$PREFIX$v.exe"
    if [ "$old" = "$current" ]; then continue; fi
    rm -f -- "$old" "$old.blockmap"
    echo "Removed $old (only the newest $KEEP are kept)"
  done

echo "Published $version: $exe, $(awk -v b="$size" 'BEGIN { printf "%.1f MB", b / 1048576 }') ($size bytes)${map:+, with its blockmap}"
echo "Installers on the server: $(find . -maxdepth 1 -type f -name "$PREFIX*.exe" -printf '%f\n' | sort -V -r | tr '\n' ' ')"
echo "Feed: $FEED_URL"
