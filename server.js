/* =========================================================
   FOOTBALL 360 OPTIMIZER V2
   SERVER
   ========================================================= */

import express from "express";
import cors from "cors";

import {
  startTelegramBot
} from "./telegramBot.js";

import {
  runProbabilityEngine
} from "./probabilityEngine.js";

import {
  testStatsConnection,
  getTeamStats
} from "./statsEngine.js";

import {
  testFootballDataConnection,
  getCompetitionMatches,
  getCompetitionStandings,
  getFootballDataTeamMatches,
  getRecentTeamForm,
  analyzeMatchStats,
  compareMarketWithStats,
  scoreMarketsWithStatistics,
  resolveFootballDataTeamId
} from "./footballDataEngine.js";


const OLD_API =
  "https://sportybet-api.onrender.com";

const PORT =
  process.env.PORT || 10000;

const app = express();

app.use(cors());

app.use(
  express.json()
);


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get("/", (req, res) => {

  res.json({

    status: "online",

    service:
      "Football 360 Optimizer V2",

    engine:
      "Probability Engine V4.4",

    dataSource:
      OLD_API

  });

});


/* =========================================================
   FETCH SPORTYBET CANDIDATE POOL
   ========================================================= */

async function fetchSportyBetCandidates(target) {

  /*
     The old STRATEGY_ENGINE_V3 should NOT receive
     the user's final target.

     We use a stable candidate-pool target of 10x
     so the old API returns its filtered markets.

     V4.4 is responsible for building the final target.
  */

  const candidatePoolTarget = 10;

  const url =
    `${OLD_API}/selection-engine?target=${encodeURIComponent(candidatePoolTarget)}&includeCandidates=true`;

  console.log(
    "Fetching SportyBet candidate pool:",
    url
  );

  console.log(
    "Requested final target:",
    target
  );

  console.log(
    "Candidate pool target:",
    candidatePoolTarget
  );


  const response =
    await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });


  const text =
    await response.text();


  let data;


  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      `Old SportyBet API returned invalid JSON. HTTP ${response.status}. Response: ${text.slice(0, 500)}`
    );

  }


  console.log(
    "Old SportyBet API HTTP status:",
    response.status
  );

  console.log(
    "Old SportyBet API success:",
    data.success
  );

  console.log(
    "Old SportyBet API engine version:",
    data.engineVersion
  );

  console.log(
    "Candidate pool size:",
    Array.isArray(data.filteredCandidates)
      ? data.filteredCandidates.length
      : 0
  );


  if (
    !Array.isArray(
      data.filteredCandidates
    ) ||
    data.filteredCandidates.length === 0
  ) {

    throw new Error(
      data.error ||
      "Old SportyBet API returned no candidate markets."
    );

  }


  return data;

}


/* =========================================================
   API-FOOTBALL STATISTICS TEST
   ========================================================= */

app.get(
  "/stats-test",
  async (req, res) => {

    try {

      const result =
        await testStatsConnection();

      res.json(
        result
      );

    } catch (error) {

      console.error(
        "Statistics API test error:",
        error
      );

      res.status(500).json({

        success: false,

        provider:
          "API-Football",

        error:
          error.message ||
          "Statistics API connection failed."

      });

    }

  }
);


/* =========================================================
   TEAM NAME RESOLVER TEST
   ========================================================= */

app.get(
  "/team-resolver-test",
  async (req, res) => {

    try {

      const team =
        String(
          req.query.team || ""
        );

      const competition =
        String(
          req.query.competition || ""
        );


      if (
        !team ||
        !competition
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Provide team and competition."

        });

      }


      const teamId =
        await resolveFootballDataTeamId(
          team,
          competition
        );


      res.json({

        success: true,

        team,

        competition,

        footballDataTeamId:
          teamId

      });


    } catch (error) {

      console.error(
        "Team resolver error:",
        error
      );


      res.status(500).json({

        success: false,

        error:
          error.message ||
          "Unable to resolve team."

      });

    }

  }
);

/* =========================================================
   TEST BOTH TEAM RESOLUTION
   ========================================================= */

app.get("/match-team-resolver-test", async (req, res) => {

  try {

    const homeTeam =
      String(req.query.home || "").trim();

    const awayTeam =
      String(req.query.away || "").trim();

    const competition =
      String(req.query.competition || "").trim();

    if (!homeTeam || !awayTeam || !competition) {

      return res.status(400).json({
        success: false,
        error:
          "Please provide home, away and competition."
      });

    }

    const homeTeamId =
      await resolveFootballDataTeamId(
        homeTeam,
        competition
      );

    const awayTeamId =
      await resolveFootballDataTeamId(
        awayTeam,
        competition
      );

    return res.json({

      success: true,

      competition,

      home: {
        team: homeTeam,
        footballDataTeamId: homeTeamId
      },

      away: {
        team: awayTeam,
        footballDataTeamId: awayTeamId
      },

      bothResolved:
        Boolean(homeTeamId && awayTeamId)

    });

  } catch (error) {

    console.error(
      "Match team resolver test error:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "Unable to resolve both teams."

    });

/* =========================================================
   API-FOOTBALL TEAM STATISTICS TEST
   ========================================================= */

app.get(
  "/team-stats-test",
  async (req, res) => {

    try {

      const teamId =
        Number(
          req.query.team
        );

      const leagueId =
        Number(
          req.query.league
        );

      const season =
        Number(
          req.query.season
        );


      if (
        !teamId ||
        !leagueId ||
        !season
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Provide team, league and season."

        });

      }


      const data =
        await getTeamStats(
          teamId,
          leagueId,
          season
        );


      res.json({

        success: true,

        provider:
          "API-Football",

        data

      });


    } catch (error) {

      console.error(
        "Team statistics error:",
        error
      );


      res.status(500).json({

        success: false,

        error:
          error.message

      });

    }

  }
);


/* =========================================================
   BATCH STATISTICAL SCORING TEST
   ========================================================= */

app.get(
  "/statistical-score-test",
  async (req, res) => {

    try {

      const homeTeamId =
        Number(
          req.query.home
        );

      const awayTeamId =
        Number(
          req.query.away
        );

      const odds =
        Number(
          req.query.odds
        );

      const pick =
        String(
          req.query.pick || ""
        );


      if (
        !homeTeamId ||
        !awayTeamId ||
        !odds ||
        !pick
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Provide home, away, odds and pick."

        });

      }


      const result =
        await scoreMarketsWithStatistics([
          {

            eventName:
              "Statistical Test",

            homeTeamId,

            awayTeamId,

            odds,

            pick

          }
        ]);


      res.json(
        result
      );


    } catch (error) {

      console.error(
        "Batch statistical scoring error:",
        error
      );


      res.status(500).json({

        success: false,

        error:
          error.message ||
          "Unable to score market with statistics."

      });

    }

  }
);


/* =========================================================
   FOOTBALL-DATA.ORG TEST
   ========================================================= */

app.get(
  "/football-data-test",
  async (req, res) => {

    try {

      const result =
        await testFootballDataConnection();

      res.json(
        result
      );


    } catch (error) {

      console.error(
        "Football-Data.org test error:",
        error
      );


      res.status(500).json({

        success: false,

        provider:
          "Football-Data.org",

        error:
          error.message ||
          "Football-Data.org connection failed."

      });

    }

  }
);


/* =========================================================
   FOOTBALL-DATA.ORG TEAM FORM TEST
   ========================================================= */

app.get(
  "/team-form-test",
  async (req, res) => {

    try {

      const teamId =
        Number(
          req.query.team
        );


      if (!teamId) {

        return res.status(400).json({

          success: false,

          error:
            "Provide a team ID."

        });

      }


      const result =
        await getRecentTeamForm(
          teamId,
          5
        );


      res.json(
        result
      );


    } catch (error) {

      console.error(
        "Team form error:",
        error
      );


      res.status(500).json({

        success: false,

        provider:
          "Football-Data.org",

        error:
          error.message ||
          "Unable to retrieve team form."

      });

    }

  }
);


/* =========================================================
   FOOTBALL-DATA.ORG MATCH ANALYSIS TEST
   ========================================================= */

app.get(
  "/match-stats-test",
  async (req, res) => {

    try {

      const homeTeamId =
        Number(
          req.query.home
        );

      const awayTeamId =
        Number(
          req.query.away
        );


      if (
        !homeTeamId ||
        !awayTeamId
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Provide home and away team IDs."

        });

      }


      const result =
        await analyzeMatchStats(
          homeTeamId,
          awayTeamId
        );


      res.json(
        result
      );


    } catch (error) {

      console.error(
        "Match statistics error:",
        error
      );


      res.status(500).json({

        success: false,

        provider:
          "Football-Data.org",

        error:
          error.message ||
          "Unable to analyze match."

      });

    }

  }
);


/* =========================================================
   MARKET VS STATISTICS TEST
   ========================================================= */

app.get(
  "/market-stats-test",
  async (req, res) => {

    try {

      const homeTeamId =
        Number(
          req.query.home
        );

      const awayTeamId =
        Number(
          req.query.away
        );

      const odds =
        Number(
          req.query.odds
        );

      const pick =
        String(
          req.query.pick || ""
        );


      if (
        !homeTeamId ||
        !awayTeamId ||
        !odds ||
        !pick
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Provide home, away, odds and pick."

        });

      }


      const analysis =
        await analyzeMatchStats(
          homeTeamId,
          awayTeamId
        );


      const comparison =
        compareMarketWithStats(
          {
            odds,
            pick
          },
          analysis
        );


      res.json({

        success: true,

        homeTeamId,

        awayTeamId,

        market: {

          pick,

          odds

        },

        comparison

      });


    } catch (error) {

      console.error(
        "Market statistics error:",
        error
      );


      res.status(500).json({

        success: false,

        error:
          error.message ||
          "Unable to compare market with statistics."

      });

    }

  }
);


/* =========================================================
   FOOTBALL-DATA.ORG PREMIER LEAGUE MATCHES TEST
   ========================================================= */

app.get(
  "/football-data-matches-test",
  async (req, res) => {

    try {

      const data =
        await getCompetitionMatches(
          "PL"
        );


      res.json({

        success: true,

        provider:
          "Football-Data.org",

        competition:
          "Premier League",

        season:
          data?.filters?.season ||
          null,

        resultSet:
          data?.resultSet ||
          null,

        matches:
          data?.matches ||
          []

      });


    } catch (error) {

      console.error(
        "Football-Data.org matches error:",
        error
      );


      res.status(500).json({

        success: false,

        provider:
          "Football-Data.org",

        error:
          error.message ||
          "Unable to retrieve matches."

      });

    }

  }
);


/* =========================================================
   SPORTYBET API CONNECTION TEST
   ========================================================= */

app.get(
  "/sportybet-test",
  async (req, res) => {

    try {

      const target =
        Number(
          req.query.target || 10
        );


      if (
        !Number.isFinite(target) ||
        target <= 1
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Target odds must be greater than 1."

        });

      }


      const data =
        await fetchSportyBetCandidates(
          target
        );


      res.json({

        success: true,

        source:
          OLD_API,

        candidatesAvailable:
          data.filteredCandidates.length,

        oldApiSuccess:
          data.success,

        oldApiError:
          data.error || null,

        targetOdds:
          target,

        engineVersion:
          data.engineVersion || null

      });


    } catch (error) {

      console.error(
        "SportyBet API connection error:",
        error
      );


      res.status(500).json({

        success: false,

        error:
          error.message ||
          "Could not connect to old SportyBet API."

      });

    }

  }
);


/* =========================================================
   CONVERT OLD API CANDIDATES
   TO V2 MARKET FORMAT
   ========================================================= */

function convertCandidateToMarket(candidate) {

  const event =
    candidate?.event || {};

  const market =
    candidate?.market || {};


  return {

    eventId:
      String(
        candidate.eventId ||
        event.eventId ||
        ""
      ),


    eventName:
      candidate.match ||
      candidate.eventName ||
      `${candidate.homeTeam || event.homeTeamName || ""} vs ${candidate.awayTeam || event.awayTeamName || ""}`,


    homeTeam:
      candidate.homeTeam ||
      event.homeTeamName ||
      "",


    awayTeam:
      candidate.awayTeam ||
      event.awayTeamName ||
      "",


    homeTeamId:
      candidate.homeTeamId ||
      null,


    awayTeamId:
      candidate.awayTeamId ||
      null,


    marketName:
      candidate.market ||
      candidate.marketName ||
      market.name ||
      "",


    selection:
      candidate.pick ||
      candidate.selection ||
      "",


    odds:
      Number(
        candidate.odds || 0
      ),


    competition:
      candidate.competition ||
      event.competition ||
      "",


    category:
      candidate.category ||
      event.category ||
      "",


    gameId:
      candidate.gameId ||
      event.gameId ||
      "",


    startTime:
      candidate.startTime ||
      event.startTime ||
      null,


    marketId:
      String(
        candidate.marketId ||
        market.marketId ||
        ""
      ),


    outcomeId:
      String(
        candidate.outcomeId ||
        ""
      ),


    specifier:
      candidate.specifier ??
      market.specifier ??
      null

  };

}


/* =========================================================
   MAIN OPTIMIZER
   ========================================================= */

app.get(
  "/optimize",
  async (req, res) => {

    try {

      const target =
        Number(
          req.query.target || 100
        );


      if (
        !Number.isFinite(target) ||
        target <= 1
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Target odds must be greater than 1."

        });

      }


      /* ---------------------------------------------------
         GET CANDIDATE POOL
         --------------------------------------------------- */

      const oldData =
        await fetchSportyBetCandidates(
          target
        );


      const rawCandidates =
        oldData.filteredCandidates;


      /* ---------------------------------------------------
         CONVERT + DEDUPE
         --------------------------------------------------- */

      const uniqueMarkets =
        new Map();


      for (
        const candidate
        of rawCandidates
      ) {

        const market =
          convertCandidateToMarket(
            candidate
          );


        if (!market) {
          continue;
        }


        const key = [

          market.eventId,

          market.marketId,

          market.outcomeId,

          market.specifier,

          market.selection

        ].join(":");


        if (
          !uniqueMarkets.has(key)
        ) {

          uniqueMarkets.set(
            key,
            market
          );

        }

      }


      const markets =
        Array.from(
          uniqueMarkets.values()
        );


      console.log(
        "Raw candidates:",
        rawCandidates.length
      );


      console.log(
        "Unique markets:",
        markets.length
      );


      /* ---------------------------------------------------
         RUN V4.4 PROBABILITY ENGINE
         --------------------------------------------------- */

      const engine =
        runProbabilityEngine(
          markets,
          target
        );


      console.log(
        "V2 engine result:",
        engine.success
      );


      console.log(
        "V2 engine version:",
        engine.engineVersion
      );


      /* ---------------------------------------------------
         CREATE SPORTYBET BOOKING
         --------------------------------------------------- */

      let booking = null;


      if (
        engine.success &&
        Array.isArray(
          engine.selections
        ) &&
        engine.selections.length
      ) {

        const bookingSelections =
          engine.selections
            .map(item => ({

              eventId:
                item.eventId,

              marketId:
                item.marketId,

              specifier:
                item.specifier ??
                null,

              outcomeId:
                item.outcomeId

            }))
            .filter(item =>
              item.eventId &&
              item.marketId &&
              item.outcomeId
            );


        console.log(
          "Booking selections:",
          bookingSelections.length
        );


        if (
          bookingSelections.length ===
          engine.selections.length
        ) {

          try {

            const bookingResponse =
              await fetch(
                `${OLD_API}/create-booking`,
                {

                  method: "POST",

                  headers: {

                    "Content-Type":
                      "application/json"

                  },

                  body:
                    JSON.stringify({

                      selections:
                        bookingSelections

                    })

                }
              );


            const bookingRaw =
              await bookingResponse.text();


            let bookingData;


            try {

              bookingData =
                JSON.parse(
                  bookingRaw
                );

            } catch {

              bookingData = {

                success: false,

                error:
                  "Booking API returned non-JSON."

              };

            }


            if (
              bookingResponse.ok &&
              bookingData?.success
            ) {

              booking =
                bookingData;


              console.log(
                "SportyBet booking created:",
                booking.shareCode
              );


            } else {

              booking = {

                success: false,

                error:
                  bookingData?.error ||
                  "SportyBet booking creation failed."

              };


              console.error(
                "Booking creation failed:",
                bookingData
              );

            }


          } catch (bookingError) {

            booking = {

              success: false,

              error:
                bookingError.message ||
                "Unable to connect to booking API."

            };


            console.error(
              "Booking request error:",
              bookingError
            );

          }


        } else {

          booking = {

            success: false,

            error:
              "Some V4.4 selections are missing SportyBet booking fields."

          };

        }

      }


      /* ---------------------------------------------------
         RETURN RESULT
         --------------------------------------------------- */

      res.json({

        success:
          engine.success,

        generatedAt:
          new Date().toISOString(),

        service:
          "Football 360 Optimizer V2",

        dataSource:
          OLD_API,

        targetOdds:
          target,

        sourceCandidates:
          rawCandidates.length,

        uniqueMarkets:
          markets.length,

        oldApiSuccess:
          oldData.success,

        oldApiEngineVersion:
          oldData.engineVersion || null,

        oldApiError:
          oldData.error || null,

        engineVersion:
          engine.engineVersion,

        engineResult:
          engine,

        booking:
          booking

      });


    } catch (error) {

      console.error(
        "V2 optimize error:",
        error
      );


      res.status(500).json({

        success: false,

        error:
          error.message ||
          "V2 optimization failed."

      });

    }

  }
);


/* =========================================================
   START SERVER
   ========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      `Football 360 Optimizer V2 running on port ${PORT}`
    );

  }
);


/* =========================================================
   START TELEGRAM BOT
   ========================================================= */

startTelegramBot();
