// @layer: unit
// @spec: 008-backend-dx
// @regression
import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RealtimeEmitter } from "../../src/modules/realtime/realtime-emitter";

// ---------------------------------------------------------------------------
// Minimal socket.io Server stub
// ---------------------------------------------------------------------------

function makeServerStub() {
  const emitFn = vi.fn();
  const toBroadcastStub = { emit: emitFn };
  const toFn = vi.fn().mockReturnValue(toBroadcastStub);
  const fetchSocketsFn = vi.fn().mockResolvedValue([{}, {}]); // 2 sockets
  const inFn = vi.fn().mockReturnValue({ fetchSockets: fetchSocketsFn });
  return { to: toFn, in: inFn, fetchSocketsFn, toBroadcast: toBroadcastStub };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RealtimeEmitter", () => {
  let emitter: RealtimeEmitter;

  beforeEach(() => {
    emitter = new RealtimeEmitter();
  });

  // -------------------------------------------------------------------------
  // register()
  // -------------------------------------------------------------------------

  it("register — stores the server and does not throw", () => {
    const server = makeServerStub();
    expect(() => emitter.register("friends", server as any)).not.toThrow();
  });

  it("register — re-registering the same namespace logs a warn but does not crash", () => {
    const warnSpy = vi
      .spyOn((emitter as any).logger, "warn")
      .mockImplementation(() => {});
    const server = makeServerStub();
    emitter.register("friends", server as any);
    expect(() => emitter.register("friends", server as any)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("Re-registering");
  });

  // -------------------------------------------------------------------------
  // toRoom()
  // -------------------------------------------------------------------------

  it("toRoom — returns server.to(room) for a registered namespace", () => {
    const server = makeServerStub();
    emitter.register("play", server as any);
    const result = emitter.toRoom("play", "game:123");
    expect(server.to).toHaveBeenCalledWith("game:123");
    expect(result).toBe(server.toBroadcast);
  });

  it("toRoom — throws with explicit message for unknown namespace", () => {
    expect(() => emitter.toRoom("unknown-ns", "room:1")).toThrowError(
      /namespace 'unknown-ns' not registered/,
    );
  });

  // -------------------------------------------------------------------------
  // toUser()
  // -------------------------------------------------------------------------

  it("toUser — calls server.to('user:<id>') for a registered namespace", () => {
    const server = makeServerStub();
    emitter.register("friends", server as any);
    const result = emitter.toUser("user-42", "friends");
    expect(server.to).toHaveBeenCalledWith("user:user-42");
    expect(result).toBe(server.toBroadcast);
  });

  it("toUser — throws for unregistered namespace (delegates to toRoom)", () => {
    expect(() => emitter.toUser("user-1", "ghost-ns")).toThrowError(
      /namespace 'ghost-ns' not registered/,
    );
  });

  // -------------------------------------------------------------------------
  // socketCount()
  // -------------------------------------------------------------------------

  it("socketCount — sums fetchSockets() across ALL registered namespaces", async () => {
    const serverA = makeServerStub(); // fetchSockets returns [{}, {}] → 2
    const serverB = makeServerStub(); // fetchSockets returns [{}, {}] → 2
    emitter.register("friends", serverA as any);
    emitter.register("play", serverB as any);

    const count = await emitter.socketCount("user-7");

    expect(serverA.in).toHaveBeenCalledWith("user:user-7");
    expect(serverB.in).toHaveBeenCalledWith("user:user-7");
    expect(count).toBe(4); // 2 + 2
  });

  it("socketCount — returns 0 when no namespaces are registered", async () => {
    const count = await emitter.socketCount("nobody");
    expect(count).toBe(0);
  });

  it("socketCount — returns socket count from a single registered namespace", async () => {
    const server = makeServerStub(); // 2 sockets
    emitter.register("play", server as any);
    const count = await emitter.socketCount("user-99");
    expect(count).toBe(2);
  });
});
