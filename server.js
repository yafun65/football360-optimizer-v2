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
      "Probability Engine V2",

    dataSource:
      OLD_API

  });

});


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


      const response =
        await fetch(
          `${OLD_API}/selection-engine?target=${encodeURIComponent(target)}&includeCandidates=true`
        );


      const text =
        await response.text();


      let data;


      try {

        data =
          JSON.parse(text);

      } catch {

        return res.status(502).json({

          success: false,

          error:
            "Old SportyBet API returned a non-JSON response.",

          httpStatus:
            response.status,

          response:
            text.slice(0, 1000)

        });

      }


      res.json({

        success: true,

        source:
          OLD_API,

        httpStatus:
          response.status,

        oldApiResponse:
          data

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


      const response =
        await fetch(
          `${OLD_API}/selection-engine?target=${encodeURIComponent(target)}&includeCandidates=true`
        );


      const text =
        await response.text();


      let oldData;


      try {

        oldData =
          JSON.parse(text);

      } catch {

        return res.status(502).json({

          success: false,

          error:
            "Old SportyBet API returned invalid JSON.",

          httpStatus:
            response.status,

          response:
            text.slice(0, 1000)

        });

      }


      if (
        !response.ok ||
        !oldData.success
      ) {

        return res.status(502).json({

          success: false,

          error:
            "Old SportyBet API did not return successful data.",

          httpStatus:
            response.status,

          oldApiResponse:
            oldData

        });

      }


      const rawCandidates = [];


      if (
        Array.isArray(
          oldData.filteredCandidates
        )
      ) {

        rawCandidates.push(
          ...oldData.filteredCandidates
        );

      }


      if (
        rawCandidates.length === 0 &&
        oldData.combination &&
        Array.isArray(
          oldData.combination.selections
        )
      ) {

        rawCandidates.push(
          ...oldData.combination.selections
        );

      }


      if (
        rawCandidates.length === 0 &&
        Array.isArray(
          oldData.topCandidates
        )
      ) {

        rawCandidates.push(
          ...oldData.topCandidates
        );

      }


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


      const engine =
        runProbabilityEngine(
          markets,
          target
        );


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
