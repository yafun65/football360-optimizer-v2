const ENGINE_VERSION = "PROBABILITY_ENGINE_V4.2";

const DEFAULTS = {
  minProbability: 0.55,
  minOdds: 1.25,
  maxOdds: 3.00,
  maxSelections: 15,
  beamWidth: 300,
  maxCandidates: 250,

  // Diversity controls
  maxSameMarketType: 3,
  maxSameCompetition: 4
};

// =========================================================
// STRICT COMPETITION WHITELIST
// =========================================================

const ALLOWED_COMPETITIONS = new Set([
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",

  "UEFA Champions League",
  "UEFA Europa League",
  "UEFA Conference League",

  // Common alternate names
  "Champions League",
  "Europa League",
  "Conference League"
]);

// =========================================================
// HELPERS
// =========================================================

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

// =========================================================
// MARKET FAMILY
// =========================================================

function getMarketFamily(marketName) {
  const name = normalizeText(marketName).toLowerCase();

  if (
    name.includes("correct score") ||
    name.includes("half time/full time") ||
    name.includes("half-time/full-time") ||
    name.includes("winning margin") ||
    name.includes("exact goals")
  ) {
    return "excluded";
  }

  if (
    name.includes("btts") ||
    name.includes("gg/ng") ||
    name.includes("both teams to score")
  ) {
    return "btts";
  }

  if (
    name.includes("over/under") ||
    name.includes("over under") ||
    name.includes("total goals") ||
    name.includes("total ")
  ) {
    return "goals";
  }

  if (
    name.includes("double chance") ||
    name.includes("1x") ||
    name.includes("x2") ||
    name.includes("12")
  ) {
    return "double-chance";
  }

  if (
    name.includes("draw no bet") ||
    name.includes("dnb")
  ) {
    return "dnb";
  }

  if (
    name.includes("handicap") ||
    name.includes("asian handicap")
  ) {
    return "handicap";
  }

  if (
    name.includes("1x2") ||
    name === "match result" ||
    name.includes("match winner")
  ) {
    return "1x2";
  }

  if (
    name.includes("first scorer") ||
    name.includes("last scorer") ||
    name.includes("anytime scorer") ||
    name.includes("player to score") ||
    name.includes("player goals") ||
    name.includes("player assists")
  ) {
    return "excluded";
  }

  return "other";
}

// =========================================================
// MARKET QUALITY
// =========================================================

function getMarketQuality(family) {
  switch (family) {
    case "goals":
      return 0.96;

    case "btts":
      return 0.95;

    case "dnb":
      return 0.93;

    case "double-chance":
      return 0.92;

    case "handicap":
      return 0.86;

    case "1x2":
      return 0.82;

    default:
      return 0.72;
  }
}

// =========================================================
// ODDS VALUE
// =========================================================

function getOddsValueScore(odds) {
  if (odds >= 1.40 && odds <= 1.80) {
    return 1.00;
  }

  if (odds >= 1.30 && odds < 1.40) {
    return 0.95;
  }

  if (odds >= 1.25 && odds < 1.30) {
    return 0.88;
  }

  if (odds > 1.80 && odds <= 2.20) {
    return 0.93;
  }

  if (odds > 2.20 && odds <= 3.00) {
    return 0.78;
  }

  return 0.60;
}

// =========================================================
// COMPETITION QUALITY
// =========================================================

function getCompetitionQuality(competition) {
  const name = normalizeText(competition);

  if (
    name === "UEFA Champions League" ||
    name === "Champions League"
  ) {
    return 1.00;
  }

  if (
    name === "Premier League" ||
    name === "La Liga" ||
    name === "Serie A" ||
    name === "Bundesliga" ||
    name === "Ligue 1"
  ) {
    return 0.98;
  }

  if (
    name === "UEFA Europa League" ||
    name === "Europa League"
  ) {
    return 0.96;
  }

  if (
    name === "UEFA Conference League" ||
    name === "Conference League"
  ) {
    return 0.94;
  }

  return 0;
}

// =========================================================
// STRICT COMPETITION CHECK
// =========================================================

function isAllowedCompetition(competition) {
  const normalized = normalizeText(competition);

  return ALLOWED_COMPETITIONS.has(normalized);
}

// =========================================================
// NORMALIZE MARKET
// =========================================================

function normalizeMarket(market) {
  const odds = toNumber(market.odds);

  if (!Number.isFinite(odds) || odds < 1.01) {
    return null;
  }

  const competition = normalizeText(market.competition);
  const marketName = normalizeText(market.marketName);
  const selection = normalizeText(market.selection);

  // HARD competition filter
  if (!isAllowedCompetition(competition)) {
    return null;
  }

  const marketFamily = getMarketFamily(marketName);

  // HARD market exclusion
  if (marketFamily === "excluded") {
    return null;
  }

  const probability = Number((1 / odds).toFixed(6));

  if (!Number.isFinite(probability)) {
    return null;
  }

  const qualifiesProbability =
    probability >= DEFAULTS.minProbability;

  const qualifiesOdds =
    odds >= DEFAULTS.minOdds &&
    odds <= DEFAULTS.maxOdds;

  if (!qualifiesProbability || !qualifiesOdds) {
    return null;
  }

  const oddsValueScore = getOddsValueScore(odds);
  const marketQuality = getMarketQuality(marketFamily);
  const competitionQuality = getCompetitionQuality(competition);

  const rankingScore =
    probability * 42 +
    oddsValueScore * 28 +
    marketQuality * 20 +
    competitionQuality * 10;

  return {
    eventId: String(market.eventId || ""),
    eventName: market.eventName || "",
    marketName,
    selection,
    odds,
    competition,
    category: market.category || "",
    gameId: String(market.gameId || ""),
    startTime: market.startTime ?? null,

    marketId: String(market.marketId || ""),
    outcomeId: String(market.outcomeId || ""),
    specifier: market.specifier ?? null,

    marketFamily,

    probability,
    probabilityPercent: Number((probability * 100).toFixed(2)),

    oddsValueScore,
    marketQuality,
    competitionQuality,

    rankingScore: Number(rankingScore.toFixed(4)),

    qualifiesProbability: true,
    qualifiesOdds: true,
    qualifies: true,

    logOdds: Math.log(odds),
    logProbability: Math.log(probability)
  };
}

// =========================================================
// PREPARE CANDIDATES
// =========================================================

function prepareCandidates(markets) {
  const normalized = [];

  for (const market of Array.isArray(markets) ? markets : []) {
    const candidate = normalizeMarket(market);

    if (!candidate) {
      continue;
    }

    normalized.push(candidate);
  }

  // Highest-quality candidates first
  normalized.sort(
    (a, b) => b.rankingScore - a.rankingScore
  );

  // Keep only a small number from each event.
  // This prevents one match from dominating the optimizer.
  const perEvent = new Map();
  const balanced = [];

  for (const candidate of normalized) {
    const count = perEvent.get(candidate.eventId) || 0;

    if (count >= 5) {
      continue;
    }

    perEvent.set(candidate.eventId, count + 1);
    balanced.push(candidate);

    if (balanced.length >= DEFAULTS.maxCandidates) {
      break;
    }
  }

  return balanced;
}

// =========================================================
// STATE SCORE
// =========================================================

function scoreState(state, target) {
  if (!state || !state.selections.length) {
    return -Infinity;
  }

  const totalOdds = state.totalOdds;

  const distance =
    Math.abs(Math.log(totalOdds / target));

  const overshoot =
    totalOdds > target
      ? (totalOdds - target) / target
      : 0;

  const selectionPenalty =
    state.selections.length * 0.07;

  const distinctMarkets =
    state.marketTypes.size;

  const distinctCompetitions =
    state.competitions.size;

  const diversityReward =
    distinctMarkets * 0.22 +
    distinctCompetitions * 0.05;

  const averageQuality =
    state.selections.reduce(
      (sum, selection) =>
        sum + selection.rankingScore,
      0
    ) / state.selections.length;

  return (
    -distance * 25
    -overshoot * 15
    -selectionPenalty
    +diversityReward
    +averageQuality * 0.018
  );
}

// =========================================================
// BUILD COMBINATION
// =========================================================

function buildCombination(
  candidates,
  target,
  options
) {
  const maxSelections =
    options.maxSelections;

  const maxSameMarketType =
    options.maxSameMarketType;

  const maxSameCompetition =
    options.maxSameCompetition;

  const beamWidth =
    options.beamWidth;

  const upperTarget =
    target * 1.20;

  let states = [
    {
      totalOdds: 1,
      selections: [],
      eventIds: new Set(),
      marketTypes: new Set(),
      marketTypeCounts: new Map(),
      competitions: new Set(),
      competitionCounts: new Map()
    }
  ];

  for (const candidate of candidates) {
    const nextStates = [];

    for (const state of states) {

      // Never select two outcomes from the same event.
      if (state.eventIds.has(candidate.eventId)) {
        continue;
      }

      const marketCount =
        state.marketTypeCounts.get(
          candidate.marketFamily
        ) || 0;

      if (marketCount >= maxSameMarketType) {
        continue;
      }

      const competitionCount =
        state.competitionCounts.get(
          candidate.competition
        ) || 0;

      if (competitionCount >= maxSameCompetition) {
        continue;
      }

      const newTotal =
        state.totalOdds * candidate.odds;

      if (newTotal > upperTarget) {
        continue;
      }

      const newSelections = [
        ...state.selections,
        candidate
      ];

      if (
        newSelections.length >
        maxSelections
      ) {
        continue;
      }

      const newEventIds =
        new Set(state.eventIds);

      newEventIds.add(candidate.eventId);

      const newMarketTypes =
        new Set(state.marketTypes);

      newMarketTypes.add(
        candidate.marketFamily
      );

      const newMarketTypeCounts =
        new Map(state.marketTypeCounts);

      newMarketTypeCounts.set(
        candidate.marketFamily,
        marketCount + 1
      );

      const newCompetitions =
        new Set(state.competitions);

      newCompetitions.add(
        candidate.competition
      );

      const newCompetitionCounts =
        new Map(state.competitionCounts);

      newCompetitionCounts.set(
        candidate.competition,
        competitionCount + 1
      );

      nextStates.push({
        totalOdds: newTotal,
        selections: newSelections,
        eventIds: newEventIds,
        marketTypes: newMarketTypes,
        marketTypeCounts: newMarketTypeCounts,
        competitions: newCompetitions,
        competitionCounts: newCompetitionCounts
      });
    }

    // Keep previous states too.
    nextStates.push(...states);

    nextStates.sort(
      (a, b) =>
        scoreState(b, target) -
        scoreState(a, target)
    );

    const unique = [];
    const seen = new Set();

    for (const state of nextStates) {
      const bucket =
        Math.round(state.totalOdds * 100) / 100;

      const marketKey =
        Array.from(state.marketTypes)
          .sort()
          .join(",");

      const key =
        `${bucket}:${state.selections.length}:${marketKey}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      unique.push(state);

      if (unique.length >= beamWidth) {
        break;
      }
    }

    states = unique;
  }

  const validStates = states.filter(
    state =>
      state.totalOdds >= target &&
      state.selections.length <= maxSelections
  );

  if (!validStates.length) {
    return null;
  }

  validStates.sort(
    (a, b) =>
      scoreState(b, target) -
      scoreState(a, target)
  );

  return validStates[0];
}

// =========================================================
// MAIN ENGINE
// =========================================================

export function runProbabilityEngine(
  markets,
  targetOdds,
  options = {}
) {
  const target = toNumber(targetOdds);

  if (!target || target <= 1) {
    return {
      success: false,
      engineVersion: ENGINE_VERSION,
      error: "Target odds must be greater than 1."
    };
  }

  const settings = {
    ...DEFAULTS,
    ...options
  };

  // ---------------------------------------------
  // STEP 1: HARD FILTER
  // ---------------------------------------------

  const allowedMarkets = [];

  for (const market of Array.isArray(markets) ? markets : []) {
    const normalized = normalizeMarket(market);

    if (!normalized) {
      continue;
    }

    allowedMarkets.push(normalized);
  }

  // ---------------------------------------------
  // STEP 2: PREPARE SMALL CANDIDATE POOL
  // ---------------------------------------------

  const candidates =
    prepareCandidates(allowedMarkets);

  // ---------------------------------------------
  // STEP 3: BUILD COMBINATION
  // ---------------------------------------------

  const combination =
    buildCombination(
      candidates,
      target,
      settings
    );

  if (!combination) {
    return {
      success: false,
      engineVersion: ENGINE_VERSION,
      targetOdds: target,

      settings,

      candidatesFound:
        candidates.length,

      error:
        `Unable to reach ${target}x with the current probability and market constraints.`
    };
  }

  // ---------------------------------------------
  // STEP 4: FINAL VALIDATION
  // ---------------------------------------------

  const selections =
    combination.selections.map(
      selection => ({
        eventId: selection.eventId,
        eventName: selection.eventName,

        marketName: selection.marketName,
        selection: selection.selection,

        odds: selection.odds,

        competition:
          selection.competition,

        category:
          selection.category,

        gameId:
          selection.gameId,

        startTime:
          selection.startTime,

        marketId:
          selection.marketId,

        outcomeId:
          selection.outcomeId,

        specifier:
          selection.specifier,

        marketFamily:
          selection.marketFamily,

        probability:
          selection.probability,

        probabilityPercent:
          selection.probabilityPercent,

        oddsValueScore:
          selection.oddsValueScore,

        marketQuality:
          selection.marketQuality,

        competitionQuality:
          selection.competitionQuality,

        rankingScore:
          selection.rankingScore,

        qualifiesProbability:
          selection.qualifiesProbability,

        qualifiesOdds:
          selection.qualifiesOdds,

        qualifies:
          selection.qualifies,

        logOdds:
          selection.logOdds,

        logProbability:
          selection.logProbability
      })
    );

  // ---------------------------------------------
  // MARKET COUNTS
  // ---------------------------------------------

  const marketTypeCounts = {};

  for (const selection of selections) {
    marketTypeCounts[
      selection.marketFamily
    ] =
      (marketTypeCounts[
        selection.marketFamily
      ] || 0) + 1;
  }

  // ---------------------------------------------
  // COMPETITION COUNTS
  // ---------------------------------------------

  const competitionCounts = {};

  for (const selection of selections) {
    competitionCounts[
      selection.competition
    ] =
      (competitionCounts[
        selection.competition
      ] || 0) + 1;
  }

  // ---------------------------------------------
  // FINAL ODDS
  // ---------------------------------------------

  const combinedOdds =
    Number(
      combination.totalOdds.toFixed(2)
    );

  const combinedProbability =
    selections.reduce(
      (product, selection) =>
        product * selection.probability,
      1
    );

  return {
    success: true,

    engineVersion:
      ENGINE_VERSION,

    targetOdds:
      target,

    settings,

    candidatesFound:
      candidates.length,

    combination: {
      selections,

      combinedOdds,

      combinedProbability:
        Number(
          combinedProbability.toFixed(8)
        ),

      combinedProbabilityPercent:
        Number(
          (combinedProbability * 100).toFixed(4)
        ),

      selectionCount:
        selections.length
    },

    marketTypeCounts,

    competitionCounts,

    selections
  };
}

export { ALLOWED_COMPETITIONS };
