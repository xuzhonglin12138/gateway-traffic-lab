package traffic

import (
	"encoding/json"
	"io"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	defaultMaxDelayMS   = 30000
	defaultMaxPayload   = 1048576
	defaultRandomMinMS  = 0
	defaultRandomMaxMS  = 1000
	defaultErrorStatus  = http.StatusInternalServerError
	defaultSuccessState = http.StatusOK
)

type Handler struct {
	rand *rand.Rand
}

type ScenarioRequest struct {
	DelayMS      int    `json:"delay_ms"`
	Status       int    `json:"status"`
	ErrorRate    int    `json:"error_rate"`
	MinDelayMS   int    `json:"min_delay_ms"`
	MaxDelayMS   int    `json:"max_delay_ms"`
	PayloadBytes int    `json:"payload_bytes"`
	RouteLabel   string `json:"route_label"`
}

type Response struct {
	OK          bool   `json:"ok"`
	Route       string `json:"route"`
	Method      string `json:"method"`
	Status      int    `json:"status"`
	DelayMS     int    `json:"delay_ms"`
	PayloadSize int    `json:"payload_size"`
	RouteLabel  string `json:"route_label,omitempty"`
	Timestamp   string `json:"timestamp"`
	Payload     string `json:"payload,omitempty"`
}

func NewHandler() http.Handler {
	return &Handler{rand: rand.New(rand.NewSource(time.Now().UnixNano()))}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch {
	case r.URL.Path == "/healthz":
		writeText(w, http.StatusOK, "ok")
	case r.URL.Path == "/api/ping":
		h.writeControlled(w, r, r.URL.Path, defaultSuccessState, 0, 0, "")
	case r.URL.Path == "/api/delay":
		delay := queryInt(r, "ms", 0, 0, defaultMaxDelayMS)
		h.writeControlled(w, r, r.URL.Path, defaultSuccessState, delay, 0, "")
	case r.URL.Path == "/api/error":
		status := queryStatus(r, "status", defaultErrorStatus)
		delay := queryInt(r, "ms", 0, 0, defaultMaxDelayMS)
		h.writeControlled(w, r, r.URL.Path, status, delay, 0, "")
	case r.URL.Path == "/api/random":
		h.handleRandom(w, r)
	case r.URL.Path == "/api/echo":
		h.handleEcho(w, r)
	case r.URL.Path == "/api/scenario":
		h.handleScenario(w, r)
	case strings.HasPrefix(r.URL.Path, "/api/user/setting/"):
		h.handleGroupedRoute(w, r, "/api/user/setting/*")
	case strings.HasPrefix(r.URL.Path, "/api/order/detail/"):
		h.handleGroupedRoute(w, r, "/api/order/detail/*")
	case r.URL.Path == "/api/report/list":
		h.handleGroupedRoute(w, r, "/api/report/list")
	default:
		writeJSON(w, http.StatusNotFound, Response{
			OK:        false,
			Route:     r.URL.Path,
			Method:    r.Method,
			Status:    http.StatusNotFound,
			Timestamp: nowString(),
		})
	}
}

func (h *Handler) handleRandom(w http.ResponseWriter, r *http.Request) {
	errorRate := queryInt(r, "errorRate", 0, 0, 100)
	minDelay := queryInt(r, "minMs", defaultRandomMinMS, 0, defaultMaxDelayMS)
	maxDelay := queryInt(r, "maxMs", defaultRandomMaxMS, 0, defaultMaxDelayMS)
	if maxDelay < minDelay {
		maxDelay = minDelay
	}

	status := defaultSuccessState
	if errorRate >= 100 || (errorRate > 0 && h.rand.Intn(100) < errorRate) {
		status = defaultErrorStatus
	}
	delay := minDelay
	if maxDelay > minDelay {
		delay += h.rand.Intn(maxDelay - minDelay + 1)
	}
	h.writeControlled(w, r, r.URL.Path, status, delay, 0, "")
}

func (h *Handler) handleEcho(w http.ResponseWriter, r *http.Request) {
	payloadBytes := queryInt(r, "payloadBytes", 0, 0, defaultMaxPayload)
	status := queryStatus(r, "status", defaultSuccessState)
	delay := queryInt(r, "ms", 0, 0, defaultMaxDelayMS)
	if payloadBytes == 0 && r.Body != nil {
		body, _ := io.ReadAll(http.MaxBytesReader(nil, r.Body, defaultMaxPayload))
		payloadBytes = len(body)
	}
	h.writeControlled(w, r, r.URL.Path, status, delay, payloadBytes, "")
}

func (h *Handler) handleScenario(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, Response{
			OK:        false,
			Route:     r.URL.Path,
			Method:    r.Method,
			Status:    http.StatusMethodNotAllowed,
			Timestamp: nowString(),
		})
		return
	}

	var req ScenarioRequest
	if err := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20)).Decode(&req); err != nil && err != io.EOF {
		writeJSON(w, http.StatusBadRequest, Response{
			OK:        false,
			Route:     r.URL.Path,
			Method:    r.Method,
			Status:    http.StatusBadRequest,
			Timestamp: nowString(),
		})
		return
	}

	status := normalizeStatus(req.Status, defaultSuccessState)
	delay := clamp(req.DelayMS, 0, defaultMaxDelayMS)
	payloadBytes := clamp(req.PayloadBytes, 0, defaultMaxPayload)
	if req.ErrorRate >= 100 || (req.ErrorRate > 0 && h.rand.Intn(100) < clamp(req.ErrorRate, 0, 100)) {
		status = defaultErrorStatus
	}

	h.writeControlled(w, r, r.URL.Path, status, delay, payloadBytes, req.RouteLabel)
}

func (h *Handler) handleGroupedRoute(w http.ResponseWriter, r *http.Request, routeLabel string) {
	status := queryStatus(r, "status", defaultSuccessState)
	delay := queryInt(r, "ms", 0, 0, defaultMaxDelayMS)
	payloadBytes := queryInt(r, "payloadBytes", 0, 0, defaultMaxPayload)
	h.writeControlled(w, r, routeLabel, status, delay, payloadBytes, routeLabel)
}

func (h *Handler) writeControlled(w http.ResponseWriter, r *http.Request, route string, status, delayMS, payloadBytes int, routeLabel string) {
	if delayMS > 0 {
		time.Sleep(time.Duration(delayMS) * time.Millisecond)
	}
	writeJSON(w, status, Response{
		OK:          status < 400,
		Route:       route,
		Method:      r.Method,
		Status:      status,
		DelayMS:     delayMS,
		PayloadSize: payloadBytes,
		RouteLabel:  routeLabel,
		Timestamp:   nowString(),
		Payload:     strings.Repeat("x", payloadBytes),
	})
}

func queryInt(r *http.Request, key string, fallback, minValue, maxValue int) int {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return clamp(value, minValue, maxValue)
}

func queryStatus(r *http.Request, key string, fallback int) int {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return normalizeStatus(value, fallback)
}

func normalizeStatus(value, fallback int) int {
	if value < 200 || value > 599 {
		return fallback
	}
	return value
}

func clamp(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeText(w http.ResponseWriter, status int, body string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body))
}

func nowString() string {
	return time.Now().Format(time.RFC3339)
}
