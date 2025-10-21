#!/bin/bash

# Test Profile Initialization Endpoint
#
# This script tests the POST /api/v1/profile/init endpoint
# Requires a valid JWT token for authentication

set -e

BASE_URL="http://localhost:3000"
JWT_TOKEN="${1:-your-jwt-token-here}"

if [ "$JWT_TOKEN" = "your-jwt-token-here" ]; then
    echo "Usage: $0 <jwt-token>"
    echo "Example: $0 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    exit 1
fi

echo "Testing Profile Initialization Endpoint..."
echo "Base URL: $BASE_URL"
echo "Token: ${JWT_TOKEN:0:20}..."
echo ""

# Test 1: Initialize profile (should return 201)
echo "Test 1: Initialize new profile"
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    "$BASE_URL/api/v1/profile/init")

http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_CODE:/d')

echo "Status: $http_code"
echo "Response: $body"
echo ""

if [ "$http_code" = "201" ]; then
    echo "✅ Profile initialization successful"
elif [ "$http_code" = "409" ]; then
    echo "⚠️  Profile already exists (expected if run multiple times)"
else
    echo "❌ Unexpected status code: $http_code"
fi

echo ""

# Test 2: Try to initialize again (should return 409)
echo "Test 2: Try to initialize existing profile (should fail)"
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    "$BASE_URL/api/v1/profile/init")

http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_CODE:/d')

echo "Status: $http_code"
echo "Response: $body"

if [ "$http_code" = "409" ]; then
    echo "✅ Duplicate prevention working correctly"
else
    echo "⚠️  Expected 409 Conflict, got $http_code"
fi

echo ""
echo "Profile initialization tests complete!"