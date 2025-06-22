class TDAGameAnalyticsSDK {
    constructor({ token, gameId, httpEndpoint, wsEndpoint, fpsAggInterval = 30 * 60 * 1000 }) {
        this.token = token;
        this.gameId = gameId;
        this.sessionId = this._generateSessionId();
        this.httpEndpoint = httpEndpoint;
        this.wsEndpoint = wsEndpoint;
        this.fpsAggInterval = fpsAggInterval;

        this.ws = null;
        this.fpsData = [];
        this.eventQueue = [];
        this.taskTimers = {};

        this._initWebSocket();
        this._bindUnload();
        this._startFPSTracking();
        this._startFpsAggregation();
        this._setupRetryOnReconnect();

        this._flushQueue();
    }

    _generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    _initWebSocket() {
        this.ws = new WebSocket(`${this.wsEndpoint}?token=${this.token}&gameId=${this.gameId}`);
        this.ws.onopen = () => {
            this._sendWS("session_start", {});

            this._sendWS("client_info", {
                userAgent: navigator.userAgent,
                language: navigator.language
            });
        };
        this.ws.onerror = (e) => console.warn("WebSocket error", e);
        this.ws.onclose = () => console.log("WebSocket closed");
    }

    _bindUnload() {
        window.addEventListener("beforeunload", () => {
            const event = this._createEvent("session_end");

            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify([event])], { type: "application/json" });
                navigator.sendBeacon(this.httpEndpoint, blob);
            } else {
                this._addToQueue(event);
                this._flushQueue(true);
            }

            this._sendWS("session_end", {});
        });
    }

    _setupRetryOnReconnect() {
        window.addEventListener("online", () => this._flushQueue());
    }

    _sendHTTPBulk(events) {
        fetch(this.httpEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.token}`
            },
            body: JSON.stringify(events)
        }).catch(e => {
            console.warn("Bulk send failed, saving for retry.", e);
            this._addToQueue(events);
        });
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

    _addToQueue(event) {
        if (Array.isArray(event)) {
            this.eventQueue.push(...event);
        } else {
            this.eventQueue.push(event);
        }
    }

    _flushQueue(force = false) {
        if (!navigator.onLine && !force) return;
        if (this.eventQueue.length > 0) {
            const batch = this.eventQueue.splice(0, this.eventQueue.length);
            this._sendHTTPBulk(batch);
        }
    }

    _createEvent(type, data = {}) {
        return {
            gameId: this.gameId,
            sessionId: this.sessionId,
            type,
            timestamp: Date.now(),
            data
        };
    }

    track(type, data = {}) {
        const event = this._createEvent(type, data);
        this._addToQueue(event);
        this._flushQueue();
    }

    logError(name, description) {
        this.track("error", { name, description });
    }

    // FPS
    _startFPSTracking() {
        let last = performance.now();
        const frame = (now) => {
            const delta = now - last;
            last = now;
            const fps = 1000 / delta;
            this.fpsData.push(fps);
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    _startFpsAggregation() {
        setInterval(() => {
            if (this.fpsData.length === 0) return;

            const avg = this.fpsData.reduce((a, b) => a + b, 0) / this.fpsData.length;
            this._sendWS("fps_average", {
                interval: this.fpsAggInterval,
                average_fps: avg.toFixed(2),
                count: this.fpsData.length
            });
            this.fpsData = [];
        }, this.fpsAggInterval);
    }

    // Тепловая карта
    trackHeatmap(levelName, voxels) {
        this.track("heatmap_voxels", {
            levelName,
            voxels
        });
    }

    // Успешность задачи
    trackTaskResult({ taskId, success, abandoned = false }) {
        this.track("task_result", {
            taskId,
            success,
            abandoned
        });
    }

    // Время выполнения задачи
    trackTaskStart(taskId) {
        this.taskTimers[taskId] = Date.now();
        this.track("task_start", { taskId });
    }

    trackTaskEnd(taskId) {
        const start = this.taskTimers[taskId];
        const duration = start ? Date.now() - start : null;
        this.track("task_end", { taskId, duration });
        delete this.taskTimers[taskId];
    }

    // Фиксации (глазодвижение)
    trackFixation({ x, y, duration, aoi = null }) {
        this.track("fixation", { x, y, duration, aoi });
    }

    // Стимулы и TTFF
    trackStimulusShown({ stimulusId, aoi }) {
        this.track("stimulus_shown", { stimulusId, aoi });
    }

    // Оценка SEQ (1–7 баллов)
    trackSEQ({ taskId, rating }) {
        this.track("seq", { taskId, rating });
    }

    // Завершение
    stop() {
        this.track("session_end");
        this._flushQueue(true);
    }
}

export default TDAGameAnalyticsSDK;