import type { Response } from "express";
import { logger } from "../logger";
import {
  type ActiveGeneration,
  type RunEvent,
  broadcastSse,
  writeSse,
} from "./runEvents";

const log = logger.child({ component: "sseManager" });

/**
 * Owns active-generation bookkeeping for the run endpoint: per-request
 * abort controllers, per-session generation state, and SSE client sets.
 * A generation belongs to the server, not to an SSE connection: disconnecting
 * every viewer leaves the work running so an installed app can be closed and
 * later reconnect to it.
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
    };
    this.activeBySession.set(init.sessionId, gen);
    return gen;
  }

  /** Attach a late-joining SSE client to an existing generation. */
  attachClient(gen: ActiveGeneration, res: Response): void {
    gen.clients.add(res);
  }

  removeClient(gen: ActiveGeneration, res: Response): void {
    gen.clients.delete(res);
  }

  /** Send an event to every SSE client subscribed to a session generation. */
  broadcast(gen: ActiveGeneration, event: RunEvent): void {
    broadcastSse(gen, event);
  }

  /** Send an event to a single standalone (ephemeral) SSE response. */
  sendTo(res: Response, event: RunEvent): void {
    writeSse(res, event);
  }

  /** End the generation: close all clients and drop its live bookkeeping. */
  closeSessionGeneration(gen: ActiveGeneration): void {
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
}

export const sseManager = new SseManager();
