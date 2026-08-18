// Supabase 2.110 initializes its Realtime client eagerly. Node versions before
// 22 do not expose a native WebSocket, even when the application only uses
// Auth or PostgREST. Supplying a transport defers that failure unless server
// code actually tries to open a Realtime channel.
class ServerRealtimeUnavailable {
  constructor() {
    throw new Error("Supabase Realtime is unavailable in this server runtime.");
  }
}

export function realtimeOptionsForCurrentRuntime() {
  return typeof globalThis.WebSocket === "undefined"
    ? { transport: ServerRealtimeUnavailable as unknown as typeof WebSocket }
    : {};
}
