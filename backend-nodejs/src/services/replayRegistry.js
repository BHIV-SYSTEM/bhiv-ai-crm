import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const STATE_DIR = path.join(process.cwd(), '.phase2-state');
const STATE_FILE = path.join(STATE_DIR, 'replay_registry.json');

/**
 * In-memory mirror of the on-disk registry.
 *
 * Replay protection must never be taken out by the filesystem: a read-only
 * container, a full disk or a corrupt state file would otherwise throw out of
 * every register/load call and disable duplicate detection entirely. When the
 * disk is unusable we keep serving from memory and warn once, instead of
 * failing the request.
 */
let memoryState = { registry: [], replay_history: [] };
let diskHealthy = true;
let warnedAboutDisk = false;

const cloneState = (data) => JSON.parse(JSON.stringify(data || memoryState));

const degradeToMemory = (operation, err) => {
    diskHealthy = false;
    if (!warnedAboutDisk) {
        warnedAboutDisk = true;
        console.warn(
            `[ReplayRegistry] ${operation} failed (${err?.code || err?.name || 'Error'}: ${err?.message}). ` +
            `Continuing with in-process replay state at ${STATE_FILE}; ` +
            'state will NOT be shared across instances.'
        );
    }
};

const emptyState = () => ({ registry: [], replay_history: [] });

export class ReplayRegistry {
    static async ensureStateFile() {
        try {
            fs.mkdirSync(STATE_DIR, { recursive: true });
            if (!fs.existsSync(STATE_FILE)) {
                fs.writeFileSync(STATE_FILE, JSON.stringify(emptyState(), null, 2));
            }
            diskHealthy = true;
        } catch (err) {
            degradeToMemory('ensureStateFile', err);
        }
    }

    static buildIntegrityHash(record) {
        const canonical = {
            tenant_id: record.tenant_id,
            trace_id: record.trace_id,
            entity_id: record.entity_id,
            source_connector: record.source_connector,
            schema_version: record.schema_version,
            idempotency_key: record.idempotency_key,
            payload: record.payload,
        };
        return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
    }

    static async loadRegistry() {
        try {
            await this.ensureStateFile();
            const raw = fs.readFileSync(STATE_FILE, 'utf8');
            const parsed = JSON.parse(raw || '{"registry":[],"replay_history":[]}');
            const state = {
                registry: Array.isArray(parsed.registry) ? parsed.registry : [],
                replay_history: Array.isArray(parsed.replay_history) ? parsed.replay_history : [],
            };
            memoryState = cloneState(state);
            diskHealthy = true;
            return cloneState(state);
        } catch (err) {
            // Missing, unreadable or corrupt state file: fall back to memory
            // rather than letting replay protection throw.
            degradeToMemory('loadRegistry', err);
            return cloneState(memoryState);
        }
    }

    static async persistRegistry(data) {
        memoryState = cloneState(data);
        try {
            await this.ensureStateFile();
            if (!diskHealthy) {
                throw new Error('state directory unavailable');
            }
            fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
            diskHealthy = true;
            return true;
        } catch (err) {
            degradeToMemory('persistRegistry', err);
            return false;
        }
    }

    static async registerCanonicalRecord(record) {
        const registryState = await this.loadRegistry();
        const integrity_hash = this.buildIntegrityHash(record);
        const existing = registryState.registry.find((entry) => entry.idempotency_key === record.idempotency_key || entry.trace_id === record.trace_id);

        if (existing) {
            const duplicateEntry = {
                ...existing,
                duplicate: true,
                integrity_hash,
                replayed_at: new Date().toISOString(),
            };
            return { ...duplicateEntry, duplicate: true, persisted_to_disk: diskHealthy };
        }

        const entry = {
            tenant_id: record.tenant_id,
            trace_id: record.trace_id,
            entity_id: record.entity_id,
            source_connector: record.source_connector,
            schema_version: record.schema_version,
            idempotency_key: record.idempotency_key,
            integrity_hash,
            payload: record.payload,
            created_at: new Date().toISOString(),
            duplicate: false,
        };

        registryState.registry.push(entry);
        const persisted = await this.persistRegistry(registryState);

        return { ...entry, persisted_to_disk: persisted };
    }

    static async registerReplayExecution(traceId, replayName) {
        const registryState = await this.loadRegistry();
        const original = registryState.registry.find((entry) => entry.trace_id === traceId);

        if (!original) {
            throw new Error(`No original ingestion found for trace_id: ${traceId}`);
        }

        const replayEntry = {
            replay_name: replayName,
            trace_id: traceId,
            tenant_id: original.tenant_id,
            integrity_hash: original.integrity_hash,
            original_ingestion_present: true,
            replay_registered: true,
            duplicate_guard: false,
            replayed_at: new Date().toISOString(),
        };

        registryState.replay_history.push(replayEntry);
        await this.persistRegistry(registryState);
        return replayEntry;
    }

    static async getRegistry() {
        const state = await this.loadRegistry();
        return {
            registry: cloneState(state.registry),
            replay_history: cloneState(state.replay_history),
            storage: diskHealthy ? 'disk' : 'memory',
        };
    }
}

export default ReplayRegistry;
