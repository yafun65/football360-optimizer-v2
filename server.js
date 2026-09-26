/* =========================================================
   FOOTBALL 360 OPTIMIZER V2
   SERVER
   ========================================================= */

import express from "express";
import cors from "cors";

import {
  ENGINE_VERSION,
  runProbabilityEngine
} from "./probabilityEngine.js";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const app = express();

const PORT =
  process.env.PORT || 10000;

const SPORTYBET_API_BASE =
  process.env.SPORTYBET_API_BASE ||
  "https://sportybet-api.onrender.com";


/* =========================================================
   EXPRESS SETUP
   ========================================================= */

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
    message:
      "Football 360 probability optimizer is running."
  });
});


/* =========================================================
   ENGINE INFORMATION
   ========================================================= */

app.get("/engine", (req, res) => {
  res.json({
    engine: ENGINE_VERSION,

    strategy:
      "Probability-based target odds optimizer",

    probabilitySource:
      "Market-implied probability from available odds",

    defaultSettings: {
      minProbability: 0.55,
      minOdds: 1.30,
      maxOdds: 4.00,
      maxSelections: 20
    }
  });
});


/* =========================================================
   GENERIC FETCH HELPER
   ========================================================= */

async function fetchJson(url) {
  const response =
    await fetch(url);

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON response from ${url}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Request failed with HTTP ${response.status}`
    );
  }

  return data;
}


/* =========================================================
   EXTRACT ARRAY FROM API RESPONSE
   ========================================================= */

function findArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  /*
    Common response properties.
  */

  const possibleKeys = [
    "events",
    "data",
    "results",
    "items",
    "matches",
    "records"
  ];

  for (const key of possibleKeys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }

  /*
    Search one level deeper.
  */

  for (const key of Object.keys(value)) {
    const child = value[key];

    if (
      child &&
      typeof child === "object"
    ) {
      const found =
        findArray(child);

      if (found) {
        return found;
      }
    }
  }

  return null;
}


/* =========================================================
   NORMALIZE EVENT
   ========================================================= */

function normalizeEvent(event) {
  if (!event || typeof event !== "object") {
    return null;
  }

  const eventId =
    event.id ??
    event.eventId ??
    event.event_id ??
    event.matchId ??
    event.match_id ??
    event.event?.id;

  if (!eventId) {
    return null;
  }

  const home =
    event.homeTeam ??
    event.home_team ??
    event.home ??
    event.homeName ??
    event.home_name ??
    event.event?.homeTeam ??
    "";

  const away =
    event.awayTeam ??
    event.away_team ??
    event.away ??
    event.awayName ??
    event.away_name ??
    event.event?.awayTeam ??
    "";

  const eventName =
    event.name ??
    event.eventName ??
    event.event_name ??
    event.matchName ??
    event.match_name ??
    (
      home && away
        ? `${home} vs ${away}`
        : `Event ${eventId}`
    );

  return {
    ...event,

    eventId:
      String(eventId),

    eventName:
      String(eventName),

    homeTeam:
      String(home),

    awayTeam:
      String(away)
  };
}


/* =========================================================
   FIND UPCOMING EVENTS
   ========================================================= */

async function getUpcomingEvents() {

  /*
    This is the existing SportyBet API endpoint
    used by the user's API.

    The optimizer does NOT replace that API.
  */

  const url =
    `${SPORTYBET_API_BASE}/api/ng/factsCenter/pcUpcomingEvents` +
    `?marketId=1,18,10,29,11,26,36,14,16,45,47,60,60100` +
    `&timeline=720`;

  const data =
    await fetchJson(url);

  const array =
    findArray(data);

  if (!array) {
    return [];
  }

  return array
    .map(normalizeEvent)
    .filter(Boolean);
}


/* =========================================================
   EXTRACT EVENT ID
   ========================================================= */

function getEventId(event) {
  return (
    event.eventId ??
    event.id ??
    event.event_id ??
    event.matchId ??
    event.match_id
  );
}


/* =========================================================
   EXTRACT MARKETS FROM EVENT DATA
   ========================================================= */

function extractMarketsFromObject(
  event,
  eventId,
  eventName
) {
  const markets = [];

  function walk(value, path = "") {

    if (!value) {
      return;
    }

    if (Array.isArray(value)) {

      for (const item of value) {
        walk(item, path);
      }

      return;
    }

    if (
      typeof value !== "object"
    ) {
      return;
    }

    /*
      Detect objects that look like an odds selection.
    */

    const odds =
      Number(
        value.odds ??
        value.odd ??
        value.price ??
        value.value
      );

    const selection =
      value.selection ??
      value.selectionName ??
      value.selection_name ??
      value.outcome ??
      value.outcomeName ??
      value.label ??
      value.name;

    if (
      Number.isFinite(odds) &&
      odds > 1 &&
      selection
    ) {

      markets.push({
        eventId:
          String(eventId),

        eventName:
          String(eventName),

        marketName:
          value.marketName ??
          value.market_name ??
          value.market ??
          path ??
          "Unknown Market",

        selection:
          String(selection),

        odds,

        raw:
          value
      });
    }

    for (
      const [key, child]
      of Object.entries(value)
    ) {

      /*
        Avoid recursively following raw objects
        that are clearly metadata.
      */

      if (
        key === "raw" ||
        key === "metadata"
      ) {
        continue;
      }

      walk(
        child,
        path
          ? `${path}.${key}`
          : key
      );
    }
  }

  walk(event);

  return markets;
}


/* =========================================================
   LOAD MARKETS FOR ONE EVENT
   ========================================================= */

async function getEventMarkets(eventId) {

  /*
    The existing API requires valid SportyBet
    event IDs.

    We use its event-markets endpoint.
  */

  const url =
    `${SPORTYBET_API_BASE}/api/event-markets/${encodeURIComponent(eventId)}`;

  try {

    const data =
      await fetchJson(url);

    return data;

  } catch (error) {

    return {
      error:
        error.message,

      eventId
    };
  }
}


/* =========================================================
   NORMALIZE MARKET RESPONSE
   ========================================================= */

function normalizeMarketResponse(
  data,
  event
) {
  if (!data) {
    return [];
  }

  const eventId =
    getEventId(event);

  const eventName =
    event.eventName ||
    `Event ${eventId}`;

  /*
    Try to locate an array inside the response.
  */

  const possibleArrays = [
    data,
    data.markets,
    data.data,
    data.events,
    data.results,
    data.items
  ];

  for (
    const possible
    of possibleArrays
  ) {

    if (Array.isArray(possible)) {

      return extractMarketsFromObject(
        possible,
        eventId,
        eventName
      );
    }
  }

  return extractMarketsFromObject(
    data,
    eventId,
    eventName
  );
}


/* =========================================================
   SCAN MARKETS
   ========================================================= */

async function scanMarkets(limit = 20) {

  const events =
    await getUpcomingEvents();

  const limitedEvents =
    events.slice(0, limit);

  const allMarkets = [];

  /*
    Process events sequentially.

    This is intentionally conservative to avoid
    hammering the existing API.
  */

  for (
    const event
    of limitedEvents
  ) {

    const eventId =
      getEventId(event);

    if (!eventId) {
      continue;
    }

    const marketData =
      await getEventMarkets(
        eventId
      );

    const markets =
      normalizeMarketResponse(
        marketData,
        event
      );

    allMarkets.push(
      ...markets
    );
  }

  return {
    eventsScanned:
      limitedEvents.length,

    marketsFound:
      allMarkets.length,

    markets:
      allMarkets
  };
}


/* =========================================================
   SCAN ENDPOINT
   ========================================================= */

app.get(
  "/scan",
  async (req, res) => {

    try {

      const limit =
        Math.min(
          Number(req.query.limit) || 10,
          30
        );

      const result =
        await scanMarkets(
          limit
        );

      res.json({
        success: true,

        engine:
          ENGINE_VERSION,

        ...result
      });

    } catch (error) {

      console.error(
        "SCAN ERROR:",
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
   OPTIMIZE ENDPOINT
   ========================================================= */

app.get(
  "/optimize",
  async (req, res) => {

    try {

      const targetOdds =
        Number(
          req.query.target ||
          req.query.odds
        );

      if (
        !Number.isFinite(targetOdds) ||
        targetOdds <= 1
      ) {

        return res.status(400).json({
          success: false,

          error:
            "Please provide a target odds greater than 1. Example: /optimize?target=100"
        });
      }

      const limit =
        Math.min(
          Number(req.query.limit) || 10,
          30
        );

      /*
        Optional parameters.
      */

      const minProbability =
        Number(
          req.query.minProbability
        ) || 0.55;

      const minOdds =
        Number(
          req.query.minOdds
        ) || 1.30;

      const maxOdds =
        Number(
          req.query.maxOdds
        ) || 4.00;

      const maxSelections =
        Math.min(
          Number(
            req.query.maxSelections
          ) || 20,
          30
        );

      /*
        Get available markets.
      */

      const scan =
        await scanMarkets(
          limit
        );

      if (
        !scan.markets ||
        scan.markets.length === 0
      ) {

        return res.json({
          success: false,

          engine:
            ENGINE_VERSION,

          targetOdds,

          error:
            "No football markets were found."
        });
      }

      /*
        Run probability engine.
      */

      const result =
        runProbabilityEngine(
          scan.markets
