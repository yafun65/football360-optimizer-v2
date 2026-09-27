/* =========================================================
   FOOTBALL 360 OPTIMIZER V4
   VALUE + DIVERSITY PROBABILITY ENGINE
   ========================================================= */

const ENGINE_VERSION = "PROBABILITY_ENGINE_V4";


/* =========================================================
   DEFAULT SETTINGS
   ========================================================= */

const DEFAULTS = {
  minProbability: 0.55,
  minOdds: 1.25,
  maxOdds: 4.00,
  maxSelections: 15,
  beamWidth: 1500,
  maxCandidates: 600,

  /*
   Maximum number of selections from the same market family.
   This prevents a slip from becoming dominated by one market.
  */
  maxSameMarketType: 5,

  /*
   Maximum number of selections from one competition.
  */
  maxSameCompetition: 6
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
   EXCLUDED MARKETS
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
  const name =
    normalizeText(competition);

  if (!name) {
    return false;
  }

  return ALLOWED_COMPETITIONS.some(
    allowed =>
      name === normalizeText(allowed) ||
      name.includes(
        normalizeText(allowed)
      )
  );
}


/* =========================================================
   MARKET FILTER
   ========================================================= */

function isExcludedMarket(marketName) {
  const name =
    normalizeText(marketName);

  return EXCLUDED_MARKETS.some(
    excluded =>
      name.includes(
        normalizeText(excluded)
      )
  );
}


/* =========================================================
   MARKET FAMILY
   ========================================================= */

function getMarketFamily(marketName) {

  const name =
    normalizeText(marketName);


  if (
    name.includes("double chance")
  ) {
    return "double-chance";
  }


  if (
    name.includes("over/under") ||
    name.includes("over under")
  ) {
    return "goals";
  }


  if (
    name.includes("gg/ng") ||
    name.includes("both teams") ||
    name.includes("both team")
  ) {
    return "btts";
  }


  if (
    name.includes("draw no bet")
  ) {
    return "draw-no-bet";
  }


  if (
    name.includes("handicap")
  ) {
    return "handicap";
  }


  if (
    name.includes("1x2")
  ) {
    return "1x2";
  }


  return "other";
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


  if (
    odds <= 1
  ) {
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
   ODDS VALUE SCORE
   ========================================================= */

function getOddsValueScore(odds) {

  /*
   Very low odds contribute little toward the target.

   Medium odds provide a better balance between
   probability and target efficiency.
  */

  if (
    odds >= 1.40 &&
    odds <= 1.80
  ) {
    return 1.00;
  }


  if (
    odds >= 1.30 &&
    odds < 1.40
  ) {
    return 0.94;
  }


  if (
    odds >= 1.25 &&
    odds < 1.30
  ) {
    return 0.86;
  }


  if (
    odds > 1.80 &&
    odds <= 2.20
  ) {
    return 0.92;
  }


  if (
    odds > 2.20 &&
    odds <= 3.00
  ) {
    return 0.78;
  }


  if (
    odds > 3.00 &&
    odds <= 4.00
  ) {
    return 0.65;
  }


  return 0.40;
}


/* =========================================================
   MARKET QUALITY
   ========================================================= */

function getMarketQuality(
  marketName
) {

  const name =
    normalizeText(
      marketName
    );


  if (
    name.includes("double chance")
  ) {
    return 0.92;
  }


  if (
    name.includes("over/under") ||
    name.includes("over under")
  ) {
    return 0.96;
  }


  if (
    name.includes("gg/ng") ||
    name.includes("both teams") ||
    name.includes("both team")
  ) {
    return 0.94;
  }


  if (
    name.includes("draw no bet")
  ) {
    return 0.93;
  }


  if (
    name.includes("handicap")
  ) {
    return 0.86;
  }


  if (
    name.includes("1x2")
  ) {
    return 0.82;
  }


  return 0.72;
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
    name.includes(
      "champions league"
    )
  ) {
    return 1.00;
  }


  if (
    name.includes(
      "premier league"
    ) ||
    name.includes(
      "la liga"
    ) ||
    name.includes(
      "serie a"
    ) ||
    name.includes(
      "bundesliga"
    ) ||
    name.includes(
      "ligue 1"
    )
  ) {
    return 0.98;
  }


  if (
    name.includes(
      "europa league"
    )
  ) {
    return 0.96;
  }


  if (
    name.includes(
      "conference league"
    )
  ) {
    return 0.94;
  }


  return 0.80;
}


/* =========================================================
   MARKET SCORE
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


  const probabilityPercent =
    probability * 100;


  if (
    probability <
    settings.minProbability
  ) {
    return null;
  }


  if (
    normalized.odds <
      settings.minOdds ||
    normalized.odds >
      settings.maxOdds
  ) {
    return null;
  }


  const marketFamily =
    getMarketFamily(
      normalized.marketName
    );


  const marketQuality =
    getMarketQuality(
      normalized.marketName
    );


  const oddsValueScore =
    getOddsValueScore(
      normalized.odds
    );


  const competitionQuality =
    getCompetitionQuality(
      normalized.competition
    );


  /*
   V4 ranking.

   Probability remains important,
   but V4 no longer simply rewards
   the smallest odds.
  */

  const rankingScore =

    probability * 45 +

    oddsValueScore * 25 +

    marketQuality * 20 +

    competitionQuality * 10;


  return {

    ...normalized,

    marketFamily,

    probability:
      round(
        probability,
        6
      ),

    probabilityPercent:
      round(
        probabilityPercent,
        2
      ),

    oddsValueScore:
      round(
        oddsValueScore,
        4
      ),

    marketQuality:
      round(
        marketQuality,
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
   Group by event.

   We don't want one match to dominate
   the candidate pool.
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
   Keep up to 8 different possibilities
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
        8
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


  return candidates.slice(
    0,
    options.maxCandidates ||
      DEFAULTS.maxCandidates
  );
}


/* =========================================================
   STATE SCORE
   ========================================================= */

function stateScore(
  state,
  targetOdds,
  settings
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


  const overshoot =
    Math.max(
      0,
      currentLog -
      targetLog
    );


  const probabilityLoss =
    -state.logProbability;


  /*
   Fewer selections are preferred,
   but not so strongly that the engine
   is forced into poor odds.
  */

  const selectionPenalty =
    state.selections.length *
    0.08;


  /*
   Market diversity reward.
  */

  const marketTypes =
    new Set(
      state.selections.map(
        selection =>
          selection.marketFamily
      )
    );


  const diversityReward =
    marketTypes.size *
    0.12;


  /*
   Competition diversity reward.
  */

  const competitions =
    new Set(
      state.selections.map(
        selection =>
          selection.competition
      )
    );


  const competitionReward =
    competitions.size *
    0.06;


  /*
   Average quality.
  */

  const averageQuality =
    state.selections.length
      ? state.selections.reduce(
          (
            sum,
            selection
          ) =>
            sum +
            selection.rankingScore,
          0
        ) /
        state.selections.length
      : 0;


  const qualityReward =
    averageQuality *
    0.018;


  return (

    distance * 24 +

    overshoot * 14 +

    probabilityLoss * 0.16 +

    selectionPenalty -

    diversityReward -

    competitionReward -

    qualityReward

  );
}


/* =========================================================
   CHECK COMBINATION LIMITS
   ========================================================= */

function violatesCombinationLimits(
  state,
  candidate,
  settings
) {

  /*
   Market family limit.
  */

  const sameMarketType =
    state.selections.filter(
      selection =>
        selection.marketFamily ===
        candidate.marketFamily
    ).length;


  if (
    sameMarketType >=
    settings.maxSameMarketType
  ) {
    return true;
  }


  /*
   Competition limit.
  */

  const sameCompetition =
    state.selections.filter(
      selection =>
        selection.competition ===
        candidate.competition
    ).length;


  if (
    sameCompetition >=
    settings.maxSameCompetition
  ) {
    return true;
  }


  return false;
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
   Progressive beam search.
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
         Never use two selections
         from the same event.
        */

        if (
          state.usedEvents.has(
            candidate.eventId
          )
        ) {
          continue;
        }


        /*
         Apply diversity limits.
        */

        if (
          violatesCombinationLimits(
            state,
            candidate,
            settings
          )
        ) {
          continue;
        }


        /*
         Unique market key.
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
         Target reached.
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
              stateScore(
                newState,
                targetOdds,
                settings
              );


            const bestScore =
              stateScore(
                bestCompleted,
                targetOdds,
                settings
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
         Prevent huge overshoots.
        */

        if (
          combinedOdds >
          targetOdds * 1.30
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
     Rank states.
    */

    nextStates.sort(
      (a, b) =>
        stateScore(
          a,
          targetOdds,
          settings
        ) -
        stateScore(
          b,
          targetOdds,
          settings
        )
    );


    /*
     Keep diverse states.

     Instead of keeping only one state for
     each odds bucket, include different
     market-type compositions.
    */

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


      const oddsBucket =
        Math.round(
          odds * 100
        ) / 100;


      const marketTypes =
        [
          ...new Set(
            state.selections.map(
              selection =>
                selection.marketFamily
            )
          )
        ]
          .sort()
          .join(",");


      const key =
        `${oddsBucket}:${state.selections.length}:${marketTypes}`;


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
     Stop when target is extremely close.
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
        0.002
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
        "No qualifying markets were found.",

      settings,

      candidatesFound:
        0

    };

  }


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
   Count market families.
  */

  const marketTypeCounts = {};


  for (
    const selection
    of combination.selections
  ) {

    const family =
      selection.marketFamily;


    marketTypeCounts[family] =
      (
        marketTypeCounts[family] ||
        0
      ) + 1;

  }


  /*
   Count competitions.
  */

  const competitionCounts = {};


  for (
    const selection
    of combination.selections
  ) {

    const competition =
      selection.competition;


    competitionCounts[
      competition
    ] =
      (
        competitionCounts[
          competition
        ] || 0
      ) + 1;

  }


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

    marketTypeCounts,

    competitionCounts,

    selections:
      combination.selections.map(
        selection => ({

          eventId:
            selection.eventId,

          eventName:
            selection.eventName,

          marketName:
            selection.marketName,

          marketFamily:
            selection.marketFamily,

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

          oddsValueScore:
            selection.oddsValueScore,

          marketQuality:
            selection.marketQuality,

          competitionQuality:
            selection.competitionQuality,

          rankingScore:
            selection.rankingScore

        })
      )

  };

}


/* =========================================================
   EXPORTS
   ========================================================= */

export {

  ENGINE_VERSION,

  ALLOWED_COMPETITIONS,

  calculateProbability,

  scoreMarket,

  prepareCandidates,

  buildCombination

};
