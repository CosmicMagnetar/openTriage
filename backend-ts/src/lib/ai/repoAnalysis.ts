/**
 * Deep repo analysis with the user's own AI key. It builds on the no-AI
 * repo context (P7): the map, skills and commands are given to the model
 * as ground truth, so it explains rather than invents. Pure prompt building
 * and strict parsing live here (tested); the route does the I/O.
 */
import type { RepoMap } from "@/lib/context";

export interface Analysis {
    summary: string;
    howItWorks: string[];
    folders: Array<{ path: string; explain: string; difficulty: "easy" | "medium" | "hard"; startHere: boolean }>;
    firstAreas: Array<{ path: string; why: string }>;
    glossary: Array<{ term: string; meaning: string }>;
}

export const SYSTEM = `You explain open-source repositories to people who have never seen them, in plain words a first-year student understands.
Use only the facts given. When a fact is missing, say "not clear from the files" instead of guessing.
Answer with one JSON object and nothing else.`;

export function buildPrompt(input: {
    repo: string;
    description: string | null;
    readme: string | null;
    map: RepoMap;
    skills: Array<{ name: string; description: string }>;
    paths: string[];
    level: "new" | "some" | "experienced";
}): string {
    const folders = input.map.folders.slice(0, 30).map((f) =>
        `- ${f.path}/ (${f.files} files${f.languages.length ? `, ${f.languages.join("/")}` : ""}${f.tests ? ", has tests" : ""}${f.generated ? ", generated" : ""}): ${f.purpose}${f.source === "agents" ? " [from AGENTS.md]" : " [guess]"}`);
    const sample = input.paths.filter((p) => !/(^|\/)(node_modules|vendor|dist|build)\//.test(p)).slice(0, 250);
    return `Repository: ${input.repo}
Description: ${input.description ?? "none"}
Reader: ${input.level === "new" ? "new to open source" : input.level === "some" ? "has contributed before" : "experienced engineer"}

Folders (facts):
${folders.join("\n")}

Build and test commands (facts): ${input.map.commands.map((c) => c.name).join("; ") || "none found"}
Stack: ${input.map.stack.join(", ") || "unknown"}
Task guides in the repo: ${input.skills.map((s) => `${s.name}: ${s.description}`).join(" | ") || "none"}

README (start):
${(input.readme ?? "none").slice(0, 4000)}

Some file paths:
${sample.join("\n")}

Return JSON with exactly these keys:
{
  "summary": "2-3 sentences: what this project is and who uses it",
  "howItWorks": ["3-6 short steps: how a request or task flows through the code, naming folders"],
  "folders": [{"path": "folder name from the list", "explain": "one plain sentence", "difficulty": "easy|medium|hard", "startHere": true|false}],
  "firstAreas": [{"path": "a folder or file a newcomer could change first", "why": "one sentence"}],
  "glossary": [{"term": "a project-specific word", "meaning": "plain meaning"}]
}
Cover every folder from the list in "folders" (except generated ones). 2-4 firstAreas, up to 8 glossary terms.`;
}

/** First JSON object in a reply (handles ```json fences and prose around it). */
function firstJson(text: string): unknown {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
    const src = fenced ?? text;
    const start = src.indexOf("{");
    const end = src.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(src.slice(start, end + 1)); } catch { return null; }
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Strict parse: keeps only well-formed parts; folders must exist in the real map. Null if unusable. */
export function parseAnalysis(text: string, map: RepoMap): Analysis | null {
    const j = firstJson(text) as Record<string, unknown> | null;
    if (!j || typeof j !== "object") return null;
    const known = new Set(map.folders.map((f) => f.path));
    const arr = (v: unknown) => (Array.isArray(v) ? v : []);
    const folders = arr(j.folders).map((f) => f as Record<string, unknown>).map((f) => ({
        path: str(f.path, 120).replace(/\/$/, ""),
        explain: str(f.explain, 300),
        difficulty: (["easy", "medium", "hard"].includes(f.difficulty as string) ? f.difficulty : "medium") as Analysis["folders"][number]["difficulty"],
        startHere: f.startHere === true,
    })).filter((f) => f.path && f.explain && known.has(f.path.split("/")[0]));
    const summary = str(j.summary, 800);
    if (!summary || !folders.length) return null;
    return {
        summary,
        howItWorks: arr(j.howItWorks).map((s) => str(s, 300)).filter(Boolean).slice(0, 8),
        folders,
        firstAreas: arr(j.firstAreas).map((a) => a as Record<string, unknown>).map((a) => ({ path: str(a.path, 200), why: str(a.why, 300) })).filter((a) => a.path && a.why).slice(0, 5),
        glossary: arr(j.glossary).map((g) => g as Record<string, unknown>).map((g) => ({ term: str(g.term, 60), meaning: str(g.meaning, 300) })).filter((g) => g.term && g.meaning).slice(0, 10),
    };
}
