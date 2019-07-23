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
var SwarmClient = /** @class */ (function (_super) {
    __extends(SwarmClient, _super);
    function SwarmClient(swarmHost, encoding) {
        var _this = _super.call(this) || this;
        _this.swarmHost = swarmHost || "swarm.hiven.io";
        _this.encoding = encoding || "etf";
        _this.state = "not_connected";
        _this.socket = null;
        _this.heartbeatInterval = null;
        _this.heartbeat = null;
        return _this;
    }
    SwarmClient.prototype.connect = function () {
        var _this = this;
        var socket = new WebSocket("wss://" + this.swarmHost + "/socket?encoding=" + this.encoding);
        this.socket = socket;
        this.state = "connecting";
        this.emit("SOCKET_STATE_CHANGE", "connecting");
        socket.addEventListener('open', function (event) {
            _this.state = "connected";
            _this.emit("SOCKET_STATE_CHANGE", "connected");
        });
        socket.addEventListener('message', function (event) {
            var encoded = event.data;
            var decoded = _this.encoding === "json" ? JSON.parse(encoded) : encoded;
            switch (decoded.op) {
                case 0:
                    console.log(decoded);
                    break;
                case 1:
                    _this.heartbeatInterval = decoded.d.hbt_int;
                    _this.startHeartbeating();
                    break;
                default:
                    console.error("Swarm received unknown opcode");
            }
        });
        socket.addEventListener('close', function (event) {
            _this.state = "closed";
            _this.emit("SOCKET_STATE_CHANGE", "closed");
        });
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
        this.sendRaw({ "op": 1, "d": { "token": token } });
    };
    return SwarmClient;
}(events_1.EventEmitter));
exports.SwarmClient = SwarmClient;
