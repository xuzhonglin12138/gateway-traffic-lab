package traffic

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestPingReturnsFastSuccessfulResponse(t *testing.T) {
	handler := NewHandler()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/ping", nil)

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want %d", rec.Code, http.StatusOK)
	}
	body := decodeBody(t, rec)
	if body["route"] != "/api/ping" {
		t.Fatalf("route = %v; want /api/ping", body["route"])
	}
	if body["ok"] != true {
		t.Fatalf("ok = %v; want true", body["ok"])
	}
}

func TestDelayWaitsAndReportsDelay(t *testing.T) {
	handler := NewHandler()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/delay?ms=30", nil)

	start := time.Now()
	handler.ServeHTTP(rec, req)
	elapsed := time.Since(start)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want %d", rec.Code, http.StatusOK)
	}
	if elapsed < 25*time.Millisecond {
		t.Fatalf("elapsed = %s; want at least 25ms", elapsed)
	}
	body := decodeBody(t, rec)
	if body["delay_ms"] != float64(30) {
		t.Fatalf("delay_ms = %v; want 30", body["delay_ms"])
	}
}

func TestErrorReturnsRequestedStatus(t *testing.T) {
	handler := NewHandler()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/error?status=503&ms=1", nil)

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d; want %d", rec.Code, http.StatusServiceUnavailable)
	}
	body := decodeBody(t, rec)
	if body["ok"] != false {
		t.Fatalf("ok = %v; want false", body["ok"])
	}
	if body["status"] != float64(503) {
		t.Fatalf("response status field = %v; want 503", body["status"])
	}
}

func TestRandomHonorsErrorRateBoundaries(t *testing.T) {
	handler := NewHandler()

	recOK := httptest.NewRecorder()
	reqOK := httptest.NewRequest(http.MethodGet, "/api/random?errorRate=0&minMs=1&maxMs=1", nil)
	handler.ServeHTTP(recOK, reqOK)
	if recOK.Code != http.StatusOK {
		t.Fatalf("errorRate=0 status = %d; want 200", recOK.Code)
	}

	recError := httptest.NewRecorder()
	reqError := httptest.NewRequest(http.MethodGet, "/api/random?errorRate=100&minMs=1&maxMs=1", nil)
	handler.ServeHTTP(recError, reqError)
	if recError.Code != http.StatusInternalServerError {
		t.Fatalf("errorRate=100 status = %d; want 500", recError.Code)
	}
}

func TestGroupedRoutesReturnRouteInformation(t *testing.T) {
	handler := NewHandler()
	tests := []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/api/user/setting/42?ms=1"},
		{method: http.MethodPost, path: "/api/order/detail/99?status=502"},
		{method: http.MethodGet, path: "/api/report/list?status=200"},
	}

	for _, tt := range tests {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(tt.method, tt.path, strings.NewReader(`{"hello":"world"}`))
		handler.ServeHTTP(rec, req)
		if rec.Code < 200 || rec.Code > 599 {
			t.Fatalf("%s status = %d; want real HTTP status", tt.path, rec.Code)
		}
		body := decodeBody(t, rec)
		if body["route"] == "" {
			t.Fatalf("%s route is empty in response %v", tt.path, body)
		}
	}
}

func TestRegexValidationRoutesReturnControlledResponses(t *testing.T) {
	handler := NewHandler()
	tests := []struct {
		path  string
		label string
	}{
		{path: "/api/payment/trade/20260611001?status=202&ms=1", label: "/api/payment/trade/*"},
		{path: "/api/project/alpha/env/prod?status=203", label: "/api/project/*/env/*"},
		{path: "/api/version/v2/apps/console?status=204", label: "/api/version/*/apps/*"},
		{path: "/api/logs/service/worker/errors?status=205", label: "/api/logs/service/*"},
		{path: "/api/files/docs/readme.pdf?status=206", label: "/api/files/*"},
		{path: "/api/search/users?q=admin&status=207", label: "/api/search/users"},
	}

	for _, tt := range tests {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, tt.path, nil)
		handler.ServeHTTP(rec, req)

		if rec.Code < 200 || rec.Code > 299 {
			t.Fatalf("%s status = %d; want controlled 2xx response", tt.path, rec.Code)
		}
		body := decodeBody(t, rec)
		if body["route_label"] != tt.label {
			t.Fatalf("%s route_label = %v; want %s", tt.path, body["route_label"], tt.label)
		}
		if body["route"] != tt.label {
			t.Fatalf("%s route = %v; want %s", tt.path, body["route"], tt.label)
		}
	}
}

func TestScenarioAcceptsJSONBody(t *testing.T) {
	handler := NewHandler()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/scenario", strings.NewReader(`{"delay_ms":1,"status":201,"payload_bytes":12,"route_label":"custom"}`))
	req.Header.Set("Content-Type", "application/json")

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d; want %d", rec.Code, http.StatusCreated)
	}
	body := decodeBody(t, rec)
	if body["payload_size"] != float64(12) {
		t.Fatalf("payload_size = %v; want 12", body["payload_size"])
	}
	if body["route_label"] != "custom" {
		t.Fatalf("route_label = %v; want custom", body["route_label"])
	}
}

func decodeBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v body=%s", err, rec.Body.String())
	}
	return body
}
