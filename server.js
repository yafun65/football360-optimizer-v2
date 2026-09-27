/* =========================================================
   FOOTBALL 360 OPTIMIZER V2
   SERVER
   ========================================================= */

import express from "express";
import cors from "cors";
import { startTelegramBot } from "./telegramBot.js";

import {
  runProbabilityEngine
} from "./probabilityEngine.js";


const app = express();

app.use(cors());
app.use(express.json());

const PORT =
  process.env.PORT || 3000;


/* =========================================================
   EXISTING WORKING SPORTYBET API
   ========================================================= */

const OLD_API =
  "https://sportybet-api.onrender.com";


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get("/", (req, res) => {

  res.json({

    status: "online",

    service:
      "Football 360 Optimizer V2",

    engine:
      "Probability Engine V4.3",

    dataSource:
      OLD_API

  });

});


/* =========================================================
   FETCH SPORTYBET CANDIDATE POOL
   ========================================================= */

async function fetchSportyBetCandidates(target) {

  const url =
    `${OLD_API}/selection-engine?target=${encodeURIComponent(target)}&includeCandidates=true`;

  console.log(
    "Fetching SportyBet candidates:",
    url
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
    "Filtered candidates:",
    Array.isArray(data.filteredCandidates)
      ? data.filteredCandidates.length
      : 0
  );


  /*
     IMPORTANT:

     We do NOT require data.success === true.

     The old strategy engine can fail to create
     its own combination while still returning the
     complete filteredCandidates pool.

     V2 needs the candidate pool, not the old
     combination.
  */

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

function convertCandidateToMarket(
  candidate
) {

  if (
    !candidate ||
    typeof candidate !== "object"
  ) {

    return null;

  }


  const odds =
    Number(
      candidate.odds
    );


  if (
    !Number.isFinite(odds) ||
    odds <= 1
  ) {

    return null;

  }


  return {

    eventId:
      String(
        candidate.eventId ||
        candidate.gameId ||
        ""
      ),

    eventName:
      candidate.match ||
      `${candidate.homeTeam || "Unknown"} vs ${candidate.awayTeam || "Unknown"}`,

    marketName:
      candidate.market ||
      "Unknown Market",

    selection:
      candidate.pick ||
      "Unknown Selection",

    odds,

    competition:
      candidate.competition ||
      "",

    category:
      candidate.category ||
      "",

    gameId:
      candidate.gameId ||
      null,

    startTime:
      candidate.startTime ||
      null,

    marketId:
      candidate.marketId ||
      null,

    outcomeId:
      candidate.outcomeId ||
      null,

    specifier:
      candidate.specifier ??
      null

  };

}


/* =========================================================
   OPTIMIZE
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
         RUN V4.3 PROBABILITY ENGINE
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
          engine

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
   SIMPLE ENGINE TEST
   ========================================================= */

app.get(
  "/test-engine",
  (req, res) => {

    const target =
      Number(
        req.query.target || 10
      );


    const markets = [

      {
        eventId: "test-1",
        eventName: "Team A vs Team B",
        marketName: "Double Chance",
        selection: "Home or Away",
        odds: 1.30
      },

      {
        eventId: "test-2",
        eventName: "Team C vs Team D",
        marketName: "Over/Under",
        selection: "Under 3.5",
        odds: 1.40
      },

      {
        eventId: "test-3",
        eventName: "Team E vs Team F",
        marketName: "Draw No Bet",
        selection: "Home",
        odds: 1.50
      },

      {
        eventId: "test-4",
        eventName: "Team G vs Team H",
        marketName: "Double Chance",
        selection: "Draw or Away",
        odds: 1.60
      },

      {
        eventId: "test-5",
        eventName: "Team I vs Team J",
        marketName: "Over/Under",
        selection: "Under 4.5",
        odds: 1.35
      },

      {
        eventId: "test-6",
        eventName: "Team K vs Team L",
        marketName: "Double Chance",
        selection: "Home or Away",
        odds: 1.45
      }

    ];


    const result =
      runProbabilityEngine(
        markets,
        target
      );


    res.json(result);

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
