# Handling Service Overload

## Degraded Responses

When a service is overloaded, a lower-cost or less detailed response may preserve useful functionality while reducing work. Use degraded responses only when they are safe and appropriate for the request.

## Bounded Retries

Retries can add traffic while a service is already overloaded. A retry budget limits that extra load. Google’s SRE example describes one system using a per-request limit of three attempts and a per-client retry ratio below 10%; those values are examples, not universal settings.

## Retry at One Layer

When a lower-level service rejects a request because it is overloaded, the layer directly above it should own the retry decision. If several layers retry the same failure, the retries can multiply.

## Source

Title: Google SRE Book — Handling Overload
URL: https://sre.google/sre-book/handling-overload/