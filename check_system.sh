#!/bin/bash

echo "🔍 OpenTriage System Check"
echo "=========================="
echo ""

# Check Backend
echo "1️⃣ Backend Health Check"
BACKEND_HEALTH=$(curl -s http://localhost:8000/health)
echo "   Response: $BACKEND_HEALTH"
if echo "$BACKEND_HEALTH" | grep -q "healthy"; then
    echo "   ✅ Backend is healthy"
else
    echo "   ❌ Backend is not responding correctly"
fi
echo ""

# Check Frontend
echo "2️⃣ Frontend Status"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "   ✅ Frontend is running (HTTP $FRONTEND_STATUS)"
else
    echo "   ❌ Frontend returned HTTP $FRONTEND_STATUS"
fi
echo ""

# Check Backend Configuration
echo "3️⃣ Backend Configuration"
cd backend
CONFIG=$(python -c "from config.settings import settings; print(f'API_URL={settings.API_URL}|FRONTEND_URL={settings.FRONTEND_URL}')" 2>/dev/null)
if [ $? -eq 0 ]; then
    API_URL=$(echo $CONFIG | cut -d'|' -f1 | cut -d'=' -f2)
    FRONTEND_URL=$(echo $CONFIG | cut -d'|' -f2 | cut -d'=' -f2)
    echo "   API_URL: $API_URL"
    echo "   FRONTEND_URL: $FRONTEND_URL"
    
    if [ "$API_URL" = "http://localhost:8000" ] && [ "$FRONTEND_URL" = "http://localhost:3000" ]; then
        echo "   ✅ Configuration is set for local development"
    else
        echo "   ⚠️  Configuration might be using production URLs"
    fi
else
    echo "   ❌ Could not read configuration"
fi
cd ..
echo ""

# Check if GitHub OAuth is configured
echo "4️⃣ GitHub OAuth Configuration"
if [ -f "backend/.env" ]; then
    if grep -q "GITHUB_CLIENT_ID" backend/.env && grep -q "GITHUB_CLIENT_SECRET" backend/.env; then
        echo "   ✅ GitHub OAuth credentials found in .env"
        
        # Check if they're set (not empty)
        CLIENT_ID=$(grep "GITHUB_CLIENT_ID" backend/.env | cut -d'=' -f2)
        if [ -n "$CLIENT_ID" ] && [ "$CLIENT_ID" != "your_client_id_here" ]; then
            echo "   ✅ GITHUB_CLIENT_ID is configured"
        else
            echo "   ⚠️  GITHUB_CLIENT_ID needs to be set"
        fi
    else
        echo "   ⚠️  GitHub OAuth credentials not found in .env"
    fi
else
    echo "   ❌ backend/.env file not found"
fi
echo ""

# Check Frontend Environment
echo "5️⃣ Frontend Configuration"
if [ -f "frontend/.env" ]; then
    BACKEND_URL=$(grep "VITE_BACKEND_URL" frontend/.env | cut -d'=' -f2)
    echo "   VITE_BACKEND_URL: $BACKEND_URL"
    
    if [ "$BACKEND_URL" = "http://localhost:8000" ]; then
        echo "   ✅ Frontend is configured to use local backend"
    else
        echo "   ⚠️  Frontend might be using production backend"
    fi
else
    echo "   ❌ frontend/.env file not found"
fi
echo ""

# Test API Endpoints
echo "6️⃣ Testing API Endpoints"

# Test a public endpoint
echo "   Testing /health endpoint..."
if curl -s http://localhost:8000/health | grep -q "healthy"; then
    echo "   ✅ /health endpoint working"
else
    echo "   ❌ /health endpoint failed"
fi

echo ""
echo "=========================="
echo "📊 Summary"
echo "=========================="
echo ""
echo "Your OpenTriage application is running on:"
echo "  🌐 Frontend: http://localhost:3000"
echo "  🔧 Backend:  http://localhost:8000"
echo "  📚 API Docs: http://localhost:8000/docs"
echo ""
echo "To test the new GitHub comment feature:"
echo "  1. Make sure your GitHub OAuth App callback URL is set to:"
echo "     http://localhost:8000/api/auth/github/callback"
echo "  2. Open http://localhost:3000 in your browser"
echo "  3. Login with GitHub"
echo "  4. Select an issue with GitHub metadata (owner, repo, number)"
echo "  5. Use the Quick Reply feature to post a comment"
echo ""
