#!/bin/zsh
# Helper script to run the image resize task and then commit & push the changes.
# Usage: cd /path/to/sbs-media && ./scripts/resize-and-push.sh

set -e

# run the thumbnail generator
npm run make-small

echo "Staging changes..."
git add .

echo "Creating commit..."
# you can override the message by passing an argument to the script
MSG=${1:-"image resized feature1"}
git commit -m "$MSG"

echo "Pushing (force)..."
git push --force

echo "Done!"