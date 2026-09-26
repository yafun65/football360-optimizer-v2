import express from "express";
import cors from "cors";

import {
  ENGINE_VERSION,
  runProbabilityEngine
} from "./probabilityEngine.js";

const app = express();

const PORT = process.env.PORT || 10000;

const SPORTYBET_API_BASE =
  process.env.SPORTYBET_API_BASE ||
  "https://sportybet-api.onrender.com";

app.use(cors());
app.use(express.json());


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Football 360 Optimizer V2",
    engine: ENGINE_VERSION
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
    sportybetApi: SPORTYBET_API_BASE
  });
});


/* =========================================================
   SPORTYBET API TEST
   ========================================================= */

app.get("/sportybet-test", async (req, res) => {
  try {
    const response = await fetch(SPORTYBET_API_BASE);

    const data = await response.text();

    res.json({
      success: true,
      status: response.status,
      sportybetApi: SPORTYBET_API_BASE,
      response: data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   UPCOMING EVENTS TEST
   ========================================================= */

app.get("/events-test", async (req, res) => {
  try {

    const url =
      `${SPORTYBET_API_BASE}/api/ng/factsCenter/pcUpcomingEvents` +
      `?marketId=1,18,10,29,11,26,36,14,16,45,47,60,60100` +
      `&timeline=720`;

    const response = await fetch(url);

    const data = await response.text();

    res.status(response.status).json({
      success: response.ok,
      status: response.status,
      url,
      response: data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      error: error.message
    });

  }
});


/* =========================================================
   PROBABILITY ENGINE TEST
   ========================================================= */

app.post("/test-engine", (req, res) => {

  try {

    const {
      markets,
      targetOdds,
      options
    } = req.body;

    if (!Array.isArray(markets)) {
      return res.status(400).json({
        success: false,
        error: "markets must be an array"
      });
    }

    const result = runProbabilityEngine(
      markets,
      Number(targetOdds),
      options || {}
    );

    res.json(result);

  } catch (error) {

    res.status(500).json({
      success: false,
      error: error.message
    });

  }

});


/* =========================================================
   SERVER START
   ========================================================= */

app.listen(PORT, () => {

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
    `SportyBet API: ${SPORTYBET_API_BASE}`
  );

  console.log(
    "Server started successfully."
  );

  console.log(
    "=========================================="
  );

});
