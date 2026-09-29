/* =========================================================
   FOOTBALL 360
   FOOTBALL-DATA.ORG ENGINE
   STAGE 2 - SECOND FOOTBALL DATA SOURCE
   ========================================================= */

const FOOTBALL_DATA_BASE =
  "https://api.football-data.org/v4";

async function footballDataRequest(
  endpoint,
  params = {}
) {

  const apiKey =
    process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {

    throw new Error(
      "FOOTBALL_DATA_API_KEY environment variable is missing."
    );

  }

  const url =
    new URL(
      `${FOOTBALL_DATA_BASE}${endpoint}`
    );

  for (
    const [key, value]
    of Object.entries(params)
  ) {

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {

      url.searchParams.set(
        key,
        String(value)
      );

    }

  }

  const response =
    await fetch(
      url,
      {
        method: "GET",

        headers: {
          "X-Auth-Token":
            apiKey,

          "Accept":
            "application/json"
        }
      }
    );

  const raw =
    await response.text();

  let data;

  try {

    data =
      JSON.parse(raw);

  } catch {

    throw new Error(
      `Football-Data.org returned invalid JSON. HTTP ${response.status}.`
    );

  }

  if (!response.ok) {

    throw new Error(
      `Football-Data.org HTTP ${response.status}: ${
        data?.message ||
        data?.error ||
        "Request failed."
      }`
    );

  }

  return data;

}


/* =========================================================
   TEST CONNECTION
   ========================================================= */
export async function testFootballDataConnection() {

  const data =
    await footballDataRequest(
      "/competitions/PL"
    );

  return {

    success: true,

    provider:
      "Football-Data.org",

    competition:
      data?.competition || null,

    area:
      data?.area || null,

    currentSeason:
      data?.currentSeason || null

  };

}
/* =========================================================
   GET COMPETITION MATCHES
   ========================================================= */

export async function getCompetitionMatches(
  competition = "PL",
  params = {}
) {

  return footballDataRequest(
    `/competitions/${competition}/matches`,
    params
  );

}
/* =========================================================
   GET RECENT TEAM FORM
   ========================================================= */

export async function getRecentTeamForm(
  teamId,
  limit = 5
) {

  const data =
    await getFootballDataTeamMatches(
      teamId,
      {
        status: "FINISHED",
        limit: 10
      }
    );

  const matches =
    Array.isArray(data?.matches)
      ? data.matches
      : [];

  const recentMatches =
    matches
      .filter(
        match =>
          match?.status === "FINISHED" &&
          match?.score?.fullTime?.home !== null &&
          match?.score?.fullTime?.away !== null
      )
      .sort(
        (a, b) =>
          new Date(b.utcDate) -
          new Date(a.utcDate)
      )
      .slice(0, limit);

  const form = [];

  for (const match of recentMatches) {

    const isHome =
      Number(match.homeTeam?.id) ===
      Number(teamId);

    const teamGoals =
      isHome
        ? match.score.fullTime.home
        : match.score.fullTime.away;

    const opponentGoals =
      isHome
        ? match.score.fullTime.away
        : match.score.fullTime.home;

    let result = "D";

    if (teamGoals > opponentGoals) {
      result = "W";
    }

    if (teamGoals < opponentGoals) {
      result = "L";
    }

    form.push({

      matchId:
        match.id,

      date:
        match.utcDate,

      opponent:
        isHome
          ? match.awayTeam?.name
          : match.homeTeam?.name,

      homeAway:
        isHome
          ? "HOME"
          : "AWAY",

      goalsFor:
        teamGoals,

      goalsAgainst:
        opponentGoals,

      result,

      cleanSheet:
        opponentGoals === 0,

      failedToScore:
        teamGoals === 0

    });

  }

  const matchesPlayed =
    form.length;

  const wins =
    form.filter(
      item => item.result === "W"
    ).length;

  const draws =
    form.filter(
      item => item.result === "D"
    ).length;

  const losses =
    form.filter(
      item => item.result === "L"
    ).length;

  const goalsFor =
    form.reduce(
      (total, item) =>
        total + Number(item.goalsFor || 0),
      0
    );

  const goalsAgainst =
    form.reduce(
      (total, item) =>
        total + Number(item.goalsAgainst || 0),
      0
    );

  const cleanSheets =
    form.filter(
      item => item.cleanSheet
    ).length;

  const failedToScore =
    form.filter(
      item => item.failedToScore
    ).length;

  return {

    success: true,

    teamId:
      Number(teamId),

    matchesPlayed,

    wins,

    draws,

    losses,

    points:
      (wins * 3) + draws,

    goalsFor,

    goalsAgainst,

    goalsForPerGame:
      matchesPlayed
        ? Number(
            (
              goalsFor /
              matchesPlayed
            ).toFixed(2)
          )
        : 0,

    goalsAgainstPerGame:
      matchesPlayed
        ? Number(
            (
              goalsAgainst /
              matchesPlayed
            ).toFixed(2)
          )
        : 0,

    cleanSheets,

    cleanSheetRate:
      matchesPlayed
        ? Number(
            (
              cleanSheets /
              matchesPlayed
            ).toFixed(3)
          )
        : 0,

    failedToScore,

    failedToScoreRate:
      matchesPlayed
        ? Number(
            (
              failedToScore /
              matchesPlayed
            ).toFixed(3)
          )
        : 0,

    formString:
      form
        .map(item => item.result)
        .join(""),

    matches:
      form

  };

       }
/* =========================================================
   MATCH STATISTICAL ANALYSIS
   COMBINES RECENT FORM OF BOTH TEAMS
   ========================================================= */

export async function analyzeMatchStats(
  homeTeamId,
  awayTeamId
) {

  const homeForm =
    await getRecentTeamForm(
      homeTeamId,
      5
    );

  const awayForm =
    await getRecentTeamForm(
      awayTeamId,
      5
    );

  if (
    !homeForm?.success ||
    !awayForm?.success
  ) {

    throw new Error(
      "Unable to retrieve recent form for both teams."
    );

  }

  /*
   * ATTACKING STRENGTH
   *
   * Higher goals-per-game means
   * stronger recent attacking output.
   */

  const homeAttack =
    Number(
      homeForm.goalsForPerGame || 0
    );

  const awayAttack =
    Number(
      awayForm.goalsForPerGame || 0
    );

  /*
   * DEFENSIVE STRENGTH
   *
   * Lower goals conceded means
   * stronger recent defense.
   */

  const homeDefense =
    Number(
      homeForm.goalsAgainstPerGame || 0
    );

  const awayDefense =
    Number(
      awayForm.goalsAgainstPerGame || 0
    );

  /*
   * FORM POINTS
   *
   * Maximum 15 points from
   * the last 5 matches.
   */

  const homeFormRate =
    Number(
      homeForm.points || 0
    ) / 15;

  const awayFormRate =
    Number(
      awayForm.points || 0
    ) / 15;

  /*
   * CLEAN SHEET RATE
   */

  const homeCleanSheet =
    Number(
      homeForm.cleanSheetRate || 0
    );

  const awayCleanSheet =
    Number(
      awayForm.cleanSheetRate || 0
    );

  /*
   * FAILED TO SCORE RATE
   */

  const homeFailedToScore =
    Number(
      homeForm.failedToScoreRate || 0
    );

  const awayFailedToScore =
    Number(
      awayForm.failedToScoreRate || 0
    );

  /*
   * SIMPLE ATTACK INDEX
   */

  const homeAttackIndex =
    Math.min(
      homeAttack / 2.5,
      1
    );

  const awayAttackIndex =
    Math.min(
      awayAttack / 2.5,
      1
    );

  /*
   * SIMPLE DEFENSE INDEX
   *
   * Lower goals conceded =
   * higher defensive score.
   */

  const homeDefenseIndex =
    Math.max(
      0,
      1 -
      (homeDefense / 2.5)
    );

  const awayDefenseIndex =
    Math.max(
      0,
      1 -
      (awayDefense / 2.5)
    );

  /*
   * OVERALL TEAM STRENGTH
   */

  const homeStrength =
    (
      homeAttackIndex * 0.35 +
      homeDefenseIndex * 0.25 +
      homeFormRate * 0.30 +
      homeCleanSheet * 0.10
    );

  const awayStrength =
    (
      awayAttackIndex * 0.35 +
      awayDefenseIndex * 0.25 +
      awayFormRate * 0.30 +
      awayCleanSheet * 0.10
    );

  /*
   * HOME ADVANTAGE
   */

  const homeAdvantage =
    0.08;

  const adjustedHomeStrength =
    homeStrength +
    homeAdvantage;

  /*
   * NORMALIZE INTO RELATIVE
   * WIN PROBABILITIES.
   */

  const totalStrength =
    adjustedHomeStrength +
    awayStrength;

  let homeWinProbability =
    totalStrength > 0
      ? adjustedHomeStrength /
        totalStrength
      : 0.5;

  let awayWinProbability =
    totalStrength > 0
      ? awayStrength /
        totalStrength
      : 0.5;

  /*
   * DRAW ESTIMATE
   *
   * Draw probability starts around
   * 25% and increases when the teams
   * have similar strength.
   */

  const strengthDifference =
    Math.abs(
      adjustedHomeStrength -
      awayStrength
    );

  let drawProbability =
    0.25 -
    (
      strengthDifference * 0.10
    );

  drawProbability =
    Math.max(
      0.15,
      Math.min(
        0.30,
        drawProbability
      )
    );

  /*
   * Rebalance the win probabilities
   * after reserving probability for draw.
   */

  const winProbabilityTotal =
    homeWinProbability +
    awayWinProbability;

  homeWinProbability =
    (
      homeWinProbability /
      winProbabilityTotal
    ) *
    (1 - drawProbability);

  awayWinProbability =
    (
      awayWinProbability /
      winProbabilityTotal
    ) *
    (1 - drawProbability);

  /*
   * BTTS ESTIMATE
   */

  const bttsProbability =
    (
      homeAttackIndex *
      awayAttackIndex *
      0.65
    ) +
    (
      (
        1 - homeCleanSheet
      ) *
      (
        1 - awayCleanSheet
      ) *
      0.35
    );

  /*
   * OVER 2.5 ESTIMATE
   */

  const expectedGoals =
    homeAttack +
    awayAttack;

  let over25Probability =
    0.30 +
    (
      expectedGoals /
      5
    );

  over25Probability =
    Math.max(
      0.15,
      Math.min(
        0.85,
        over25Probability
      )
    );

  /*
   * DOUBLE CHANCE
   */

  const homeOrDrawProbability =
    homeWinProbability +
    drawProbability;

  const awayOrDrawProbability =
    awayWinProbability +
    drawProbability;

  /*
   * RETURN ANALYSIS
   */

  return {

    success: true,

    homeTeamId:
      Number(homeTeamId),

    awayTeamId:
      Number(awayTeamId),

    homeForm: {

      form:
        homeForm.formString,

      points:
        homeForm.points,

      goalsForPerGame:
        homeForm.goalsForPerGame,

      goalsAgainstPerGame:
        homeForm.goalsAgainstPerGame,

      cleanSheetRate:
        homeForm.cleanSheetRate,

      failedToScoreRate:
        homeFailedToScore

    },

    awayForm: {

      form:
        awayForm.formString,

      points:
        awayForm.points,

      goalsForPerGame:
        awayForm.goalsForPerGame,

      goalsAgainstPerGame:
        awayForm.goalsAgainstPerGame,

      cleanSheetRate:
        awayForm.cleanSheetRate,

      failedToScoreRate:
        awayFailedToScore

    },

    probabilities: {

      homeWin:
        Number(
          homeWinProbability.toFixed(4)
        ),

      draw:
        Number(
          drawProbability.toFixed(4)
        ),

      awayWin:
        Number(
          awayWinProbability.toFixed(4)
        ),

      homeOrDraw:
        Number(
          homeOrDrawProbability.toFixed(4)
        ),

      awayOrDraw:
        Number(
          awayOrDrawProbability.toFixed(4)
        ),

      btts:
        Number(
          bttsProbability.toFixed(4)
        ),

      over25:
        Number(
          over25Probability.toFixed(4)
        )

    },

    expectedGoals:
      Number(
        expectedGoals.toFixed(2)
      )

  };

}
/* =========================================================
   COMPARE SPORTYBET MARKET WITH STATISTICAL PROBABILITY
   ========================================================= */

export function compareMarketWithStats(
  market,
  statisticalAnalysis
) {

  if (
    !market ||
    !statisticalAnalysis?.probabilities
  ) {

    throw new Error(
      "Market and statistical analysis are required."
    );

  }

  const odds =
    Number(market.odds);

  if (
    !odds ||
    odds <= 1
  ) {

    throw new Error(
      "A valid market odds value is required."
    );

  }

  const impliedProbability =
    1 / odds;

  const pick =
    String(
      market.pick ||
      ""
    ).toLowerCase();

  let statisticalProbability =
    null;

  /*
   * MAP SPORTYBET PICKS TO
   * STATISTICAL PROBABILITIES
   */

  if (
    pick === "home" ||
    pick === "1"
  ) {

    statisticalProbability =
      statisticalAnalysis
        .probabilities
        .homeWin;

  } else if (
    pick === "draw" ||
    pick === "x"
  ) {

    statisticalProbability =
      statisticalAnalysis
        .probabilities
        .draw;

  } else if (
    pick === "away" ||
    pick === "2"
  ) {

    statisticalProbability =
      statisticalAnalysis
        .probabilities
        .awayWin;

  } else if (
    pick.includes("home") &&
    pick.includes("draw")
  ) {

    statisticalProbability =
      statisticalAnalysis
        .probabilities
        .homeOrDraw;

  } else if (
    pick.includes("draw") &&
    pick.includes("away")
  ) {

    statisticalProbability =
      statisticalAnalysis
        .probabilities
        .awayOrDraw;

  } else if (
    pick.includes("btts") &&
    pick.includes("yes")
  ) {

    statisticalProbability =
      statisticalAnalysis
        .probabilities
        .btts;

  } else if (
    pick.includes("over") &&
    (
      pick.includes("2.5") ||
      pick.includes("2,5")
    )
  ) {

    statisticalProbability =
      statisticalAnalysis
        .probabilities
        .over25;

  }

  /*
   * IF WE DON'T RECOGNIZE THE MARKET,
   * RETURN A NEUTRAL RESULT.
   */

  if (
    statisticalProbability === null
  ) {

    return {

      supported: false,

      reason:
        "Market type is not yet supported by the statistical model.",

      odds,

      impliedProbability:
        Number(
          impliedProbability.toFixed(4)
        ),

      statisticalProbability:
        null,

      probabilityDifference:
        null

    };

  }

  const probabilityDifference =
    statisticalProbability -
    impliedProbability;

  /*
   * SUPPORT LEVEL
   *
   * Positive difference means the
   * statistical model gives the
   * selection a higher probability
   * than the market implies.
   */

  let support =
    "LOW";

  if (
    probabilityDifference >= 0.08
  ) {

    support =
      "STRONG";

  } else if (
    probabilityDifference >= 0.03
  ) {

    support =
      "MODERATE";

  } else if (
    probabilityDifference >= 0
  ) {

    support =
      "SLIGHT";

  }

  return {

    supported:
      probabilityDifference >= 0,

    support,

    odds,

    impliedProbability:
      Number(
        impliedProbability.toFixed(4)
      ),

    statisticalProbability:
      Number(
        statisticalProbability.toFixed(4)
      ),

    probabilityDifference:
      Number(
        probabilityDifference.toFixed(4)
      )

  };

           }
/* =========================================================
   BATCH MARKET STATISTICAL SCORING
   ========================================================= */

export async function scoreMarketsWithStatistics(
  markets
) {

  if (!Array.isArray(markets)) {

    throw new Error(
      "Markets array is required."
    );

  }

  const scoredMarkets = [];

  for (const market of markets) {

    try {

      const homeTeamId =
        Number(
          market.homeTeamId
        );

      const awayTeamId =
        Number(
          market.awayTeamId
        );

      /*
       * We need both Football-Data.org team IDs
       * before statistical analysis can be performed.
       */

      if (
        !homeTeamId ||
        !awayTeamId
      ) {

        scoredMarkets.push({

          ...market,

          statisticsSupported: false,

          statisticalScore: 0,

          statisticalSupport: "UNAVAILABLE",

          statisticalReason:
            "Football-Data.org team IDs are missing."

        });

        continue;

      }

      const analysis =
        await analyzeMatchStats(
          homeTeamId,
          awayTeamId
        );

      const comparison =
        compareMarketWithStats(
          market,
          analysis
        );

      let statisticalScore = 0;

      if (
        comparison.supported
      ) {

        statisticalScore =
          Math.max(
            0,
            Math.min(
              100,
              50 +
              (
                comparison.probabilityDifference *
                500
              )
            )
          );

      }

      scoredMarkets.push({

        ...market,

        statisticsSupported:
          comparison.supported,

        statisticalScore:
          Number(
            statisticalScore.toFixed(2)
          ),

        statisticalSupport:
          comparison.support ||
          "LOW",

        statisticalProbability:
          comparison.statisticalProbability,

        impliedProbability:
          comparison.impliedProbability,

        probabilityDifference:
          comparison.probabilityDifference,

        statisticalAnalysis:
          analysis

      });

    } catch (error) {

      console.error(
        "Statistical scoring error:",
        error
      );

      scoredMarkets.push({

        ...market,

        statisticsSupported: false,

        statisticalScore: 0,

        statisticalSupport:
          "UNAVAILABLE",

        statisticalReason:
          error.message ||
          "Statistical analysis failed."

      });

    }

  }

  return {

    success: true,

    totalMarkets:
      markets.length,

    scoredMarkets

  };

}
/* =========================================================
   GET COMPETITION STANDINGS
   ========================================================= */

export async function getCompetitionStandings(
  competition = "PL"
) {

  return footballDataRequest(
    `/competitions/${competition}/standings`
  );

}


/* =========================================================
   GET TEAM MATCHES
   ========================================================= */

export async function getFootballDataTeamMatches(
  teamId,
  params = {}
) {

  return footballDataRequest(
    `/teams/${teamId}/matches`,
    params
  );

}
