import { EventEmitter } from 'events';
import {inflate} from 'pako';

export enum DecompressionStrategy {
  ZlibJson = 'zlib_json',
  TextJson = 'text_json'
}

export class SwarmClient extends EventEmitter {
  swarmHost: string;
  encoding: string;
  compression: DecompressionStrategy;

  state: string;
  socket: WebSocket;
  heartbeatInterval: number;
  heartbeat: any;
  seq: number;

  constructor(swarmHost, encoding, compression) {
    super();

    this.swarmHost = swarmHost || "wss://swarm.hiven.io";
    this.encoding = encoding || "json";
    this.compression = compression || DecompressionStrategy.ZlibJson;

    this.state = "not_connected";
    this.socket = null;
    this.heartbeatInterval = null;
    this.heartbeat = null;
    this.seq = 0;
  }

  connect() {
    const socket = new WebSocket(`${this.swarmHost}/socket?encoding=${this.encoding}&compression=${this.compression}`);

    if(this.compression === DecompressionStrategy.ZlibJson) {
      socket.binaryType = 'arraybuffer';
    }

    this.socket = socket;
    this.state = "connecting";
    
    this.emit("SOCKET_STATE_CHANGE", "connecting");

    socket.addEventListener('open', (event) => {
      this.state = "tcp_connected";

      this.emit("SOCKET_STATE_CHANGE", "tcp_connected");
    });

    socket.addEventListener('message', (event) => {
      const compressed = event.data;
      const decompressed = this.decompress(compressed);
      
      this.seq = decompressed.seq;
      
      switch (decompressed.op) {
        case 0:
          this.emit("HIVEN_EVENT", {type: decompressed.e, data: decompressed.d});
          break;
        case 1:
          this.heartbeatInterval = decompressed.d.hbt_int;
          this.startHeartbeating();

          this.state = "connected";
          this.emit("SOCKET_STATE_CHANGE", "connected");
          
          break;
        default:
          console.error("Swarm received unknown opcode")
      }
    });

    socket.addEventListener('close', (event) => {
      switch(event.code) {
        case 4003: {
          this.state = event.reason;
          this.emit("SOCKET_STATE_CHANGE", event.reason);
        }
        default: {
          this.state = "closed";
          this.emit("SOCKET_STATE_CHANGE", "closed");
        }
      }
    });
  }

  private decompress(data: any): any {
    switch (this.compression) {
      case DecompressionStrategy.ZlibJson: {
        return JSON.parse(inflate(data, {to: 'string'}));
      }

      default: {
        return JSON.parse(data);
      }
    }
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