import { EventEmitter } from 'events';

export class SwarmClient extends EventEmitter {
  swarmHost: string;
  encoding: string;

  state: string;
  socket: WebSocket;
  heartbeatInterval: number;
  heartbeat: any;
  seq: number;

  constructor(swarmHost, encoding) {
    super();

    this.swarmHost = swarmHost || "wss://swarm.hiven.io";
    this.encoding = encoding || "etf";

    this.state = "not_connected";
    this.socket = null;
    this.heartbeatInterval = null;
    this.heartbeat = null;
    this.seq = 0;
  }

  connect() {
    const socket = new WebSocket(`${this.swarmHost}/socket?encoding=${this.encoding}`);

    this.socket = socket;
    this.state = "connecting";
    
    this.emit("SOCKET_STATE_CHANGE", "connecting");

    socket.addEventListener('open', (event) => {
      this.state = "tcp_connected";

      this.emit("SOCKET_STATE_CHANGE", "tcp_connected");
    });

    socket.addEventListener('message', (event) => {
      const encoded = event.data;
      const decoded = this.encoding === "json" ? JSON.parse(encoded) : encoded;

      this.seq = decoded.seq;
      
      switch (decoded.op) {
        case 0:
          this.emit("HIVEN_EVENT", {type: decoded.e, data: decoded.d});
          break;
        case 1:
          this.heartbeatInterval = decoded.d.hbt_int;
          this.startHeartbeating();

          this.state = "connected";
          this.emit("SOCKET_STATE_CHANGE", "connected");
          
          break;
        default:
          console.error("Swarm received unknown opcode")
      }
    });

    socket.addEventListener('close', (event) => {
      this.state = "closed";
      this.emit("SOCKET_STATE_CHANGE", "closed");
    });
  }

  sendRaw(data) {
    const encoded = JSON.stringify(data);

    this.socket.send(encoded);
  }

  startHeartbeating() {
    this.heartbeat = setInterval(() => {
      if(this.state !== "connected") {
        clearInterval(this.heartbeat);
        return;
      }

      this.sendRaw({"op": 3});
    }, this.heartbeatInterval || 30000);
  }

  identify(token) {
    this.sendRaw({"op": 2, "d": {"token": token}});
  }
}