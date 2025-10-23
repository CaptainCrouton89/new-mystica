#!/bin/bash
# Build script for New-Mystica iOS app
# Usage: ./build.sh [simulator-name]
# Default simulator: iPhone 17 Pro

# Get the directory where this script lives and cd to it
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SIMULATOR_NAME="${1:-iPhone 17 Pro}"

xcodebuild -scheme New-Mystica -configuration Debug -destination "platform=iOS Simulator,name=$SIMULATOR_NAME" > build.log 2>&1

BUILD_STATUS=$?

if [ $BUILD_STATUS -eq 0 ]; then
    echo "✅ Build succeeded"
else
    echo "❌ Build failed"
    echo ""
    grep "error:" build.log
fi

exit $BUILD_STATUS
