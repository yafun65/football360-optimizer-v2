/* =========================================================
   FOOTBALL 360 OPTIMIZER V2
   PROBABILITY ENGINE
   ========================================================= */

const ENGINE_VERSION = "PROBABILITY_ENGINE_V2";

// Default settings
const DEFAULTS = {
  minProbability: 0.55,
  minOdds: 1.30,
  maxOdds: 4.00,
  maxSelections: 20,
  beamWidth: 500
};


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}


function round(value, decimals = 4) {
  const multiplier = 10 ** decimals;

  return Math.round(value * multiplier) / multiplier;
}


/* =========================================================
   MARKET NORMALIZATION
   ========================================================= */

function normalizeMarket(market, index = 0) {
  if (!market || typeof market !== "object") {
    return null;
  }

  const odds = toNumber(
    market.odds ??
    market.odd ??
    market.price ??
    market.value,
    0
  );

  if (odds <= 1) {
    return null;
  }

  const eventId =
    market.eventId ??
    market.event_id ??
    market.matchId ??
    market.match_id ??
    market.event?.id ??
    `event-${index}`;

  const eventName =
    market.eventName ??
    market.event_name ??
    market.matchName ??
    market.match_name ??
    market.event?.name ??
    market.match ??
    "Unknown Match";

  const marketName =
    market.marketName ??
    market.market_name ??
    market.market ??
    market.name ??
    "Unknown Market";

  const selection =
    market.selection ??
    market.selectionName ??
    market.selection_name ??
    market.outcome ??
    market.outcomeName ??
    market.label ??
    "Unknown Selection";

  return {
    ...market,

    eventId: String(eventId),
    eventName: String(eventName),
    marketName: String(marketName),
    selection: String(selection),
    odds
  };
}


/* =========================================================
   PROBABILITY
   =========================================================

   For V2, probability is derived from the market odds.

   Example:

   Odds 2.00 = roughly 50% implied probability
   Odds 1.50 = roughly 66.67%
   Odds 1.25 = roughly 80%

   This is NOT a guaranteed real-world probability.
   It is the market-implied probability used for ranking.
   ========================================================= */

function calculateProbability(odds) {
  if (!odds || odds <= 1) {
    return 0;
  }

  return 1 / odds;
}


/* =========================================================
   MARKET SCORE
   ========================================================= */

function scoreMarket(market, options = {}) {
  const settings = {
    ...DEFAULTS,
    ...options
  };

  const normalized = normalizeMarket(market);

  if (!normalized) {
    return null;
  }

  const probability = calculateProbability(normalized.odds);

  const probabilityScore = probability * 100;

  const qualifiesProbability =
    probability >= settings.minProbability;

  const qualifiesOdds =
    normalized.odds >= settings.minOdds &&
    normalized.odds <= settings.maxOdds;

  return {
    ...normalized,

    probability: round(probability, 4),

    probabilityPercent: round(probabilityScore, 2),

    qualifiesProbability,

    qualifiesOdds,

    qualifies:
      qualifiesProbability &&
      qualifiesOdds,

    logOdds: Math.log(normalized.odds),

    logProbability: Math.log(probability)
  };
}


/* =========================================================
   PREPARE CANDIDATES
   ========================================================= */

function prepareCandidates(markets, options = {}) {
  if (!Array.isArray(markets)) {
    return [];
  }

  const scored = markets
    .map((market, index) => scoreMarket(market, options))
    .filter(Boolean)
    .filter(market => market.qualifies);

  /*
     Remove duplicate selections for the same event.

     For each event we keep the strongest candidates.
  */

  const grouped = new Map();

  for (const market of scored) {
    if (!grouped.has(market.eventId)) {
      grouped.set(market.eventId, []);
    }

    grouped.get(market.eventId).push(market);
  }

  const candidates = [];

  for (const eventMarkets of grouped.values()) {
    eventMarkets.sort((a, b) => {
      /*
        Probability remains the primary signal.

        When probabilities are close, slightly higher odds
        are preferred because they contribute more toward
        the requested target.
      */

      if (b.probability !== a.probability) {
        return b.probability - a.probability;
      }

      return b.odds - a.odds;
    });

    /*
      Keep several possibilities from each event.
    */

    candidates.push(...eventMarkets.slice(0, 5));
  }

  /*
    Limit total candidates to keep the optimizer fast.

    We use a combined ranking:

    - probability first
    - odds second
  */

  candidates.sort((a, b) => {
    const probabilityDifference =
      b.probability - a.probability;

    if (Math.abs(probabilityDifference) > 0.03) {
      return probabilityDifference;
    }

    return b.odds - a.odds;
  });

  return candidates.slice(0, 100);
}


/* =========================================================
   STATE SCORING
   ========================================================= */

function stateScore(state, targetOdds) {
  const targetLog = Math.log(targetOdds);

  const currentLog = state.logOdds;

  /*
    Distance from target.

    Smaller is better.
  */

  const distance =
    Math.abs(targetLog - currentLog);

  /*
    Combined probability.

    Higher is better.

    We use logarithms internally because multiplying many
    probabilities can become extremely small.
  */

  const probabilityLoss =
    -state.logProbability;

  /*
    Overshooting the target is undesirable.

    A small overshoot is acceptable.
  */

  const overshoot =
    Math.max(0, currentLog - targetLog);

  /*
    Main optimization:

    1. Get close to target odds.
    2. Preserve probability quality.
    3. Avoid unnecessary overshoot.
  */

  return (
    distance * 8 +
    probabilityLoss * 0.35 +
    overshoot * 4
  );
}


/* =========================================================
   BUILD COMBINATION
   ========================================================= */

function buildCombination(
  candidates,
  targetOdds,
  options = {}
) {
  const settings = {
    ...DEFAULTS,
    ...options
  };

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  if (!targetOdds || targetOdds <= 1) {
    return null;
  }

  /*
    Beam-search states.

    Each state represents one possible combination.
  */

  let states = [
    {
      selections: [],
      usedEvents: new Set(),
      logOdds: 0,
      logProbability: 0
    }
  ];

  let bestCompleted = null;

  /*
    We build combinations progressively.
  */

  for (
    let depth = 0;
    depth < settings.maxSelections;
    depth++
  ) {
    const nextStates = [];

    for (const state of states) {
      for (const candidate of candidates) {

        /*
          Do not select two markets from the same match.
        */

        if (state.usedEvents.has(candidate.eventId)) {
          continue;
        }

        /*
          Prevent duplicate selections.
        */

        const alreadySelected =
          state.selections.some(
            item =>
              item.eventId === candidate.eventId &&
              item.selection === candidate.selection &&
              item.marketName === candidate.marketName
          );

        if (alreadySelected) {
          continue;
        }

        const newLogOdds =
          state.logOdds +
          candidate.logOdds;

        const newLogProbability =
          state.logProbability +
          candidate.logProbability;

        const newSelections = [
          ...state.selections,
          candidate
        ];

        const newUsedEvents =
          new Set(state.usedEvents);

        newUsedEvents.add(candidate.eventId);

        const newState = {
          selections: newSelections,
          usedEvents: newUsedEvents,
          logOdds: newLogOdds,
          logProbability: newLogProbability
        };

        const combinedOdds =
          Math.exp(newLogOdds);

        /*
          We have reached the target.
        */

        if (combinedOdds >= targetOdds) {

          if (!bestCompleted) {
            bestCompleted = newState;
          } else {

            const currentScore =
              stateScore(
                newState,
                targetOdds
              );

            const bestScore =
              stateScore(
                bestCompleted,
                targetOdds
              );

            if (currentScore < bestScore) {
              bestCompleted = newState;
            }
          }

          continue;
        }

        /*
          Don't keep combinations that are already too far
          above the target.
        */

        if (combinedOdds > targetOdds * 1.50) {
          continue;
        }

        nextStates.push(newState);
      }
    }

    if (nextStates.length === 0) {
      break;
    }

    /*
      Keep only the strongest states.

      This is what keeps the search fast.
    */

    nextStates.sort((a, b) => {
      return (
        stateScore(a, targetOdds) -
        stateScore(b, targetOdds)
      );
    });

    states =
      nextStates.slice(
        0,
        settings.beamWidth
      );

    /*
      If we already have a very close solution,
      we can stop early.
    */

    if (bestCompleted) {
      const bestOdds =
        Math.exp(bestCompleted.logOdds);

      const distance =
        Math.abs(
          Math.log(bestOdds) -
          Math.log(targetOdds)
        );

      if (distance < 0.015) {
        break;
      }
    }
  }

  if (!bestCompleted) {
    return null;
  }

  const combinedOdds =
    Math.exp(bestCompleted.logOdds);

  const combinedProbability =
    Math.exp(bestCompleted.logProbability);

  return {
    selections: bestCompleted.selections,

    combinedOdds:
      round(combinedOdds, 2),

    combinedProbability:
      round(combinedProbability, 8),

    combinedProbabilityPercent:
      round(combinedProbability * 100, 4),

    selectionCount:
      bestCompleted.selections.length
  };
}


/* =========================================================
   MAIN ENGINE
   ========================================================= */

export function runProbabilityEngine(
  markets,
  targetOdds,
  options = {}
) {
  const settings = {
    ...DEFAULTS,
    ...options
  };

  const numericTarget =
    toNumber(targetOdds, 0);

  if (numericTarget <= 1) {
    return {
      success: false,
      engineVersion: ENGINE_VERSION,
      error: "Target odds must be greater than 1."
    };
  }

  const candidates =
    prepareCandidates(
      markets,
      settings
    );

  if (candidates.length === 0) {
    return {
      success: false,
      engineVersion: ENGINE_VERSION,
      error:
        "No markets passed the probability and odds filters.",
      settings,
      candidatesFound: 0
    };
  }

  const combination =
    buildCombination(
      candidates,
      numericTarget,
      settings
    );

  if (!combination) {
    return {
      success: false,
      engineVersion: ENGINE_VERSION,
      error:
        "Could not build a combination that reaches the target odds with the available markets.",
      settings,
      candidatesFound: candidates.length
    };
  }

  return {
    success: true,

    engineVersion:
      ENGINE_VERSION,

    targetOdds:
      numericTarget,

    settings,

    candidatesFound:
      candidates.length,

    combination,

    selections:
      combination.selections.map(
        selection => ({
          eventId:
            selection.eventId,

          eventName:
            selection.eventName,

          marketName:
            selection.marketName,

          selection:
            selection.selection,

          odds:
            selection.odds,

          probability:
            selection.probability,

          probabilityPercent:
            selection.probabilityPercent
        })
      )
  };
}


/* =========================================================
   EXPORT HELPERS
   ========================================================= */

export {
  ENGINE_VERSION,
  calculateProbability,
  scoreMarket,
  prepareCandidates,
  buildCombination
};
