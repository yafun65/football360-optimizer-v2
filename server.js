import express from "express";
import cors from "cors";

import {
  ENGINE_VERSION,
  runProbabilityEngine
} from "./probabilityEngine.js";

const app = express();

const PORT = process.env.PORT || 10000;

const SPORTYBET_BASE =
  process.env.SPORTYBET_BASE ||
  "https://www.sportybet.com";

app.use(cors());
app.use(express.json());


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Football 360 Optimizer V2",
    engine: ENGINE_VERSION,
    dataSource: "SportyBet direct"
  });
});


/* =========================================================
   ENGINE INFO
   ========================================================= */

app.get("/engine", (req, res) => {
  res.json({
    engine: ENGINE_VERSION,
    strategy: "Probability-based optimizer",
    probabilitySource: "Market-implied probability",
    dataSource: "SportyBet direct",
    sportybetBase: SPORTYBET_BASE
  });
});


/* =========================================================
   SPORTYBET DIRECT FETCH
   ========================================================= */

async function fetchSportyBetPage(pageNum = 1) {

  const params = new URLSearchParams({

    sportId:
      "sr:sport:1",

    marketId:
      "1,18,10,29,11,26,36,14,16,45,47,60,60100",

    pageSize:
      "100",

    pageNum:
      String(pageNum),

    todayGames:
      "false",

    timeline:
      "720",

    _t:
      String(Date.now())

  });


  const url =
    `${SPORTYBET_BASE}/api/ng/factsCenter/pcUpcomingEvents?${params.toString()}`;


  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      15000
    );


  try {

    const response =
      await fetch(
        url,
        {
          method: "GET",

          headers: {
            "Accept":
              "application/json",

            "Content-Type":
              "application/json",

            "Current-Country":
              "NG",

            "User-Agent":
              "Mozilla/5.0"
          },

          signal:
            controller.signal
        }
      );


    const text =
      await response.text();


    let data;


    try {

      data =
        JSON.parse(text);

    } catch {

      throw new Error(
        `SportyBet returned non-JSON response. HTTP ${response.status}`
      );

    }


    if (!response.ok) {

      throw new Error(
        `SportyBet HTTP ${response.status}: ${
          data?.message ||
          data?.innerMsg ||
          "Unknown error"
        }`
      );

    }


    if (
      data?.bizCode &&
      data.bizCode !== 10000
    ) {

      throw new Error(
        `SportyBet bizCode ${data.bizCode}: ${
          data.message ||
          data.innerMsg ||
          "Invalid response"
        }`
      );

    }


    return {
      url,
      data
    };


  } finally {

    clearTimeout(timeout);

  }

}


/* =========================================================
   CONVERT SPORTYBET RESPONSE TO ENGINE MARKETS
   ========================================================= */

function extractMarkets(data) {

  const markets = [];


  const tournaments =
    Array.isArray(
      data?.data?.tournaments
    )
      ? data.data.tournaments
      : [];


  for (
    const tournament of tournaments
  ) {

    const competition =
      tournament?.name ||
      tournament?.tournamentName ||
      "";


    const events =
      Array.isArray(
        tournament?.events
      )
        ? tournament.events
        : [];


    for (
      const event of events
    ) {

      const eventId =
        event?.eventId ||
        event?.id;


      if (!eventId) {
        continue;
      }


      const homeTeam =
        event?.homeTeamName ||
        event?.homeTeam ||
        "";


      const awayTeam =
        event?.awayTeamName ||
        event?.awayTeam ||
        "";


      const eventName =
        homeTeam && awayTeam
          ? `${homeTeam} vs ${awayTeam}`
          : String(eventId);


      const eventMarkets =
        Array.isArray(
          event?.markets
        )
          ? event.markets
          : [];


      for (
        const market of eventMarkets
      ) {

        const marketId =
          market?.id;


        const marketName =
          market?.desc ||
          market?.name ||
          `Market ${marketId || ""}`;


        const specifier =
          market?.specifier;


        const outcomes =
          Array.isArray(
            market?.outcomes
          )
            ? market.outcomes
            : [];


        for (
          const outcome of outcomes
        ) {

          if (
            outcome?.isActive === false
          ) {
            continue;
          }


          const odds =
            Number(
              outcome?.odds
            );


          if (
            !Number.isFinite(odds) ||
            odds <= 1
          ) {
            continue;
          }


          markets.push({

            eventId:
              String(eventId),

            eventName,

            competition,

            marketId:
              marketId
                ? String(marketId)
                : undefined,

            marketName,

            specifier,

            outcomeId:
              outcome?.id
                ? String(outcome.id)
                : undefined,

            selection:
              outcome?.desc ||
              outcome?.name ||
              "Unknown",

            odds

          });

        }

      }

    }

  }


  return markets;

}


/* =========================================================
   EVENTS TEST
   ========================================================= */

app.get("/events-test", async (req, res) => {

  try {

    const page =
      Math.max(
        1,
        Number(req.query.page || 1)
      );


    const result =
      await fetchSportyBetPage(
        page
      );


    const markets =
      extractMarkets(
        result.data
      );


    const tournaments =
      Array.isArray(
        result.data?.data?.tournaments
      )
        ? result.data.data.tournaments
        : [];


    const events =
      tournaments.flatMap(
        tournament =>
          Array.isArray(
            tournament?.events
          )
            ? tournament.events
            : []
      );


    res.json({

      success: true,

      source:
        "SportyBet direct",

      page,

      tournamentsFound:
        tournaments.length,

      eventsFound:
        events.length,

      marketsFound:
        markets.length,

      markets:
        markets.slice(
          0,
          100
        )

    });


  } catch (error) {

    console.error(
      "SportyBet events error:",
      error
    );


    res.status(502).json({

      success: false,

      source:
        "SportyBet direct",

      error:
        error.message

    });

  }

});


/* =========================================================
   OPTIMIZER
   ========================================================= */

app.get("/optimize", async (req, res) => {

  try {

    const targetOdds =
      Number(
        req.query.target ||
        100
      );


    if (
      !Number.isFinite(targetOdds) ||
      targetOdds <= 1
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Target odds must be greater than 1."

      });

    }


    const pageNumbers =
      Array.from(
        {
          length: 3
        },
        (_, index) =>
          index + 1
      );


    const pageResults =
      await Promise.all(

        pageNumbers.map(
          page =>
            fetchSportyBetPage(
              page
            ).catch(
              error => {

                console.error(
                  `SportyBet page ${page} failed:`,
                  error.message
                );

                return null;

              }
            )
        )

      );


    const allMarkets = [];


    for (
      const result of pageResults
    ) {

      if (!result) {
        continue;
      }


      const markets =
        extractMarkets(
          result.data
        );


      allMarkets.push(
        ...markets
      );

    }


    if (
      allMarkets.length === 0
    ) {

      return res.status(502).json({

        success: false,

        error:
          "SportyBet returned no usable football markets.",

        pagesChecked:
          pageNumbers.length

      });

    }


    const engine =
      runProbabilityEngine(
        allMarkets,
        targetOdds
      );


    res.json({

      success:
        engine.success,

      generatedAt:
        new Date().toISOString(),

      dataSource:
        "SportyBet direct",

      targetOdds,

      marketsFetched:
        allMarkets.length,

      ...engine

    });


  } catch (error) {

    console.error(
      "Optimizer error:",
      error
    );


    res.status(500).json({

      success: false,

      error:
        error.message ||
        "Optimizer failed."

    });

  }

});


/* =========================================================
   MANUAL ENGINE TEST
   ========================================================= */

app.post("/test-engine", (req, res) => {

  try {

    const {
      markets,
      targetOdds,
      options
    } = req.body;


    if (
      !Array.isArray(markets)
    ) {

      return res.status(400).json({

        success: false,

        error:
          "markets must be an array"

      });

    }


    const result =
      runProbabilityEngine(
        markets,
        Number(targetOdds),
        options || {}
      );


    res.json(result);


  } catch (error) {

    res.status(500).json({

      success: false,

      error:
        error.message

    });

  }

});


/* =========================================================
   SERVER START
   ========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      "=========================================="
    );

    console.log(
      "FOOTBALL 360 OPTIMIZER V2"
    );

    console.log(
      "=========================================="
    );

    console.log(
      `Port: ${PORT}`
    );

    console.log(
      `Engine: ${ENGINE_VERSION}`
    );

    console.log(
      `SportyBet: ${SPORTYBET_BASE}`
    );

    console.log(
      "Data source: SportyBet direct"
    );

    console.log(
      "Server started successfully."
    );

    console.log(
      "=========================================="
    );

  }
);
