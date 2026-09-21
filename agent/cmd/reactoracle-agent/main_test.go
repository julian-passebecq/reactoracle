package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWorkloadStatus(t *testing.T) {
	cases := []struct {
		name string
		item kubeItem
		want string
	}{
		{
			name: "deployment ready",
			item: kubeItem{Kind: "Deployment", Status: map[string]any{"replicas": float64(1), "readyReplicas": float64(1)}},
			want: "Running",
		},
		{
			name: "deployment pending",
			item: kubeItem{Kind: "Deployment", Status: map[string]any{"replicas": float64(1), "readyReplicas": float64(0)}},
			want: "Pending",
		},
		{
			name: "job complete",
			item: kubeItem{Kind: "Job", Status: map[string]any{"succeeded": float64(1)}},
			want: "Complete",
		},
		{
			name: "job failed",
			item: kubeItem{Kind: "Job", Status: map[string]any{"failed": float64(1)}},
			want: "Failed",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := workloadStatus(tc.item); got != tc.want {
				t.Fatalf("workloadStatus() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestRound1(t *testing.T) {
	if got := round1(12.345); got != 12.3 {
		t.Fatalf("round1() = %v, want 12.3", got)
	}
}

func TestMetricParsers(t *testing.T) {
	cpuCases := map[string]float64{
		"250m": 250,
		"500u": 0.5,
		"1000000n": 1,
		"1": 1000,
	}
	for raw, want := range cpuCases {
		got, err := parseCPUToMillicores(raw)
		if err != nil {
			t.Fatalf("parseCPUToMillicores(%q): %v", raw, err)
		}
		if got != want {
			t.Fatalf("parseCPUToMillicores(%q) = %v, want %v", raw, got, want)
		}
	}

	memoryCases := map[string]float64{
		"512Mi": 512,
		"1Gi": 1024,
		"1024Ki": 1,
	}
	for raw, want := range memoryCases {
		got, err := parseMemoryToMB(raw)
		if err != nil {
			t.Fatalf("parseMemoryToMB(%q): %v", raw, err)
		}
		if got != want {
			t.Fatalf("parseMemoryToMB(%q) = %v, want %v", raw, got, want)
		}
	}
}

func TestApplyPodMetricsUsesLongestWorkloadPrefix(t *testing.T) {
	workloads := []Workload{
		{Name: "airflow", Namespace: "airflow"},
		{Name: "airflow-scheduler", Namespace: "airflow"},
	}
	namespaces := []NamespaceSummary{{Name: "airflow"}}
	metrics := []podMetric{{
		Namespace: "airflow",
		Name: "airflow-scheduler-7d94abcd-x1",
		CPUMillicores: 125,
		MemoryMB: 512,
	}}
	applyPodMetrics(workloads, namespaces, metrics)

	if workloads[0].CPUMillicores != 0 {
		t.Fatalf("shorter prefix received metrics: %+v", workloads[0])
	}
	if workloads[1].CPUMillicores != 125 || workloads[1].MemoryMB != 512 {
		t.Fatalf("scheduler metrics not applied: %+v", workloads[1])
	}
	if namespaces[0].CPUMillicores != 125 || namespaces[0].MemoryMB != 512 {
		t.Fatalf("namespace metrics not applied: %+v", namespaces[0])
	}
}


func TestSafeHealthCheckCommandRoundTrip(t *testing.T) {
	var received CommandResult
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Fatalf("missing agent authorization")
		}
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/agent/commands/next":
			if got := r.URL.Query().Get("machineId"); got != "oracle-test" {
				t.Fatalf("machineId = %q", got)
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(AgentCommand{
				ID: "cmd_test",
				MachineID: "oracle-test",
				Command: "vm.health_check",
			})
		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/agent/commands/cmd_test/result":
			if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
				t.Fatalf("decode result: %v", err)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte("{}"))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	cfg := Config{BaseURL: server.URL, Token: "test-token"}
	host := HostSnapshot{ID: "oracle-test", CPUPercent: 20, MemoryUsedGB: 4, MemoryGB: 12, DiskPercent: 30}
	workloads := []Workload{{Name: "airflow", Namespace: "airflow"}}
	namespaces := []NamespaceSummary{{Name: "airflow", PodsReady: 1, PodsTotal: 1}}

	if err := processNextCommand(t.Context(), server.Client(), cfg, host, workloads, namespaces, true); err != nil {
		t.Fatalf("processNextCommand: %v", err)
	}
	if received.Status != "success" {
		t.Fatalf("result status = %q", received.Status)
	}
	if got, ok := received.Result["k3sReachable"].(bool); !ok || !got {
		t.Fatalf("unexpected health result: %#v", received.Result)
	}
}
