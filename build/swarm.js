"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = require("events");
var pako_1 = require("pako");
var DecompressionStrategy;
(function (DecompressionStrategy) {
    DecompressionStrategy["ZlibJson"] = "zlib_json";
    DecompressionStrategy["TextJson"] = "text_json";
})(DecompressionStrategy || (DecompressionStrategy = {}));
var SwarmClient = /** @class */ (function (_super) {
    __extends(SwarmClient, _super);
    function SwarmClient(swarmHost, encoding, compression) {
        var _this = _super.call(this) || this;
        _this.swarmHost = swarmHost || "wss://swarm.hiven.io";
        _this.encoding = encoding || "json";
        _this.compression = compression || DecompressionStrategy.ZlibJson;
        _this.state = "not_connected";
        _this.socket = null;
        _this.heartbeatInterval = null;
        _this.heartbeat = null;
        _this.seq = 0;
        return _this;
    }
    SwarmClient.prototype.connect = function () {
        var _this = this;
        var socket = new WebSocket(this.swarmHost + "/socket?encoding=" + this.encoding);
        this.socket = socket;
        this.state = "connecting";
        this.emit("SOCKET_STATE_CHANGE", "connecting");
        socket.addEventListener('open', function (event) {
            _this.state = "tcp_connected";
            _this.emit("SOCKET_STATE_CHANGE", "tcp_connected");
        });
        socket.addEventListener('message', function (event) {
            var compressed = event.data;
            var decompressed = _this.decompress(compressed);
            _this.seq = decompressed.seq;
            switch (decompressed.op) {
                case 0:
                    _this.emit("HIVEN_EVENT", { type: decompressed.e, data: decompressed.d });
                    break;
                case 1:
                    _this.heartbeatInterval = decompressed.d.hbt_int;
                    _this.startHeartbeating();
                    _this.state = "connected";
                    _this.emit("SOCKET_STATE_CHANGE", "connected");
                    break;
                default:
                    console.error("Swarm received unknown opcode");
            }
        });
        socket.addEventListener('close', function (event) {
            switch (event.code) {
                case 4003: {
                    _this.state = event.reason;
                    _this.emit("SOCKET_STATE_CHANGE", event.reason);
                }
                default: {
                    _this.state = "closed";
                    _this.emit("SOCKET_STATE_CHANGE", "closed");
                }
            }
        });
    };
    SwarmClient.prototype.decompress = function (data) {
        switch (this.compression) {
            case DecompressionStrategy.ZlibJson: {
                return JSON.parse(pako_1.default.inflate(data, { to: 'string' }));
            }
            default: {
                return JSON.parse(data);
            }
        }
    };
    SwarmClient.prototype.sendRaw = function (data) {
        var encoded = JSON.stringify(data);
        this.socket.send(encoded);
    };
    SwarmClient.prototype.startHeartbeating = function () {
        var _this = this;
        this.heartbeat = setInterval(function () {
            if (_this.state !== "connected") {
                clearInterval(_this.heartbeat);
                return;
            }
            _this.sendRaw({ "op": 3 });
        }, this.heartbeatInterval || 30000);
    };
    SwarmClient.prototype.identify = function (token) {
        this.sendRaw({ "op": 2, "d": { "token": token } });
    };
    return SwarmClient;
}(events_1.EventEmitter));
exports.SwarmClient = SwarmClient;
