#!/bin/bash

# Messaging System Test Script
# This script tests the messaging endpoints to verify the fixes

echo "🔍 Testing OpenTriage Messaging System..."
echo ""

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        echo -e "${YELLOW}  Response: $3${NC}"
    fi
}

# Test 1: Health Check
echo "Test 1: Health Check"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    print_result 0 "Health endpoint responding"
    echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
else
    print_result 1 "Health endpoint failed" "$RESPONSE_BODY"
fi
echo ""

# Test 2: Authentication Check (if token provided)
if [ -n "$AUTH_TOKEN" ]; then
    echo "Test 2: Conversations Endpoint"
    CONV_RESPONSE=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        "$BACKEND_URL/api/messaging/conversations")
    HTTP_CODE=$(echo "$CONV_RESPONSE" | tail -n1)
    RESPONSE_BODY=$(echo "$CONV_RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        print_result 0 "Conversations endpoint working"
        echo "$RESPONSE_BODY" | jq '.conversations | length' 2>/dev/null | \
            xargs -I {} echo "  Found {} conversations"
    elif [ "$HTTP_CODE" -eq 401 ]; then
        print_result 1 "Authentication failed" "Invalid or expired token"
    else
        print_result 1 "Conversations endpoint failed" "$RESPONSE_BODY"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠ Skipping authenticated tests (no AUTH_TOKEN provided)${NC}"
    echo "To test authenticated endpoints, set AUTH_TOKEN:"
    echo "  export AUTH_TOKEN='your_jwt_token'"
    echo ""
fi

# Test 3: Check environment variables
echo "Test 3: Environment Configuration"
if echo "$RESPONSE_BODY" | grep -q "jwt_secret_set"; then
    JWT_SET=$(echo "$RESPONSE_BODY" | jq -r '.env.jwt_secret_set' 2>/dev/null)
    DB_SET=$(echo "$RESPONSE_BODY" | jq -r '.env.database_url_set' 2>/dev/null)
    
    if [ "$JWT_SET" = "true" ]; then
        print_result 0 "JWT_SECRET is configured"
    else
        print_result 1 "JWT_SECRET is missing" "Check backend-ts/.env.local"
    fi
    
    if [ "$DB_SET" = "true" ]; then
        print_result 0 "DATABASE_URL is configured"
    else
        print_result 1 "DATABASE_URL is missing" "Check backend-ts/.env.local"
    fi
else
    echo -e "${YELLOW}⚠ Could not check environment variables${NC}"
fi
echo ""

# Summary
echo "========================================="
echo "Testing complete!"
echo ""
echo "If any tests failed:"
echo "1. Ensure backend is running: cd backend-ts && npm run dev"
echo "2. Check .env.local has all required variables"
echo "3. See MESSAGING_FIXES.md for detailed troubleshooting"
echo ""
echo "To get your auth token:"
echo "1. Log in to the frontend"
echo "2. Open browser DevTools > Application > Local Storage"
echo "3. Copy the 'token' value"
echo "4. Run: export AUTH_TOKEN='your_token_here'"
