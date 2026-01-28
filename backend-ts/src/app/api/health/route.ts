/**
 * Health Check Route
 * 
 * GET /api/health
 * Check if the backend is running and database is accessible
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function GET(request: NextRequest) {
    try {
        // Test database connection
        const testQuery = await db.select().from(users).limit(1);
        
        return NextResponse.json({
            status: "healthy",
            database: "connected",
            timestamp: new Date().toISOString(),
            env: {
                jwt_secret_set: !!process.env.JWT_SECRET,
                database_url_set: !!process.env.DATABASE_URL,
                ai_engine_url: process.env.AI_ENGINE_URL || "http://localhost:7860",
            }
        });
    } catch (error) {
        console.error("Health check failed:", error);
        return NextResponse.json({
            status: "unhealthy",
            database: "disconnected",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}
