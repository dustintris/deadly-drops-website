#!/usr/bin/env bash
# Publish a desktop-app release from a laptop: the fallback for GitHub Actions in the desktop repo
# (release-desktop.yml), which normally does this on every merge to main that raises the version. It pipes the
# same tar to the same receiver on the server (receive-desktop-release.sh), which checks it and puts it live,
# over your normal root ssh access. Operations: deploy/vps/RUNBOOK.md (Desktop app releases).
#
#   bash deploy/vps/publish-desktop.sh <release dir> [host]   # from the repo root, in Git Bash
#
# <release dir>: electron-builder's output (apps/desktop/release in the desktop repo). The newest installer in it
# is sent, with its .blockmap and latest.yml, which must name that installer and be signed first: the desktop
# repo's sign script adds the ddpSignature line (it needs the release signing key). [host]: an ssh target with root
# access; default $DEPLOY_HOST, else root@179.66.153.48 (the dedicated server). The receiver gets there with a
# deploy (deploy.sh or CI), so the server needs one from after it was added.
set -euo pipefail

die() { echo "ERROR: $*" >&2; exit 1; }
[ $# -ge 1 ] && [ $# -le 2 ] || { echo "Usage: bash deploy/vps/publish-desktop.sh <release dir> [host]" >&2; exit 2; }
dir=$1
HOST="${2:-${DEPLOY_HOST:-root@179.66.153.48}}"
# pasted into the ssh command line: a plain user@host or ssh alias only
[[ $HOST =~ ^[A-Za-z0-9][A-Za-z0-9._@-]*$ ]] || die "not a plain ssh target: $HOST"
[ -d "$dir" ] || die "no such folder: $dir"
[ -f "$dir/latest.yml" ] || die "no latest.yml in $dir (build with electron-builder first)"

P=DeadlyDropsPickleball-Setup-
newest="$(find "$dir" -maxdepth 1 -type f -name "$P*.exe" -printf '%f\n' |
  sed -E -n "/^$P[0-9]+\.[0-9]+\.[0-9]+\.exe\$/p" | sort -V | tail -n 1)"
[ -n "$newest" ] || die "no ${P}X.Y.Z.exe in $dir"
named="$(sed -n '/^path:/{s/^path:[[:space:]]*//p;q}' "$dir/latest.yml" | tr -d "\"'\r" | sed 's/[[:space:]]*$//')"
[ "$named" = "$newest" ] || die "the newest installer in $dir is $newest, but latest.yml names '$named': rebuild"
# The receiver (and the app) accept only releases signed with the release key, as CI signs them
signatures="$(grep -c '^ddpSignature:' "$dir/latest.yml" || true)"
if [ "$signatures" != 1 ]; then
  die "latest.yml has $signatures ddpSignature lines, not 1: sign it once with the desktop repo's sign script (it needs the release signing key), then run this again"
fi

files=(latest.yml "$newest")
if [ -f "$dir/$newest.blockmap" ]; then
  files+=("$newest.blockmap")
else
  echo "WARNING: no $newest.blockmap, so updates to it download the whole installer" >&2
fi

echo "==> Sending ${files[*]} to $HOST"
# The receiver checks everything (names, sha512, version) and says what it did
tar -cf - -C "$dir" "${files[@]}" | ssh "$HOST" /root/deadly-drops/receive-desktop-release.sh
