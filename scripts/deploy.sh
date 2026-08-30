#!/usr/bin/env bash
#
# Publish the compiled site to the `deploy` branch.
#
# `master` holds Astro source and gitignores `dist/`, so it is not servable: a
# checkout of it into public_html renders nothing. `deploy` is the other half —
# an orphan branch whose ROOT is the contents of `dist/`, so the checkout root
# is the document root and cPanel can point `public_html` straight at it.
#
# The branch is built with git plumbing (write-tree / commit-tree / update-ref)
# rather than by checking anything out. Nothing here touches your working tree,
# your index, or your current branch — the commit is assembled in a temporary
# index file and the ref is moved when it is complete. A failure part-way
# through leaves the repository exactly as it was found.
#
# Usage:
#   npm run deploy              build the commit and push it to origin
#   npm run deploy -- --local   build the commit, do not push
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$REPO/project/dist"
BRANCH="deploy"
PUSH=1

for arg in "$@"; do
  case "$arg" in
    --local) PUSH=0 ;;
    *) echo "deploy: unknown option '$arg'" >&2; exit 2 ;;
  esac
done

cd "$REPO"

# --- The build has to exist, and has to be a build of THIS source ----------
if [ ! -f "$DIST/index.html" ]; then
  echo "deploy: $DIST/index.html is missing. Run 'npm run build' first." >&2
  exit 1
fi

# .htaccess carries the CSP, the canonical-host redirects and the ACME
# exemption. It reaches dist/ from project/public/ — if it is absent the site
# deploys without any of that, silently.
if [ ! -f "$DIST/.htaccess" ]; then
  echo "deploy: $DIST/.htaccess is missing — the site would deploy with no" >&2
  echo "        security headers and no redirects. Check project/public/." >&2
  exit 1
fi

# A deploy commit claims which source commit it was built from. That claim is
# only true if there is nothing uncommitted, so this refuses a dirty tree
# rather than recording something it cannot stand behind.
if [ -n "$(git status --porcelain)" ]; then
  echo "deploy: the working tree has uncommitted changes." >&2
  echo "        Commit them first — a deploy commit names the source commit it" >&2
  echo "        was built from, and that name has to mean something." >&2
  git status --short >&2
  exit 1
fi

SOURCE_SHA="$(git rev-parse HEAD)"
SOURCE_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# --- Assemble the tree in a temporary index --------------------------------
TMP_INDEX="$(mktemp -u "${TMPDIR:-/tmp}/deploy-index.XXXXXX")"
cleanup() { rm -f "$TMP_INDEX"; }
trap cleanup EXIT

# --force because dist/ is gitignored on the source branch; that ignore rule is
# about master, and is not meant to apply to the branch whose whole purpose is
# to carry the build. Paths are recorded relative to dist/, which is what puts
# index.html at the branch root instead of under dist/.
(
  cd "$DIST"
  GIT_INDEX_FILE="$TMP_INDEX" git --git-dir="$REPO/.git" --work-tree="$DIST" \
    add --all --force .
)
TREE="$(GIT_INDEX_FILE="$TMP_INDEX" git write-tree)"

# --- Skip a commit that would change nothing -------------------------------
PARENT_ARGS=()
if git rev-parse --verify -q "refs/heads/$BRANCH" >/dev/null; then
  PARENT="$(git rev-parse "refs/heads/$BRANCH")"
  PARENT_ARGS=(-p "$PARENT")
  if [ "$(git rev-parse "$PARENT^{tree}")" = "$TREE" ]; then
    echo "deploy: the built site is identical to the tip of '$BRANCH'."
    echo "        Nothing to commit."
    if [ "$PUSH" -eq 1 ]; then
      git push origin "$BRANCH"
    fi
    exit 0
  fi
fi

FILES="$(GIT_INDEX_FILE="$TMP_INDEX" git ls-files | wc -l | tr -d ' ')"

MESSAGE="$(cat <<EOF
deploy: build $(git rev-parse --short HEAD) ($FILES files)

Compiled output of $SOURCE_BRANCH at $SOURCE_SHA.

This branch is generated. Do not edit it by hand and do not merge it into
$SOURCE_BRANCH — it shares no history with the source, and its contents are
the contents of dist/, placed at the branch root so that a checkout of this
branch into public_html is directly servable.

Rebuild it with 'npm run build && npm run deploy'.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"

COMMIT="$(git commit-tree "$TREE" "${PARENT_ARGS[@]}" -m "$MESSAGE")"
git update-ref "refs/heads/$BRANCH" "$COMMIT" ${PARENT_ARGS[1]:+"${PARENT_ARGS[1]}"}

echo "deploy: $BRANCH -> $(git rev-parse --short "$COMMIT")  ($FILES files, built from $(git rev-parse --short "$SOURCE_SHA"))"

if [ "$PUSH" -eq 1 ]; then
  git push origin "$BRANCH"
else
  echo "deploy: --local given, not pushed. Push with: git push origin $BRANCH"
fi
