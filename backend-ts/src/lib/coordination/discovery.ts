/**
 * Discovery: rank issues by how worthwhile and *safe* they are to pick up.
 * Label-only finders send people to taken or dead issues; this weighs evidence.
 */
import type { Availability } from "./availability";
import type { Responsiveness } from "./responsiveness";
import type { IssueItem } from "./types";
import { daysBetween, isMaintainer } from "./util";
import { newcomerLabels } from "./repoLens";

export interface PickupAssessment {
    score: number; // 0..100
    verdict: "good_pick" | "ask_first" | "avoid";
    reasons: string[];
    warnings: string[];
}

export function assessPickup(
    issue: IssueItem,
    availability: Availability,
    responsiveness: Responsiveness | null,
    opts: { now?: Date; forNewcomer?: boolean } = {}
): PickupAssessment {
    const now = opts.now ?? new Date();
    const reasons: string[] = [];
    const warnings: string[] = [];
    let score = 50;

    switch (availability.status) {
        case "available":
            score += 20;
            reasons.push("Nobody is working on it");
            break;
        case "claimed_stale":
        case "in_progress_stalled":
            score -= 5;
            warnings.push(availability.summary);
            break;
        case "claimed":
        case "in_progress":
            score -= 45;
            warnings.push(availability.summary);
            break;
        case "likely_done":
        case "closed":
            score -= 60;
            warnings.push(availability.summary);
            break;
    }

    if (!responsiveness || responsiveness.level === "unknown") {
        // No evidence either way: rank below repos proven to respond.
        score -= 5;
    } else {
        if (responsiveness.level === "responsive") {
            score += 15;
            reasons.push("Maintainers respond quickly to outside contributors");
        } else if (responsiveness.level === "slow") {
            warnings.push("Maintainers are slow to respond here");
        } else if (responsiveness.level === "unresponsive") {
            score -= 25;
            warnings.push("Outside contributions here often get no response");
        }
    }

    const nl = newcomerLabels(issue.labels);
    if (nl.length) {
        score += opts.forNewcomer ? 15 : 5;
        reasons.push(`Labelled ${nl.map((l) => `"${l}"`).join(", ")}`);
    }

    const maintainerEngaged = isMaintainer(issue.author) || issue.comments.some((c) => isMaintainer(c.author));
    if (maintainerEngaged) {
        score += 10;
        reasons.push("A maintainer has engaged (filed or commented)");
    }

    const age = daysBetween(issue.createdAt, now);
    const idle = daysBetween(issue.updatedAt, now);
    if (idle > 365) {
        score -= 15;
        warnings.push("No activity for over a year; confirm it's still wanted");
    } else if (idle < 30) {
        score += 5;
        reasons.push("Recently active");
    }
    if (age < 2 && !maintainerEngaged) {
        warnings.push("Very new; maintainers may not have triaged it yet");
    }

    if ((issue.body ?? "").trim().length < 80) {
        score -= 10;
        warnings.push("Thin description; ask for details before starting");
    }

    const closedAttempts = issue.linkedPRs.filter((p) => p.state === "CLOSED").length;
    if (closedAttempts > 0) {
        warnings.push(`${closedAttempts} earlier PR attempt(s) were closed — read why first`);
    }

    score = Math.max(0, Math.min(100, score));
    const verdict: PickupAssessment["verdict"] =
        availability.status === "claimed" || availability.status === "in_progress" ||
        availability.status === "likely_done" || availability.status === "closed" || score < 35
            ? "avoid"
            : warnings.length > 0
                ? "ask_first"
                : "good_pick";

    return { score, verdict, reasons, warnings };
}
