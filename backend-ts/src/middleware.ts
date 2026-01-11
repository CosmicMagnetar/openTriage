import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// CORS configuration
const allowedOrigins = [
    "http://localhost:5173",     // Vite dev
    "http://localhost:3000",     // Next.js dev
    "https://open-triage.vercel.app",
    "https://opentriage.onrender.com",
];

export function middleware(request: NextRequest) {
    const origin = request.headers.get("origin") || "";
    const isAllowedOrigin = allowedOrigins.includes(origin);

    // Handle preflight requests
    if (request.method === "OPTIONS") {
        return new NextResponse(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": isAllowedOrigin ? origin : "",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Max-Age": "86400",
            },
        });
    }

    // Handle actual requests
    const response = NextResponse.next();

    if (isAllowedOrigin) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return response;
}

// Apply middleware to all API routes
export const config = {
    matcher: "/api/:path*",
};
