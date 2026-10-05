# Canary Releases

## What a Canary Is
A canary is a partial, time-limited deployment of a change. The team evaluates it before deciding whether to continue the rollout. The changed portion is the canary; the unchanged portion is the control.

## Canary Process
A canary process needs a way to send a subset of production traffic to the change, an evaluation that classifies the change as acceptable or problematic, and a way to use that evaluation in the release process.

## Compare Canary and Control
Break metrics down by canary and control. Whole-service metrics can hide a problem when only a small share of traffic reaches the new version.

## Choose Evaluation Metrics
Start with indicators that reflect user impact, such as request errors and latency. Keep the evaluation focused on a manageable set of meaningful metrics; noisy or weakly related signals can create false alarms.

## Decide Whether to Continue
If the canary performs worse than the control on important signals, pause the rollout and investigate or roll it back. If the signals are acceptably similar, continue according to the release process.

## Choose Size and Duration
The canary should receive enough representative traffic and run long enough for relevant problems to appear. Consider request diversity, traffic volume, time of day, and how quickly the service changes.

## Match Metric Windows to the Canary
Use evaluation metrics whose measurement intervals are no longer than the canary duration. A longer aggregation window can mix unrelated events into the comparison.

Source: https://sre.google/workbook/canarying-releases/