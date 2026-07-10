import type { Response } from "express";
import { logger } from "../logger";
import {
  type ActiveGeneration,
  type RunEvent,
  broadcastSse,
  writeSse,
} from "./runEvents";

const log = logger.child({ component: "sseManager" });
const ORPHAN_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Owns active-generation bookkeeping for the run endpoint: per-request
 * abort controllers, per-session generation state, SSE client sets, and
 * orphan timers that abort silent generations when every viewer disconnects.
 */
export class SseManager {
  private readonly activeRequests = new Map<
    string,
    { ownerUuid: string; controller: AbortController }
  >();
  private readonly activeBySession = new Map<string, ActiveGeneration>();

  registerRequest(
    requestId: string,
    ownerUuid: string,
    controller: AbortController,
  ): void {
    this.activeRequests.set(requestId, { ownerUuid, controller });
  }

  unregisterRequest(requestId: string): void {
    this.activeRequests.delete(requestId);
  }

  abortRequest(requestId: string, ownerUuid: string): boolean {
    const active = this.activeRequests.get(requestId);
    if (!active || active.ownerUuid !== ownerUuid) return false;
    active.controller.abort();
    this.activeRequests.delete(requestId);
    return true;
  }

  getActive(sessionId: string, ownerUuid: string): ActiveGeneration | null {
    const active = this.activeBySession.get(sessionId);
    return active?.ownerUuid === ownerUuid ? active : null;
  }

  /**
   * Open a new session-bound generation, replacing any in-flight one for
   * the same session. Returns the generation handle used to broadcast events.
   */
  openSessionGeneration(init: {
    requestId: string;
    sessionId: string;
    ownerUuid: string;
    abortController: AbortController;
    initialClient: Response;
  }): ActiveGeneration {
    const prev = this.activeBySession.get(init.sessionId);
    if (prev) {
      prev.abortController.abort();
      this.clearOrphanTimer(prev);
      for (const c of prev.clients) {
        try {
          c.end();
        } catch (err) {
          log.debug({ err }, "sse end prev client");
        }
      }
    }

    const gen: ActiveGeneration = {
      requestId: init.requestId,
      sessionId: init.sessionId,
      ownerUuid: init.ownerUuid,
      abortController: init.abortController,
      eventBuffer: [],
      clients: new Set([init.initialClient]),
      orphanTimer: null,
    };
    this.activeBySession.set(init.sessionId, gen);
    return gen;
  }

  /** Attach a late-joining SSE client to an existing generation. */
  attachClient(gen: ActiveGeneration, res: Response): void {
    gen.clients.add(res);
    this.clearOrphanTimer(gen);
  }

  removeClient(gen: ActiveGeneration, res: Response): void {
    gen.clients.delete(res);
    if (gen.clients.size === 0) this.startOrphanTimer(gen);
  }

  /** Send an event to every SSE client subscribed to a session generation. */
  broadcast(gen: ActiveGeneration, event: RunEvent): void {
    broadcastSse(gen, event);
  }

  /** Send an event to a single standalone (ephemeral) SSE response. */
  sendTo(res: Response, event: RunEvent): void {
    writeSse(res, event);
  }

  /** End the generation: close all clients, clear timers, drop bookkeeping. */
  closeSessionGeneration(gen: ActiveGeneration): void {
    this.clearOrphanTimer(gen);
    if (this.activeBySession.get(gen.sessionId) === gen) {
      this.activeBySession.delete(gen.sessionId);
    }
    for (const c of gen.clients) {
      try {
        c.end();
      } catch (err) {
        log.debug({ err }, "sse end client");
      }
    }
  }

  private startOrphanTimer(gen: ActiveGeneration): void {
    this.clearOrphanTimer(gen);
    gen.orphanTimer = setTimeout(() => {
      gen.abortController.abort();
    }, ORPHAN_TIMEOUT_MS);
  }

  private clearOrphanTimer(gen: ActiveGeneration): void {
    if (gen.orphanTimer) {
      clearTimeout(gen.orphanTimer);
      gen.orphanTimer = null;
    }
  }
}

export const sseManager = new SseManager();
