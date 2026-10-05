# Monitoring a User-Facing Service

## Four Monitoring Signals

For a user-facing service, monitor latency, traffic, errors, and saturation. These show how long requests take, how much demand arrives, how much work fails, and how constrained the service's resources are.

## Latency and Errors

Measure latency for successful and failed requests separately. A failed request can return quickly, making overall latency look better even while users are experiencing errors.

## Saturation

Track the resource most likely to constrain this service. Performance can degrade before a resource reaches its maximum capacity, so use a relevant operating target or early-warning level.

## Source

Title: Google SRE Book — Monitoring Distributed Systems
URL: https://sre.google/sre-book/monitoring-distributed-systems/