/**
 * TODO: Re-enable after Turso migration
 * 
 * This endpoint is temporarily disabled because it queries sync_status columns  
 * that don't exist in the production Turso database yet.
 * 
 * To re-enable:
 * 1. Run migration: add_sync_status.sql on Turso
 * 2. Uncomment the code below
 * 3. Deploy
 */

// Endpoint disabled until migration
export function GET() {
    return new Response(
        JSON.stringify({
            error: "Endpoint temporarily disabled",
            message: "Sync status tracking not yet available"
        }),
        {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        }
    );
}
