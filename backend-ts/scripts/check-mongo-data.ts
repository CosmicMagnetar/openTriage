import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function check() {
    const mongoUri = process.env.MONGO_URL;
    const mongoClient = new MongoClient(mongoUri!);
    await mongoClient.connect();
    const db = mongoClient.db(process.env.DB_NAME || "opentriage_db");

    console.log("Checking MongoDB collections...\n");

    // Check mentors
    const mentors = await db.collection("mentors").find().toArray();
    console.log(`Mentors: ${mentors.length}`);
    if (mentors.length > 0) {
        console.log("First mentor:", JSON.stringify(mentors[0], null, 2));
    }

    // Check trophies/badges
    const trophies = await db.collection("trophies").find().toArray();
    console.log(`\nTrophies: ${trophies.length}`);
    if (trophies.length > 0) {
        console.log("First trophy:", JSON.stringify(trophies[0], null, 2));
    }

    // Check badges collection
    const badges = await db.collection("badges").find().toArray();
    console.log(`\nBadges: ${badges.length}`);
    if (badges.length > 0) {
        console.log("First badge:", JSON.stringify(badges[0], null, 2));
    }

    // Check chat_history
    const chatHistory = await db.collection("chat_history").find().limit(2).toArray();
    console.log(`\nChat history: ${chatHistory.length} (showing first 2)`);
    if (chatHistory.length > 0) {
        console.log("First chat:", JSON.stringify(chatHistory[0], null, 2));
    }

    // Check messages
    const messages = await db.collection("messages").find().limit(2).toArray();
    console.log(`\nMessages: ${messages.length} (showing first 2)`);
    if (messages.length > 0) {
        console.log("First message:", JSON.stringify(messages[0], null, 2));
    }

    await mongoClient.close();
}

check().catch(console.error);
