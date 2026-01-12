/**
 * Template Queries - Drizzle ORM
 * 
 * All template-related database operations.
 */

import { db } from "@/db";
import { templates } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// =============================================================================
// Template CRUD
// =============================================================================

export async function getTemplatesByOwnerId(ownerId: string) {
    return db.select()
        .from(templates)
        .where(eq(templates.ownerId, ownerId))
        .orderBy(desc(templates.createdAt));
}

export async function getTemplateById(id: string) {
    const result = await db.select()
        .from(templates)
        .where(eq(templates.id, id))
        .limit(1);
    return result[0] || null;
}

export async function createTemplate(data: {
    name: string;
    body: string;
    ownerId: string;
    triggerClassification?: string;
}) {
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.insert(templates).values({
        id,
        name: data.name,
        body: data.body,
        ownerId: data.ownerId,
        triggerClassification: data.triggerClassification || null,
        createdAt: now,
    });

    return { id, ...data, createdAt: now };
}

export async function updateTemplate(id: string, data: Partial<{
    name: string;
    body: string;
    triggerClassification: string;
}>) {
    await db.update(templates).set(data).where(eq(templates.id, id));
}

export async function deleteTemplate(id: string) {
    await db.delete(templates).where(eq(templates.id, id));
}

export async function getTemplateByClassification(ownerId: string, classification: string) {
    const result = await db.select()
        .from(templates)
        .where(and(
            eq(templates.ownerId, ownerId),
            eq(templates.triggerClassification, classification)
        ))
        .limit(1);
    return result[0] || null;
}
