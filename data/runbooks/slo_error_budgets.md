# SLOs and Error Budgets

## Service Level Objectives
A service level objective (SLO) is a target for a user-relevant aspect of service reliability. Teams use SLOs to make informed reliability and product decisions.

## Service Level Indicators
A service level indicator (SLI) measures a user-relevant outcome. A common form is the ratio of good events to total events, such as successful requests divided by all requests.

## Choosing What to Measure
Start with the service and its users. Identify important user journeys, then choose a small set of measurable indicators that represent the most important aspects of the service. Refine the indicators and targets as you learn.

## Error Budgets
An error budget is the portion of unreliability allowed by an SLO. For a percentage-based SLO, it is 100% minus the SLO. For example, a 99.9% SLO leaves a 0.1% error budget.

## Example Policy: Budget Exhaustion
One published Google SRE example policy pauses most changes and releases when the service exceeds its error budget over a four-week window. It allows P0 issues and security fixes to proceed. This is an example policy, not a universal default.

## Example Policy: Large Incidents
The same example policy calls for a postmortem when one incident consumes more than 20% of the four-week error budget. This threshold is specific to that example policy, not a universal rule.

Source: https://sre.google/workbook/implementing-slos/
Policy example: https://sre.google/workbook/error-budget-policy/