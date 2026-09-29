/* =========================================================
   FOOTBALL 360
   STATISTICS ENGINE - STAGE 2
   API-FOOTBALL CONNECTION TEST
   ========================================================= */

const API_FOOTBALL_BASE =
  "https://v3.football.api-sports.io";


/* =========================================================
   API REQUEST
   ========================================================= */

async function apiFootballRequest(
  endpoint,
  params = {}
) {

  const apiKey =
    process.env.API_FOOTBALL_KEY;


  if (!apiKey) {

    throw new Error(
      "API_FOOTBALL_KEY environment variable is missing."
    );

  }


  const url =
    new URL(
      `${API_FOOTBALL_BASE}${endpoint}`
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
        headers: {
          "x-apisports-key":
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
      `API-Football returned invalid JSON. HTTP ${response.status}.`
    );

  }


  if (!response.ok) {

    throw new Error(
      `API-Football HTTP ${response.status}.`
    );

  }


  return data;

}


/* =========================================================
   TEST CONNECTION
   ========================================================= */

export async function testStatsConnection() {

  const data =
    await apiFootballRequest(
      "/status"
    );


  return {

    success: true,

    provider:
      "API-Football",

    account:
      data?.response?.account || null,

    subscription:
      data?.response?.subscription || null

  };

}


/* =========================================================
   GET TEAM STATISTICS
   ========================================================= */

export async function getTeamStatistics(
  teamId,
  leagueId,
  season
) {

  return apiFootballRequest(
    "/teams/statistics",
    {
      team:
        teamId,

      league:
        leagueId,

      season:
        season
    }
  );

    }
