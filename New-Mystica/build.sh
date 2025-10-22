#!/bin/bash
# Build script for New-Mystica iOS app
# Usage: ./build.sh [simulator-name]
# Default simulator: iPhone 17 Pro

SIMULATOR_NAME="${1:-iPhone 17 Pro}"

echo "🔨 Building New-Mystica for iOS Simulator: $SIMULATOR_NAME"
echo ""

xcodebuild -scheme New-Mystica -configuration Debug -destination "platform=iOS Simulator,name=$SIMULATOR_NAME" 2>&1 | tee build.log

BUILD_STATUS=${PIPESTATUS[0]}

echo ""
if [ $BUILD_STATUS -eq 0 ]; then
    echo "✅ Build succeeded"
else
    echo "❌ Build failed"
    echo ""
    echo "Errors:"
    grep "error:" build.log
fi

exit $BUILD_STATUS
