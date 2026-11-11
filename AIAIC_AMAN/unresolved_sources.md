# Unresolved Sources and Decisions

This file is intentionally explicit about what is not known. No item below is marked resolved without evidence.

## Highest-priority unknowns

### 1. Tally and Artha ownership boundary

The existing product documentation describes Tally provenance and an upstream Artha path, but this repository does not prove the live Artha endpoint, payload contract, tenant permissions, or whether AIAIC should consume Artha output or only reference it. Confirm the owner, approved fields, source IDs, sync behavior, and safe-payload policy.

### 2. Government agricultural source list

The task names geospatial, crop, water, farmer-income, and government workflows, but no concrete government source was found in the reviewed repository. Shivam, Sakshi, Aryan, and Kaushlendra must provide named sources, authorities, access method, legal basis, schema, refresh behavior, and replacement source for another state.

### 3. MongoDB and canonical data authority

Both product backends use a shared MongoDB database, while their product schemas differ. AIAIC must not write into those collections until the canonical writer, collection boundary, schema version, and MDU/provenance authority are confirmed.

### 4. Niyantran production configuration

The product has code-level Niyantran integration and a frontend production URL reference, while the Python proxy configuration is documented as potentially pointing at localhost. The deployment owner must confirm the authoritative URL, authentication, environment, and health check.

### 5. Sampada and Bucket contracts

Sampada is described as contract-compatible and Bucket has an adapter, but their live URLs, versions, credentials, response schemas, and permissions are not evidenced here.

## Evidence interpretation

- `code-verified`: code or configuration references a boundary; it does not prove live availability.
- `config-verified-not-live`: configuration exists, but the service was not reached or authenticated.
- `static-reference-only`: documentation or history references a source without a live route.
- `not-reviewed`: the source was required by the AIAIC brief but no concrete repository evidence was available.

## Do not infer

Do not infer source access from a public website, a policy mention, a URL, a credential variable name, a successful local test, or a synthetic fixture. Do not infer a state-specific source is reusable nationally. Do not infer that a source's data can be copied into AIAIC merely because it is useful.

## Resolution record format

When a dependency is resolved, record:

- source and authority owner
- evidence link or approved secure confirmation
- access method and permitted fields
- integration contract and version
- refresh/event behavior
- retention and provenance rules
- state portability and replacement source
- approving owner and date
