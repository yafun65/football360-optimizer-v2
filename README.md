# Football 360 Optimizer V2

A probability-based football market optimizer for Football 360.

## Purpose

Football 360 Optimizer V2 scans available football markets from the existing SportyBet API, scores markets using probability, filters weak selections, and builds combinations toward a requested target odds.

## Architecture

SportyBet API
        ↓
Football 360 Optimizer V2
        ↓
Probability Engine
        ↓
Market Filtering
        ↓
Target Odds Optimizer
        ↓
Telegram Bot

## Current Strategy

V2 uses probability as the primary selection signal.

It does NOT currently use:

- Conservative strategy
- Balanced strategy
- Aggressive strategy
- Gemini AI

Those features can be added later after the core optimizer is stable.

## Existing SportyBet API

The optimizer uses the existing SportyBet API:

https://sportybet-api.onrender.com

The existing API remains separate from this project.

## Main Files

### server.js

Express server and API routes.

### probabilityEngine.js

Probability scoring and target-odds combination logic.

### package.json

Node.js dependencies and start command.

## Development

Install dependencies:

npm install

Start the server:

npm start

## Environment Variables

Optional:

SPORTYBET_API_BASE

MIN_PROBABILITY

MIN_ODDS

MAX_ODDS

## Important

This project is an analysis and optimization tool. Probability scores are estimates derived from available market information and are not guarantees of outcomes.
