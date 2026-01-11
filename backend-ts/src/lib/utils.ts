import { v4 as uuidv4 } from "uuid";

/**
 * Generates a UUID string for use as primary keys.
 * Preserves the same format as the Python backend.
 */
export function generateId(): string {
    return uuidv4();
}

/**
 * Returns the current ISO 8601 timestamp.
 */
export function now(): string {
    return new Date().toISOString();
}
