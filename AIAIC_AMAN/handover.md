# AIAIC Aman Handover

**Handover target:** Hemanth  
**Owner:** Aman Pal  
**Deliverable:** AIAIC Data-Source and Integration Inventory

## What this package does

This package establishes the pre-implementation inventory boundary. It records what systems are visible in the current repository, what they may provide, who remains authoritative, whether access is evidenced, and which dependencies must be resolved before implementation.

It does not create connectors, call external APIs, copy external datasets, or claim production access.

## Files and how to use them

- `data_source_inventory.csv`: start here for one row per source/system and its primary classification.
- `access_dependency_register.csv`: use this as the action list for every unverified source.
- `source_reuse_matrix.csv`: use this when deciding whether a capability is reusable across states.
- `integration_surface_map.md`: use this to preserve external authority and canonical boundaries.
- `unresolved_sources.md`: use this before accepting any assumption as evidence.
- `README.md`: summary, counts, blockers, and cross-workstream inputs.

## Classification rules

- `COMMON_REUSABLE`: source or service can conceptually support more than one state or product context.
- `STATE_ADAPTER`: source or configuration is expected to vary by state; no confirmed MP-specific source is asserted here.
- `ACCESS_UNVERIFIED`: source is referenced or potentially useful, but access, permission, or live integration is not proven.
- `KNOWN_UNKNOWN`: the task requires this source domain, but no concrete source/contract was identified.
- `DO_NOT_DUPLICATE`: an existing authoritative system must remain authoritative; AIAIC may reference or integrate through an approved boundary.

The primary classification is deliberately conservative. Review secondary tags and the access columns separately.

## Required review owners

- Shivam: geospatial, crop, and water inputs.
- Aryan: state adapters and replacement configuration.
- Kaushlendra: farmer-income source requirements.
- Riddhi: product workflow and UX dependencies.
- Nupur: provenance, evidence, and canonical data rules.
- Ankita: Core/Adapter/Deployment placement.
- Sakshi: government authority and non-duplication boundaries.
- Hemanth: consolidated AIAIC Capability Map.

## Before implementation begins

1. Confirm named authoritative sources for each AIAIC capability.
2. Obtain approved access and permission evidence through secure channels.
3. Agree the canonical input envelope and provenance fields with Nupur.
4. Define state adapter contracts without adding MP assumptions to reusable capability models.
5. Confirm whether AIAIC consumes, integrates, references, or avoids each source.
6. Resolve the shared MongoDB writer/schema boundary before any canonical persistence work.
7. Re-run the six tests from the assignment for every source entry.

## Six-entry test checklist

For each row, answer:

1. Does the source exist, with evidence?
2. Who is the authoritative owner?
3. Is access confirmed, possible, unknown, or restricted?
4. Is there an evidenced integration route or only an assumption?
5. Can the capability survive replacement in another state?
6. Would AIAIC duplicate an authoritative system?

## Known limitations

This inventory was produced from the repository and its existing documentation. It does not establish live availability, legal permission, production credentials, current refresh rates, or customer-specific data agreements. The next owner must update the CSV rows with approved evidence rather than changing unknown values optimistically.
