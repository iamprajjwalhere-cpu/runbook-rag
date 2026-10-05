# Incident Response and Coordination

Source: https://sre.google/sre-book/managing-incidents/

## Response priorities

During an incident, prioritize reducing ongoing user impact and restoring service. Preserve useful evidence so the team can investigate the cause after service is stable.

## Separate response responsibilities

A clear incident structure assigns coordination, operational work, and communication to specific people. The structure can expand as the incident grows.

### Incident commander

The incident commander keeps the overall response coordinated, maintains a shared picture of the incident, and assigns responsibilities. They help remove blockers so responders can focus on their tasks.

### Operations lead

The operations lead coordinates technical mitigation and recovery. The operations team should be the group making changes to the affected production system during the incident.

### Communications lead

The communications lead provides regular updates to responders and stakeholders, handles incoming questions, and keeps the incident record current.

### Planning support

For a larger incident, planning support can track longer-running work, resource needs, handoffs, and follow-up actions.

## Maintain a shared incident record

Keep a live record of the current impact, known facts, decisions, actions, and owners. It helps responders coordinate and provides material for later review.

## Make handoffs explicit

When incident command changes, brief the incoming commander and get clear acknowledgment before the outgoing commander steps away.