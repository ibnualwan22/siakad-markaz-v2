export type SessionStatus = "DRAFT" | "BUKA" | "TUTUP";

export type SessionTiming = {
  id: string;
  status: SessionStatus;
  rencanaTutupAt: string | null;
  ditutupAt: string | null;
};

export type PresentationTimeline = {
  id: string;
  status: SessionStatus;
  openingUntil: number;
  announcementAt: number;
  manual: boolean;
  liveClosure: boolean;
};

export type Presentation = {
  mode: "waiting" | "opening" | "voting" | "countdown" | "sealing" | "result";
  seconds: number | null;
  manual: boolean;
  celebrate: boolean;
};

// Presentation delays never change the server's voting cutoff. Manual closure
// stops voting immediately; its five seconds are only for the announcement.
export function receiveSession(
  previous: PresentationTimeline | null,
  session: SessionTiming,
  receivedAt: number,
  serverOffset: number,
): PresentationTimeline {
  if (!previous || previous.id !== session.id) {
    return { id: session.id, status: session.status, openingUntil: 0, announcementAt: 0, manual: false, liveClosure: false };
  }
  if (previous.status === session.status) return previous;
  if (session.status === "BUKA") {
    return { ...previous, status: session.status, openingUntil: receivedAt + 2_800 };
  }
  if (session.status === "TUTUP") {
    const deadline = session.rencanaTutupAt ? Date.parse(session.rencanaTutupAt) : NaN;
    const closedAt = session.ditutupAt ? Date.parse(session.ditutupAt) : NaN;
    // The server records the exact deadline for automatic closure. An earlier
    // ditutupAt (or no deadline) identifies a manual closure without new storage.
    const manual = !Number.isFinite(deadline) || closedAt < deadline;
    return {
      ...previous,
      status: session.status,
      manual,
      liveClosure: true,
      announcementAt: manual ? receivedAt + 5_000 : Math.max(receivedAt, deadline - serverOffset + 1_800),
    };
  }
  return { ...previous, status: session.status, openingUntil: 0, announcementAt: 0, liveClosure: false };
}

export function presentSession(
  session: SessionTiming,
  timeline: PresentationTimeline | null,
  now: number,
  serverOffset: number,
): Presentation {
  const base = { seconds: null, manual: false, celebrate: false };
  if (session.status === "DRAFT") return { ...base, mode: "waiting" };
  if (session.status === "TUTUP") {
    const remaining = (timeline?.announcementAt ?? 0) - now;
    if (remaining > 0) {
      return timeline?.manual
        ? { ...base, mode: "countdown", manual: true, seconds: Math.ceil(remaining / 1_000) }
        : { ...base, mode: "sealing" };
    }
    return { ...base, mode: "result", celebrate: Boolean(timeline?.liveClosure && now < timeline.announcementAt + 5_000) };
  }
  const remaining = session.rencanaTutupAt ? Date.parse(session.rencanaTutupAt) - now - serverOffset : Infinity;
  if (remaining <= 0) return { ...base, mode: "sealing" };
  if (remaining <= 5_000) return { ...base, mode: "countdown", seconds: Math.ceil(remaining / 1_000) };
  return { ...base, mode: timeline && now < timeline.openingUntil ? "opening" : "voting" };
}
