# SETU Bright Connection / Tally Convergence 

## CODE PACKET

### 1. Tally / ARTHA Canonical Payload Provenance Support
**Target Asset:** `backend/setu/bright_connection_connector.py`

This connector translates unstructured Bright Connection API / Tally hooks into standard unified canonical states. The `tally_provenance` is mapped to every payload explicitly preserving identity.

```python
    @classmethod
    def transform_field_visit_evidence(cls, raw_visit: Dict[str, Any], tally_provenance: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Transforms Bright Connection field visit evidence into Canonical MDU Evidence format"""
        result = {
            "mdu_type": "field_visit_evidence",
            "tenant_id": cls.TENANT_ID,
            "account_id": raw_visit.get("account_id") or raw_visit.get("tally_account_id"),
            "store_id": raw_visit.get("store_id") or raw_visit.get("tally_store_id"),
            "visit_id": raw_visit.get("visit_id") or f"VIS-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "route_id": raw_visit.get("route_id") or raw_visit.get("beat_id"),
            # ...
        }
        if tally_provenance:
            result["tally_provenance"] = tally_provenance
        return result
```


### 2. Mitra Account Context Bounded Queries
**Target Asset:** `backend-nodejs/src/services/mitraProductService.js`

To prevent cross-site multi-account payload pollution, the execution service binds to the `account_id` sent in contexts.

```javascript
export const createMongoSetuRepository = (context = {}) => ({
  async operationsSummary() {
    // ...
    const [activeProducts, lowStockProducts, totalOrders, orderStatuses] =
      await Promise.all([
        Product.countDocuments({ isActive: true }),
        Product.countDocuments(lowStockFilter),
        Order.countDocuments(context.account_id ? { customerId: context.account_id } : {}),
        Order.aggregate([
          ...(context.account_id ? [{ $match: { customerId: new mongoose.Types.ObjectId(context.account_id) } }] : []),
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
      ]);
    // ...
```
