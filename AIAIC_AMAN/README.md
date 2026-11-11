# AIAIC Aman - Data-Source and Integration Inventory

**Owner:** Aman Pal  
**Handover target:** Hemanth  
**Review date:** 2026-08-22  
**Evidence rule:** repository inspection only; no production access is claimed.

## Purpose

This package inventories external and internal systems that AIAIC may consume, reference, integrate with, or deliberately avoid duplicating. It separates source existence, authority, access, integration evidence, and portability. A public website, configuration variable, or code reference is not treated as permission or live connectivity.

## Scope and counts

The inventory contains **14 source/system entries**. Counts below use the primary classification column:

- `COMMON_REUSABLE`: 3
- `STATE_ADAPTER`: 0 confirmed; no Madhya Pradesh assumption is encoded
- `ACCESS_UNVERIFIED`: 7
- `KNOWN_UNKNOWN`: 2
- `DO_NOT_DUPLICATE`: 2

These classifications are intentionally conservative. Some entries have secondary tags in the `tags` column. Access is confirmed only where the repository contains an evidenced runtime boundary; no external production access was independently verified in this review.

## What is evidenced

- The product repo contains Python/FastAPI and Node/Express backends, a React frontend, SETU modules, MongoDB connection code, and integration adapters.
- The frontend calls the workflow-blackhole production API directly for one Infiverse view.
- SETU contains a Niyantran adapter and a Bucket lineage adapter.
- SETU is contract-compatible with Sampada, but no direct outbound Sampada call was found.
- Google Maps, Office 365, and LLM integrations are represented in the Python backend.
- Tally provenance is represented in the existing SETU signal path, but the upstream Tally/Artha runtime and permission to use its data remain unverified.

## Main blockers

1. Production credentials and permissions for external systems are not independently evidenced.
2. Actual AIAIC ownership, source contracts, retention rules, and lawful-use approvals are not defined in this repository.
3. The source owner must confirm which systems may be consumed versus merely referenced.
4. The shared MongoDB schema boundary between the two backends requires an explicit authority decision before AIAIC writes canonical data.
5. The workflow-blackhole production URL is referenced, while one Python proxy configuration is documented as localhost; deployment configuration must be confirmed.

## Inputs required from other AIAIC workstreams

- **Shivam:** minimum geospatial, crop, and water fields and acceptable source evidence.
- **Aryan:** state adapter configuration and replacement-source rules.
- **Kaushlendra:** source requirements for priority farmer-income use cases.
- **Riddhi:** workflow and UX fields that must be visible to users.
- **Nupur:** provenance, evidence, retention, and canonical schema requirements.
- **Ankita:** Core/Adapter/Deployment classification decisions.
- **Sakshi:** government-system authority and consumption boundaries.
- **Hemanth:** consolidation into the master AIAIC Capability Map.

## Files

- `data_source_inventory.csv` - authoritative source register
- `access_dependency_register.csv` - unresolved access and permission dependencies
- `source_reuse_matrix.csv` - portability and adapter analysis
- `integration_surface_map.md` - boundary and flow map
- `unresolved_sources.md` - explicit unknowns and resolution questions
- `handover.md` - operating handover and review checklist

## Evidence limitations

This is a pre-implementation inventory. It does not prove that any external system is reachable, that an account has permission to use data, or that an integration is production-ready. No secrets are included.
