#!/usr/bin/env bash
# Mirror the current committed HEAD to the user's GitHub repository, INCLUDING assets/models.
#
# Why a script: in the Manus repo the binary models are git-ignored (they live in Manus Storage and are
# restored from assets.lock.json). For the later AntiGravity phase the GitHub repo must contain them,
# so this builds a *separate linear history* whose trees = HEAD tree + assets/models. Nothing here
# touches the Manus canonical history, global git config, or gh config. Never force-pushes.
#
#   scripts/mirror-github.sh            # mirror HEAD
#   REPO=owner/name scripts/mirror-github.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

REPO="${REPO:-walidelsayedgemini-dev/the-last-thread}"
URL="https://github.com/${REPO}.git"
REF="refs/mirror/github"
MSG="$(git log -1 --pretty=%B HEAD)"
NAME="$(gh api user --jq '.login')"
EMAIL="$(gh api user --jq '.id')+${NAME}@users.noreply.github.com"
AUTH=(-c "user.name=${NAME}" -c "user.email=${EMAIL}" -c credential.helper= -c "credential.helper=!gh auth git-credential")

TMP_INDEX="$(mktemp -u)"
trap 'rm -f "$TMP_INDEX"' EXIT
export GIT_INDEX_FILE="$TMP_INDEX"
git read-tree HEAD
if [ -d assets/models ]; then git add -f assets/models; fi
TREE="$(git write-tree)"
unset GIT_INDEX_FILE

PARENT_ARGS=()
if git rev-parse -q --verify "$REF" >/dev/null; then
  PARENT="$(git rev-parse "$REF")"
  # Nothing new: same tree as the last mirrored commit.
  if [ "$(git rev-parse "${PARENT}^{tree}")" = "$TREE" ]; then echo "mirror: already up to date"; exit 0; fi
  PARENT_ARGS=(-p "$PARENT")
else
  # First run or fresh clone: continue from the remote tip when it exists so history stays linear.
  REMOTE_TIP="$(git "${AUTH[@]}" ls-remote "$URL" refs/heads/main | cut -f1 || true)"
  if [ -n "$REMOTE_TIP" ]; then
    git "${AUTH[@]}" fetch --quiet "$URL" main
    PARENT_ARGS=(-p "$REMOTE_TIP")
  fi
fi

COMMIT="$(git "${AUTH[@]}" commit-tree "$TREE" "${PARENT_ARGS[@]}" -m "$MSG")"
git update-ref "$REF" "$COMMIT"
git "${AUTH[@]}" push "$URL" "$REF:refs/heads/main"
echo "mirror: pushed ${COMMIT:0:7} to ${REPO}"
