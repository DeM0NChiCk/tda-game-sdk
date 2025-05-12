class TDAGameAnalyticsSDK {
    constructor({ token, gameId, httpEndpoint, wsEndpoint }) {
        this.token = token;
        this.gameId = gameId;
        this.sessionId = this._generateSessionId();
        this.httpEndpoint = httpEndpoint;
        this.wsEndpoint = wsEndpoint;
        this.ws = null;

        this._initWebSocket();
        this._bindUnload();
    }

    _generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    _initWebSocket() {
        this.ws = new WebSocket(`${this.wsEndpoint}?token=${this.token}&gameId=${this.gameId}`);
        this.ws.onopen = () => {
            this._sendWS("session_start", {});
        };
        this.ws.onerror = (e) => console.warn("WebSocket error", e);
        this.ws.onclose = () => console.log("WebSocket closed");
    }

    _bindUnload() {
        window.addEventListener("beforeunload", () => {
            this.track("session_end");
        });
    }

    _sendHTTP(type, data = {}) {
        fetch(this.httpEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.token}`
            },
            body: JSON.stringify({
                gameId: this.gameId,
                sessionId: this.sessionId,
                type,
                timestamp: Date.now(),
                data
            })
        }).catch(e => console.warn("HTTP send error:", e));
    }

    _sendWS(type, data = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                gameId: this.gameId,
                sessionId: this.sessionId,
                type,
                timestamp: Date.now(),
                data
            }));
        }
    }

    track(eventType, data = {}) {
        this._sendHTTP(eventType, data);
        // this._sendWS(eventType, data);
    }
}

export default TDAGameAnalyticsSDK;
