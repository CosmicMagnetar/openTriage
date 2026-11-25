/**
 * Built-in saved replies: the answers maintainers type most, so saying no or
 * asking for more takes one click. Shown next to your own replies; saving one
 * of your own with the same name replaces the built-in.
 */
export interface Reply { id: string; name: string; body: string; builtIn?: boolean }

export const BUILT_IN_REPLIES: Reply[] = [
    {
        id: "builtin:needs-info", name: "Needs more info",
        body: "Thanks for reporting this! To look into it we need a bit more:\n\n- Steps to reproduce\n- What you expected and what happened instead\n- Version and environment\n\nWe'll pick it up once those are here.",
    },
    {
        id: "builtin:out-of-scope", name: "Out of scope",
        body: "Thanks for the idea and the time you put into it. This is outside what the project aims to do, so we're closing it. A plugin or a fork may be a good home for it.",
    },
    {
        id: "builtin:discussions", name: "Please use Discussions",
        body: "Thanks for asking! Questions get faster answers in Discussions, where more people can help. Could you post it there? Closing this issue so the tracker stays focused on bugs and planned work.",
    },
    {
        id: "builtin:ai-disclosure", name: "AI disclosure missing",
        body: "Thanks for the PR! Our contribution guide asks for a short note on whether AI tools helped write it, and for evidence it was tested (a test or how you checked it). Could you add both to the description? You also need to be able to explain every change yourself.",
    },
];

/** Your replies first, then built-ins whose name you haven't reused. Away reply first while away mode is on. */
export function withBuiltIns<T extends { name: string }>(mine: T[], away?: { on: boolean; until: string | null; message: string }): Array<T | Reply> {
    const taken = new Set(mine.map((r) => r.name.trim().toLowerCase()));
    const extra: Reply[] = BUILT_IN_REPLIES.filter((b) => !taken.has(b.name.toLowerCase())).map((b) => ({ ...b, builtIn: true }));
    if (away?.on) {
        const back = away.until ? ` I'm back on ${away.until}.` : "";
        extra.unshift({
            id: "builtin:away", name: "Away", builtIn: true,
            body: away.message.trim() || `Thanks for this! I'm away for a bit, so replies will be slow.${back} Other maintainers may still pick it up.`,
        });
    }
    return [...mine, ...extra];
}
