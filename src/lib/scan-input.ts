const QR_PATTERN = /SKA\.[^.\s]+\.[0-9a-f]{32}/gi;
const COMPLETE_QR = /^SKA\.[^.\s]+\.[0-9a-f]{32}$/i;

export function isCompleteSantriQr(value: string) {
  return COMPLETE_QR.test(value);
}

/** Consume every complete frame, preserving only an unfinished next scan. */
export function consumeScannerInput(value: string, terminated = false) {
  const frames = [...value.matchAll(QR_PATTERN)];
  const last = frames.at(-1);
  const remainder = last ? value.slice(last.index! + last[0].length) : value;
  return {
    payloads: frames.map((frame) => frame[0]),
    remainder: terminated ? "" : remainder.slice(-512),
    incomplete: terminated && remainder.trim().length > 0,
  };
}

/** Pending requests stay deduplicated even when the network takes over 3s. */
export class ScanDeduplicator {
  private pending = new Set<string>();
  private recent = new Map<string, number>();

  get pendingCount() { return this.pending.size; }

  accept(sessionId: string, payload: string, now = Date.now()) {
    for (const [key, at] of this.recent) {
      if (now - at >= 3_000) this.recent.delete(key);
    }
    const key = JSON.stringify([sessionId, payload]);
    if (this.pending.has(key) || this.recent.has(key)) return false;
    this.pending.add(key);
    return true;
  }

  finish(sessionId: string, payload: string, confirmed: boolean, now = Date.now()) {
    const key = JSON.stringify([sessionId, payload]);
    this.pending.delete(key);
    if (confirmed) this.recent.set(key, now);
    else this.recent.delete(key); // A failed request can be retried immediately.
  }
}
