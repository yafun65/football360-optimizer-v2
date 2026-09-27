/* =========================================================
   FOOTBALL 360 OPTIMIZER V3
   PROBABILITY ENGINE
   ========================================================= */

const ENGINE_VERSION = "PROBABILITY_ENGINE_V3";


/* =========================================================
   DEFAULT SETTINGS
   ========================================================= */

const DEFAULTS = {
  minProbability: 0.55,
  minOdds: 1.25,
  maxOdds: 4.00,
  maxSelections: 20,
  beamWidth: 1000,

  /*
   Maximum number of candidates retained after ranking.
   This is deliberately much larger than the old 100.
  */
  maxCandidates: 500
};


/* =========================================================
   ALLOWED COMPETITIONS
   ========================================================= */

const ALLOWED_COMPETITIONS = [
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "UEFA Champions League",
  "UEFA Europa League",
  "UEFA Conference League",
  "Champions League",
  "Europa League",
  "Conference League"
];


/* =========================================================
   MARKET TYPES
   ========================================================= */

const EXCLUDED_MARKETS = [
  "correct score",
  "half time/full time",
  "half time/full-time",
  "first scorer",
  "last scorer",
  "anytime scorer",
  "player to score",
  "player goals",
  "player assists",
  "winning margin",
  "exact goals"
];


/* =========================================================
   HELPERS
   ========================================================= */

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}


function round(value, decimals = 4) {
  const multiplier = 10 ** decimals;

  return Math.round(value * multiplier) / multiplier;
}


function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


/* =========================================================
   COMPETITION FILTER
   ========================================================= */

function isAllowedCompetition(competition) {
  const name = normalizeText(competition);

  if (!name) {
    return false;
  }

  return ALLOWED_COMPETITIONS.some(
    allowed =>
      name === normalizeText(allowed) ||
      name.includes(normalizeText(allowed))
  );
}


/* =========================================================
   MARKET FILTER
   ========================================================= */

function isExcludedMarket(marketName) {
  const name = normalizeText(marketName);

  return EXCLUDED_MARKETS.some(
    excluded =>
      name.includes(normalizeText(excluded))
  );
}


/* =========================================================
   MARKET NORMALIZATION
   ========================================================= */

function normalizeMarket(
  market,
  index = 0
) {
  if (
    !market ||
    typeof market !== "object"
  ) {
    return null;
  }


  const odds =
    toNumber(
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


  const competition =
    market.competition ??
    market.tournament ??
    market.league ??
    "";


  const category =
    market.category ??
    "";


  return {

    ...market,

    eventId:
      String(eventId),

    eventName:
      String(eventName),

    marketName:
      String(marketName),

    selection:
      String(selection),

    competition:
      String(competition),

    category:
      String(category),

    odds

  };
}


/* =========================================================
   IMPLIED PROBABILITY
   =========================================================

   This is the bookmaker-implied probability:

       probability = 1 / odds

   It is a baseline signal only.

   It is NOT an independently calculated football
   probability and is NOT a guarantee of success.
   ========================================================= */

function calculateProbability(odds) {

  if (
    !odds ||
    odds <= 1
  ) {
    return 0;
  }

  return 1 / odds;
}


/* =========================================================
   MARKET QUALITY
   ========================================================= */

function getMarketQuality(market) {

  const name =
    normalizeText(
      market.marketName
    );


  /*
   Preferred mainstream markets.
  */

  if (
    name.includes("double chance")
  ) {
    return 1.00;
  }


  if (
    name.includes("over/under") ||
    name.includes("over under")
  ) {
    return 0.98;
  }


  if (
    name.includes("gg/ng") ||
    name.includes("both teams") ||
    name.includes("both team")
  ) {
    return 0.96;
  }


  if (
    name.includes("draw no bet")
  ) {
    return 0.95;
  }


  if (
    name.includes("handicap")
  ) {
    return 0.88;
  }


  if (
    name.includes("1x2")
  ) {
    return 0.85;
  }


  /*
   Unknown markets are still allowed,
   but receive a lower quality score.
  */

  return 0.75;
}


/* =========================================================
   ODDS QUALITY
   ========================================================= */

function getOddsQuality(odds) {

  if (
    odds >= 1.30 &&
    odds <= 1.80
  ) {
    return 1.00;
  }


  if (
    odds >= 1.25 &&
    odds < 1.30
  ) {
    return 0.94;
  }


  if (
    odds > 1.80 &&
    odds <= 2.20
  ) {
    return 0.94;
  }


  if (
    odds > 2.20 &&
    odds <= 3.00
  ) {
    return 0.85;
  }


  if (
    odds > 3.00 &&
    odds <= 4.00
  ) {
    return 0.72;
  }


  return 0.50;
}


/* =========================================================
   COMPETITION QUALITY
   ========================================================= */

function getCompetitionQuality(
  competition
) {

  const name =
    normalizeText(
      competition
    );


  if (
    name.includes("champions league")
  ) {
    return 1.00;
  }


  if (
    name.includes("premier league") ||
    name.includes("la liga") ||
    name.includes("serie a") ||
    name.includes("bundesliga") ||
    name.includes("ligue 1")
  ) {
    return 0.98;
  }


  if (
    name.includes("europa league")
  ) {
    return 0.96;
  }


  if (
    name.includes("conference league")
  ) {
    return 0.94;
  }


  return 0.80;
}


/* =========================================================
   MARKET SCORING
   ========================================================= */

function scoreMarket(
  market,
  options = {}
) {

  const settings = {
    ...DEFAULTS,
    ...options
  };


  const normalized =
    normalizeMarket(
      market
    );


  if (!normalized) {
    return null;
  }


  /*
   Competition scope.
  */

  if (
    !isAllowedCompetition(
      normalized.competition
    )
  ) {
    return null;
  }


  /*
   Remove highly volatile markets.
  */

  if (
    isExcludedMarket(
      normalized.marketName
    )
  ) {
    return null;
  }


  const probability =
    calculateProbability(
      normalized.odds
    );


  const probabilityScore =
    probability * 100;


  const qualifiesProbability =
    probability >=
    settings.minProbability;


  const qualifiesOdds =
    normalized.odds >=
      settings.minOdds &&
    normalized.odds <=
      settings.maxOdds;


  if (
    !qualifiesProbability ||
    !qualifiesOdds
  ) {
    return null;
  }


  const marketQuality =
    getMarketQuality(
      normalized
    );


  const oddsQuality =
    getOddsQuality(
      normalized.odds
    );


  const competitionQuality =
    getCompetitionQuality(
      normalized.competition
    );


  /*
   Overall ranking score.

   Probability is still the strongest signal,
   but the optimizer now considers market and
   competition quality as well.
  */

  const rankingScore =
    probability * 60 +
    marketQuality * 20 +
    oddsQuality * 10 +
    competitionQuality * 10;


  return {

    ...normalized,

    probability:
      round(
        probability,
        6
      ),

    probabilityPercent:
      round(
        probabilityScore,
        2
      ),

    marketQuality:
      round(
        marketQuality,
        4
      ),

    oddsQuality:
      round(
        oddsQuality,
        4
      ),

    competitionQuality:
      round(
        competitionQuality,
        4
      ),

    rankingScore:
      round(
        rankingScore,
        4
      ),

    qualifiesProbability:
      true,

    qualifiesOdds:
      true,

    qualifies:
      true,

    logOdds:
      Math.log(
        normalized.odds
      ),

    logProbability:
      Math.log(
        probability
      )

  };
}


/* =========================================================
   PREPARE CANDIDATES
   ========================================================= */

function prepareCandidates(
  markets,
  options = {}
) {

  if (
    !Array.isArray(markets)
  ) {
    return [];
  }


  const scored =
    markets
      .map(
        (market, index) =>
          scoreMarket(
            market,
            {
              ...options,
              index
            }
          )
      )
      .filter(Boolean);


  if (
    scored.length === 0
  ) {
    return [];
  }


  /*
   Group candidates by event.

   This prevents one match from dominating
   the entire candidate pool.
  */

  const grouped =
    new Map();


  for (
    const market
    of scored
  ) {

    if (
      !grouped.has(
        market.eventId
      )
    ) {

      grouped.set(
        market.eventId,
        []
      );

    }


    grouped
      .get(
        market.eventId
      )
      .push(
        market
      );

  }


  const candidates = [];


  /*
   Keep several market possibilities
   from each match.
  */

  for (
    const eventMarkets
    of grouped.values()
  ) {

    eventMarkets.sort(
      (a, b) =>
        b.rankingScore -
        a.rankingScore
    );


    candidates.push(
      ...eventMarkets.slice(
        0,
        6
      )
    );

  }


  /*
   Global ranking.
  */

  candidates.sort(
    (a, b) =>
      b.rankingScore -
      a.rankingScore
  );


  /*
   Keep a much larger pool than V2.
  */

  return candidates.slice(
    0,
    options.maxCandidates ||
      DEFAULTS.maxCandidates
  );
}


/* =========================================================
   COMBINATION SCORE
   ========================================================= */

function stateScore(
  state,
  targetOdds
) {

  const targetLog =
    Math.log(
      targetOdds
    );


  const currentLog =
    state.logOdds;


  const distance =
    Math.abs(
      targetLog -
      currentLog
    );


  const probabilityLoss =
    -state.logProbability;


  const overshoot =
    Math.max(
      0,
      currentLog -
      targetLog
    );


  /*
   Penalize large numbers of selections.

   This discourages unnecessarily long slips.
  */

  const selectionPenalty =
    state.selections.length *
    0.035;


  /*
   Reward stronger individual markets.
  */

  const averageRanking =
    state.selections.length
      ? state.selections.reduce(
          (sum, selection) =>
            sum +
            selection.rankingScore,
          0
        ) /
        state.selections.length
      : 0;


  const qualityReward =
    averageRanking *
    0.025;


  return (

    distance * 20 +

    probabilityLoss * 0.18 +

    overshoot * 12 +

    selectionPenalty -

    qualityReward

  );
}


/* =========================================================
   COMPLETED COMBINATION SCORE
   ========================================================= */

function completedScore(
  state,
  targetOdds
) {

  const score =
    stateScore(
      state,
      targetOdds
    );


  /*
   Prefer combinations with fewer legs
   when quality is otherwise similar.
  */

  return (
    score +
    state.selections.length *
      0.05
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


  if (
    !Array.isArray(candidates) ||
    candidates.length === 0
  ) {
    return null;
  }


  if (
    !targetOdds ||
    targetOdds <= 1
  ) {
    return null;
  }


  let states = [

    {
      selections: [],

      usedEvents:
        new Set(),

      usedMarkets:
        new Set(),

      logOdds: 0,

      logProbability: 0
    }

  ];


  let bestCompleted =
    null;


  /*
   Search progressively.
  */

  for (
    let depth = 0;
    depth <
      settings.maxSelections;
    depth++
  ) {

    const nextStates = [];


    for (
      const state
      of states
    ) {

      for (
        const candidate
        of candidates
      ) {

        /*
         Never select two markets
         from the same match.
        */

        if (
          state.usedEvents.has(
            candidate.eventId
          )
        ) {
          continue;
        }


        /*
         Prevent identical market
         and selection duplicates.
        */

        const marketKey =
          [
            candidate.eventId,
            candidate.marketId ||
              candidate.marketName,
            candidate.outcomeId ||
              candidate.selection,
            candidate.specifier ||
              ""
          ].join("|");


        if (
          state.usedMarkets.has(
            marketKey
          )
        ) {
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
          new Set(
            state.usedEvents
          );


        newUsedEvents.add(
          candidate.eventId
        );


        const newUsedMarkets =
          new Set(
            state.usedMarkets
          );


        newUsedMarkets.add(
          marketKey
        );


        const newState = {

          selections:
            newSelections,

          usedEvents:
            newUsedEvents,

          usedMarkets:
            newUsedMarkets,

          logOdds:
            newLogOdds,

          logProbability:
            newLogProbability

        };


        const combinedOdds =
          Math.exp(
            newLogOdds
          );


        /*
         Reached target.
        */

        if (
          combinedOdds >=
          targetOdds
        ) {

          if (
            !bestCompleted
          ) {

            bestCompleted =
              newState;

          } else {

            const currentScore =
              completedScore(
                newState,
                targetOdds
              );


            const bestScore =
              completedScore(
                bestCompleted,
                targetOdds
              );


            if (
              currentScore <
              bestScore
            ) {

              bestCompleted =
                newState;

            }

          }


          continue;
        }


        /*
         Do not explore combinations
         that overshoot excessively.
        */

        if (
          combinedOdds >
          targetOdds * 1.35
        ) {
          continue;
        }


        nextStates.push(
          newState
        );

      }

    }


    if (
      nextStates.length === 0
    ) {
      break;
    }


    /*
     Remove near-identical states.

     This allows the beam to contain
     different probability/odds paths.
    */

    nextStates.sort(
      (a, b) =>
        stateScore(
          a,
          targetOdds
        ) -
        stateScore(
          b,
          targetOdds
        )
    );


    const uniqueStates = [];

    const seen = new Set();


    for (
      const state
      of nextStates
    ) {

      const odds =
        Math.exp(
          state.logOdds
        );


      const bucket =
        Math.round(
          odds * 100
        ) / 100;


      const key =
        `${bucket}:${state.selections.length}`;


      if (
        seen.has(key)
      ) {
        continue;
      }


      seen.add(key);


      uniqueStates.push(
        state
      );


      if (
        uniqueStates.length >=
        settings.beamWidth
      ) {
        break;
      }

    }


    states =
      uniqueStates;


    /*
     Stop when we have a very close
     target solution.
    */

    if (
      bestCompleted
    ) {

      const bestOdds =
        Math.exp(
          bestCompleted.logOdds
        );


      const relativeDifference =
        Math.abs(
          bestOdds -
          targetOdds
        ) /
        targetOdds;


      if (
        relativeDifference <
        0.003
      ) {

        break;

      }

    }

  }


  if (
    !bestCompleted
  ) {
    return null;
  }


  const combinedOdds =
    Math.exp(
      bestCompleted.logOdds
    );


  const combinedProbability =
    Math.exp(
      bestCompleted.logProbability
    );


  return {

    selections:
      bestCompleted.selections,

    combinedOdds:
      round(
        combinedOdds,
        2
      ),

    combinedProbability:
      round(
        combinedProbability,
        8
      ),

    combinedProbabilityPercent:
      round(
        combinedProbability * 100,
        4
      ),

    selectionCount:
      bestCompleted
        .selections
        .length

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
    toNumber(
      targetOdds,
      0
    );


  if (
    numericTarget <= 1
  ) {

    return {

      success: false,

      engineVersion:
        ENGINE_VERSION,

      error:
        "Target odds must be greater than 1."

    };

  }


  /*
   Prepare the complete candidate pool.
  */

  const candidates =
    prepareCandidates(
      markets,
      settings
    );


  if (
    candidates.length === 0
  ) {

    return {

      success: false,

      engineVersion:
        ENGINE_VERSION,

      error:
        "No qualifying markets were found within the configured competition, probability, and odds filters.",

      settings,

      candidatesFound:
        0

    };

  }


  /*
   Build optimized combination.
  */

  const combination =
    buildCombination(
      candidates,
      numericTarget,
      settings
    );


  if (
    !combination
  ) {

    return {

      success: false,

      engineVersion:
        ENGINE_VERSION,

      error:
        "Could not build a combination that reaches the target odds with the available markets.",

      settings,

      candidatesFound:
        candidates.length

    };

  }


  /*
   Public response.
  */

  return {

    success:
      true,

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

          competition:
            selection.competition,

          category:
            selection.category,

          probability:
            selection.probability,

          probabilityPercent:
            selection.probabilityPercent,

          marketQuality:
            selection.marketQuality,

          rankingScore:
            selection.rankingScore

        })
      )

  };

}


/* =========================================================
   EXPORT HELPERS
   ========================================================= */

export {

  ENGINE_VERSION,

  ALLOWED_COMPETITIONS,

  calculateProbability,

  scoreMarket,

  prepareCandidates,

  buildCombination

};
