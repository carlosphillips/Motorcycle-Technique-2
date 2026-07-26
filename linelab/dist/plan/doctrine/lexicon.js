// plan/doctrine/lexicon.ts — the 16 checks, said in riding words.
//
// The catalogue (checks.ts) is the authority on WHETHER a line passes; this
// file is the authority on how to SAY it to the person who rode it. Nothing
// here grades anything: no thresholds, no metrics, no verdicts — a lexicon that
// could disagree with the catalogue would be a second rubric, and there is
// exactly one (design/01 §A.3).
//
// Why it exists: a reader of a figure was handed `late_apex`, `out_in_out`,
// `single_input`, `stop_within_sight`, `link_continuity`, `chain_flow`,
// `rideability: tracker overdrive`. Those are identifiers for the engine's own
// use. A rider needs three things instead — what the check is about, why it
// matters on a road, and what to do differently — and the third is the one the
// figures never had.
//
// The mapping is TOTAL over `CHECK_IDS` (a compile error the moment the
// catalogue grows a seventeenth check) and is asserted exhaustive by
// test/plan/lexicon.test.ts.
import { CHECK_IDS } from "./checks.js";
export const CHECK_LEXICON = Object.freeze({
    late_apex: {
        title: "Where you touched the inside",
        why: "Touch the inside early and the corner is still turning when you get there, so the exit points off the far edge. Touch it late and the road opens in front of you.",
        fix: "Hold the outside longer than feels natural, and let the bike come to the inside past the middle of the corner."
    },
    out_in_out: {
        title: "The shape of the line",
        why: "A corner taken outside-inside-outside is the straightest path through it, which means the least lean for the same speed.",
        fix: "Start wide, touch the inside once, and let the bike drift back out on the way through."
    },
    single_input: {
        title: "How many times you steered",
        why: "Each new steering input restarts the arc, so the line becomes a series of flats — the book calls it fifty-pencing — and none of them is the line you wanted.",
        fix: "Decide the turn before you get there, make one committed input, and leave it alone."
    },
    quick_steer: {
        title: "How fast you got the lean in",
        why: "A slow roll to full lean spends the corner still leaning over, so the bike is arriving at the apex when it should already be tracking through it.",
        fix: "Press the inside bar deliberately and get the lean in early; a lazy roll-in eats the corner."
    },
    throttle_rule: {
        title: "What the throttle was doing",
        why: "Braking and turning at once spends the same grip twice, and a closed throttle mid-corner lets the bike run wide of its own accord.",
        fix: "Finish the braking before you turn, hold a neutral throttle to the apex, then roll on smoothly and never off again."
    },
    trail_brake_taper: {
        title: "How the brakes came off",
        why: "Grip is shared between braking and leaning. Letting the lever off abruptly at lean asks the front tyre for a change it may not have.",
        fix: "Bleed the brake off as the lean goes on — the two trade places, they never both peak."
    },
    traction_ceiling: {
        title: "How much grip you had left",
        why: "Cornering, braking and driving all draw on one tyre. When the total reaches what the surface offers, the next input is the one that costs you.",
        fix: "Leave margin: carry less entry speed, or make the line straighter, so the tyre is never asked for everything at once."
    },
    lean_ceiling: {
        title: "How far you leaned",
        why: "Past a certain angle the hard parts touch and the tyre runs out of edge. It is a hard ceiling, not a gradual one.",
        fix: "Buy lean angle back with a better line or a lower entry speed rather than with more lean."
    },
    exit_containment: {
        title: "Whether the exit stayed on your side",
        why: "The exit is where a bad entry gets paid for, and where the road runs out — the outside edge is oncoming traffic or scenery.",
        fix: "Set the entry so the exit lands inside your own lane with room to spare, not so it just fits."
    },
    stop_within_sight: {
        title: "Whether you could stop in what you can see",
        why: "The single street rule: if the distance you can see is shorter than the distance you need to stop, you are riding into a decision you cannot make.",
        fix: "Slow down until your stopping distance fits inside your sightline, and take a line that opens the view earlier."
    },
    hold_wide_for_sight: {
        title: "Staying wide to see further",
        why: "Holding the outside a little longer buys sightline through a blind corner — the view is bought with position before it is bought with speed.",
        fix: "Delay the turn-in and stay out until you can see the exit."
    },
    rideability: {
        title: "Whether a real rider could do this",
        why: "A line the tracker can only hold by moving faster than a rider can steer is not a line — it is arithmetic.",
        fix: "Nothing to ride here: the line needs to be re-planned, not re-ridden."
    },
    link_continuity: {
        title: "Joining one corner to the next",
        why: "In linked corners the exit of one is the entry of the next, so a line that ends on the wrong side has already spoiled the corner after it.",
        fix: "Plan the pair together: give up something in the first corner to arrive correctly placed for the second."
    },
    chain_containment: {
        title: "Staying on the road through the whole chain",
        why: "Errors in a sequence compound: each corner is entered slightly worse than the last until one of them runs out of road.",
        fix: "Reset the line early — the first corner is where a chain is saved, not the last."
    },
    chain_flow: {
        title: "Rhythm through the sequence",
        why: "A chain ridden as separate corners costs a fight at every transition; ridden as one flowing shape it costs none.",
        fix: "Look through to the second corner while you are still in the first, and let the transitions run together."
    },
    wrong_strategy_for_corner: {
        title: "Whether the plan suited the corner",
        why: "A tightening corner, a blind one and an open one each want a different line — using the wrong one is a mistake made before the corner started.",
        fix: "Read the corner type first: decreasing radius wants a later apex, a blind one wants sight, an open one wants drive."
    }
});
/**
 * The check's evidence message, rewritten for a rider where the catalogue's own
 * wording is measured in the engine's units.
 *
 * Returns `null` when the catalogue's message already reads plainly — the
 * caller then shows the original rather than a worse paraphrase. Reads ONLY the
 * recorded metrics (never re-deriving anything), so a rewrite cannot say
 * something the check did not find.
 */
export function riderMessage(id, metrics) {
    const num = (k) => {
        const v = metrics?.[k];
        return typeof v === "number" && Number.isFinite(v) ? v : null;
    };
    if (id === "late_apex") {
        const pct = num("apex_pct");
        const bar = num("bar");
        if (pct === null || bar === null)
            return null;
        const where = pct < 25 ? "in the first quarter of the corner" : pct < 50 ? "before the middle of the corner" : `${Math.round(pct)}% of the way through`;
        return pct > bar
            ? `you touched the inside ${Math.round(pct)}% of the way through — past the ${Math.round(bar)}% this corner asks for`
            : `you touched the inside ${where} — this corner asks you to wait until past ${Math.round(bar)}%`;
    }
    if (id === "single_input") {
        const count = num("count");
        const allowed = num("allowed");
        if (count === null || allowed === null)
            return null;
        if (count === 0)
            return "no steering input was commanded inside this corner at all";
        if (count === 1 && allowed >= 1)
            return "one committed steering input, which is what the corner asks for";
        return `you steered ${count} separate times inside this corner where ${allowed === 1 ? "one input" : `${allowed} inputs`} would do`;
    }
    if (id === "stop_within_sight") {
        const deficit = num("max_deficit_m");
        if (deficit === null)
            return null;
        return deficit > 0
            ? `you needed ${Math.round(deficit)} m more sight than you had to stop in what you could see`
            : "you could always have stopped inside your own sightline";
    }
    if (id === "traction_ceiling") {
        // `ellipse_max` is how much of the friction ellipse the worst station used;
        // what is left is what the rider had in hand.
        const used = num("ellipse_max");
        if (used === null)
            return null;
        return `at its worst this line used ${Math.round(used * 100)}% of the grip on offer, leaving ${Math.round((1 - used) * 100)}% in hand`;
    }
    if (id === "lean_ceiling") {
        const lean = num("phi_max_deg");
        if (lean === null)
            return null;
        return `you leaned to ${Math.round(lean)}°`;
    }
    return null;
}
/** Every check id, with its phrasing — the shape the `explain` verb and the gallery consume. */
export function checkLexiconRows() {
    return CHECK_IDS.map((id) => ({ id, ...CHECK_LEXICON[id] }));
}
//# sourceMappingURL=lexicon.js.map