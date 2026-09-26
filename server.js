import express from "express";
import cors from "cors";

import {
  runProbabilityEngine
} from "./probabilityEngine.js";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const OLD_API =
  "https://sportybet-api.onrender.com";


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Football 360 Optimizer V2",
    engine: "Probability Engine V2"
  });
});


/* =========================================================
   TEST CONNECTION TO WORKING SPORTYBET API
   ========================================================= */

app.get("/sportybet-test", async (req, res) => {

  try {

    const response =
      await fetch(
        `${OLD_API}/selection-engine?target=10`
      );

    const text =
      await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        success: false,
        error:
          "Old SportyBet API returned a non-JSON response.",
        httpStatus: response.status,
        response: text.slice(0, 500)
      });
    }

    res.json({
      success: true,
      source: OLD_API,
      httpStatus: response.status,
      oldApiResponse: data
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

});


/* =========================================================
   TEST PROBABILITY ENGINE
   ========================================================= */

app.get("/test-engine", (req, res) => {

  const target =
    Number(
      req.query.target || 10
    );

  const markets = [

    {
      eventId: "match-1",
      eventName: "Team A vs Team B",
      marketName: "Double Chance",
      selection: "Home or Away",
      odds: 1.30
    },

    {
      eventId: "match-2",
      eventName: "Team C vs Team D",
      marketName: "Over/Under",
      selection: "Under 3.5",
      odds: 1.40
    },

    {
      eventId: "match-3",
      eventName: "Team E vs Team F",
      marketName: "Draw No Bet",
      selection: "Home",
      odds: 1.50
    },

    {
      eventId: "match-4",
      eventName: "Team G vs Team H",
      marketName: "Double Chance",
      selection: "Draw or Away",
      odds: 1.60
    }

  ];

  const result =
    runProbabilityEngine(
      markets,
      target
    );

  res.json(result);

});


/* =========================================================
   START SERVER
   ========================================================= */

app.listen(PORT, () => {

  console.log(
    `Football 360 Optimizer V2 running on port ${PORT}`
  );

});
