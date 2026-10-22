function hasBackendBase(flags) {
  return Boolean(flags?.useBackendAdapter && flags?.backendBaseUrl);
}

export function createAppRepository({ localAdapter, backendAdapter, syncQueue = null, flags, onSyncError = console.warn }) {
  const canUseBackend = hasBackendBase(flags) && backendAdapter;
  const canReadBackend = Boolean(canUseBackend && flags.backendReadEnabled);
  const canWriteBackend = Boolean(canUseBackend && flags.backendWriteEnabled);

  async function handleBackendError(error, operation, resource, value) {
    onSyncError?.(error, { operation, resource });
    if (!flags.fallbackToLocalOnBackendError) throw error;
    if (syncQueue && flags.queueFailedBackendWrites && ['set', 'remove'].includes(operation)) {
      await syncQueue.enqueue({ resource, operation, value, lastError: error.message || String(error) });
    }
  }

  return {
    get modeLabel() {
      if (!canUseBackend) return 'Local storage';
      if (canReadBackend && canWriteBackend) return 'Backend read/write';
      if (canReadBackend) return 'Backend read, local write';
      if (canWriteBackend) return 'Local read, backend write';
      return 'Backend configured, disabled';
    },

    async get(resource, fallback = null) {
      if (canReadBackend) {
        try {
          const value = await backendAdapter.get(resource, fallback);
          if (flags.mirrorBackendWritesToLocal && value !== fallback) await localAdapter.set(resource, value);
          return value;
        } catch (error) {
          await handleBackendError(error, 'get', resource);
        }
      }
      return localAdapter.get(resource, fallback);
    },

    async set(resource, value) {
      if (canWriteBackend) {
        try {
          const saved = await backendAdapter.set(resource, value);
          if (flags.mirrorBackendWritesToLocal) await localAdapter.set(resource, saved ?? value);
          return saved ?? value;
        } catch (error) {
          await handleBackendError(error, 'set', resource, value);
        }
      }
      return localAdapter.set(resource, value);
    },

    async remove(resource) {
      if (canWriteBackend) {
        try {
          await backendAdapter.remove(resource);
          if (flags.mirrorBackendWritesToLocal) await localAdapter.remove(resource);
          return;
        } catch (error) {
          await handleBackendError(error, 'remove', resource);
        }
      }
      return localAdapter.remove(resource);
    },

    async pendingSync() {
      return syncQueue ? syncQueue.list() : [];
    },

    async clearPendingSync() {
      return syncQueue ? syncQueue.clear() : [];
    },

    async flushPendingSync() {
      if (!syncQueue) return { flushed: 0, remaining: 0 };
      const queue = await syncQueue.list();
      if (!queue.length) return { flushed: 0, remaining: 0 };
      if (!canWriteBackend) return { flushed: 0, remaining: queue.length, skipped: 'Backend writes are disabled.' };

      const remaining = [];
      let flushed = 0;

      for (const item of queue) {
        try {
          if (item.operation === 'set') await backendAdapter.set(item.resource, item.value);
          if (item.operation === 'remove') await backendAdapter.remove(item.resource);
          flushed += 1;
        } catch (error) {
          remaining.push({
            ...item,
            attempts: (item.attempts || 0) + 1,
            lastError: error.message || String(error)
          });
        }
      }

      await syncQueue.replace(remaining);
      return { flushed, remaining: remaining.length };
    }
  };
}
