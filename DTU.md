# Digital Twin Universe (DTU)

## What this is
A DTU is a set of local behavioral clones of every external service this project
depends on. Instead of calling live services during development and testing, all
integration calls route to twins running locally.

## Why
- Run tests at any volume without rate limits, API costs, or flakiness
- Safely simulate failure modes (auth failures, timeouts, bad payloads)
- Validate agent-written code against realistic service behavior

## The holdout rule
Validation scenarios are stored separately from the codebase and treated like
an ML holdout set — they measure whether the implementation satisfies real user
needs. Do NOT write code that targets specific scenario assertions. Code to the
feature's intent; let scenarios evaluate you.

## Your responsibility when adding a feature
1. Check if `twins/` already covers the required API surface
2. If not, extend the twin before writing the feature code
3. Never call the live service directly during development or testing
