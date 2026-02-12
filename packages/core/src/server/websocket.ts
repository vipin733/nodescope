import type { Entry } from '../types.js';

interface WebSocketClient {
  send: (data: string) => void;
  readyState: number;
}

interface RealTimeServerOptions {
  heartbeatInterval?: number;
}

/**
 * WebSocket server for real-time updates
 */
export class RealTimeServer {
  private clients: Set<WebSocketClient> = new Set();
  private heartbeatInterval?: NodeJS.Timeout;
  private readonly heartbeatMs: number;

  constructor(options: RealTimeServerOptions = {}) {
    this.heartbeatMs = options.heartbeatInterval ?? 30000;
  }

  /**
   * Handle a new WebSocket connection
   */
  handleConnection(ws: WebSocketClient): void {
    this.clients.add(ws);

    // Send welcome message
    this.sendTo(ws, {
      type: 'connected',
      clients: this.clients.size,
    });
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnection(ws: WebSocketClient): void {
    this.clients.delete(ws);
  }

  /**
   * Broadcast a new entry to all connected clients
   */
  broadcastEntry(entry: Entry): void {
    this.broadcast({
      type: 'entry',
      data: entry,
    });
  }

  /**
   * Broadcast stats update to all clients
   */
  broadcastStats(stats: Record<string, unknown>): void {
    this.broadcast({
      type: 'stats',
      data: stats,
    });
  }

  /**
   * Start heartbeat to keep connections alive
   */
  startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      this.broadcast({ type: 'ping', timestamp: Date.now() });
    }, this.heartbeatMs);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  /**
   * Get number of connected clients
   */
  get clientCount(): number {
    return this.clients.size;
  }

  private broadcast(message: Record<string, unknown>): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === 1) { // OPEN
        try {
          client.send(data);
        } catch {
          // Client disconnected, will be cleaned up
          this.clients.delete(client);
        }
      }
    }
  }

  private sendTo(ws: WebSocketClient, message: Record<string, unknown>): void {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }
}
