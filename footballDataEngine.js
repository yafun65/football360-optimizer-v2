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
