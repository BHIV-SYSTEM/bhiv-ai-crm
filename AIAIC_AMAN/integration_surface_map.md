# AIAIC Integration Surface Map

**Status:** Pre-implementation boundary map  
**Owner:** Aman Pal  
**Evidence basis:** `handover/02_ARCHITECTURE_GUIDE.md`, `handover/09_DEPENDENCY_MAP.md`, `handover/05_DATABASE_GUIDE.md`, and inspected source files.

## Target shape

```text
External source or service
        |
        v
Approved connector / state adapter / reference adapter
        |
        v
AIAIC canonical data boundary
  - source identity
  - authority identity
  - tenant or jurisdiction context
  - evidence and permission status
        |
        v
Reusable intelligence capability
  - geospatial
  - crop / water
  - farmer-income
  - workflow or product capability
```

AIAIC must consume permitted inputs and preserve provenance. It must not become the master system for accounting, government registries, workflow execution, maps, office data, or external model output.

## Mapped surfaces

| External system                | Boundary                                                                  | Relationship                                 | Current evidence                                                                                   | AIAIC constraint                                            |
| ------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Tally via Artha                | Tally/Artha output -> approved source adapter -> canonical source record  | Consume or reference only after confirmation | Tally provenance is represented in the product history, but upstream live access is not proven     | No invented company/store context; preserve source identity |
| workflow-blackhole / Niyantran | External workflow API -> Niyantran adapter -> workflow status context     | Integrate                                    | Product contains direct frontend and SETU adapter paths; production behavior is not fully verified | Do not recreate workflow authority                          |
| Sampada                        | Sampada gateway -> contract adapter -> SETU/AIAIC signal boundary         | Integrate if approved                        | Contract compatibility is documented; no direct call was found                                     | Contract and permission required                            |
| Bucket                         | Bucket verification -> lineage adapter -> evidence context                | Reference or integrate                       | SETU adapter code exists; external endpoint is unknown                                             | Bucket remains verification authority                       |
| Google Maps                    | Maps API -> geospatial adapter -> normalized location result              | Consume                                      | Python integration code exists; live key and access are unverified                                 | Store provider response provenance and quota policy         |
| Office 365                     | Office API -> workflow adapter -> approved fields                         | Integrate                                    | Configuration is documented; live consent is unverified                                            | Tenant consent and field minimization required              |
| LLM provider                   | Provider -> bounded query adapter -> derived insight with provenance      | Consume                                      | Code references exist; live provider and policy are unverified                                     | Model output is not authoritative source data               |
| Government sources             | Government API/download -> state adapter -> canonical agricultural record | Reference or consume after approval          | No concrete source was evidenced in this repository                                                | Authority, permission, schema and refresh must be recorded  |

## Boundary rules

1. **Existence is not access.** A code reference or public portal does not prove permission.
2. **Access is not integration.** Credentials or a reachable endpoint do not prove a stable contract.
3. **Integration is not authority transfer.** The external owner remains authoritative.
4. **State adapters are replaceable.** AIAIC capability contracts must not encode Madhya Pradesh-specific fields as universal fields.
5. **Canonical writes require approval.** AIAIC must use the approved MDU/data boundary rather than writing directly into an external system's collections.
6. **Every accepted source record needs provenance.** At minimum: source system, authority, source record identity, received time, and evidence/access status.
