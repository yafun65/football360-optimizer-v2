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
