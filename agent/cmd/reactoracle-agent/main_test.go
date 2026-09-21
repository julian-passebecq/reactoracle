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
		"250m":     250,
		"500u":     0.5,
		"1000000n": 1,
		"1":        1000,
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
		"512Mi":  512,
		"1Gi":    1024,
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
		Namespace:     "airflow",
		Name:          "airflow-scheduler-7d94abcd-x1",
		CPUMillicores: 125,
		MemoryMB:      512,
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
				ID:        "cmd_test",
				MachineID: "oracle-test",
				Command:   "vm.health_check",
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

func TestBuildLogCommand(t *testing.T) {
	args, metadata, err := buildLogCommand(map[string]any{
		"namespace": "airflow",
		"name":      "airflow-scheduler",
		"kind":      "Deployment",
		"tail":      float64(120),
	})
	if err != nil {
		t.Fatalf("buildLogCommand: %v", err)
	}
	want := []string{"logs", "-n", "airflow", "deployment/airflow-scheduler", "--tail", "120", "--timestamps=true", "--all-pods=true"}
	if len(args) != len(want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
	for i := range want {
		if args[i] != want[i] {
			t.Fatalf("args[%d] = %q, want %q", i, args[i], want[i])
		}
	}
	if metadata["namespace"] != "airflow" || metadata["workload"] != "airflow-scheduler" {
		t.Fatalf("unexpected metadata: %#v", metadata)
	}
}

func TestBuildLogCommandRejectsUnsafeArguments(t *testing.T) {
	cases := []map[string]any{
		{"namespace": "airflow;rm", "name": "scheduler", "kind": "Deployment", "tail": float64(100)},
		{"namespace": "airflow", "name": "scheduler", "kind": "Pod", "tail": float64(100)},
		{"namespace": "airflow", "name": "scheduler", "kind": "Deployment", "tail": float64(5000)},
		{"namespace": "airflow", "name": "scheduler", "kind": "Deployment", "tail": float64(100), "container": "unexpected"},
	}
	for _, arguments := range cases {
		if _, _, err := buildLogCommand(arguments); err == nil {
			t.Fatalf("expected validation error for %#v", arguments)
		}
	}
}

func TestSafeKubernetesName(t *testing.T) {
	valid := []string{"airflow", "spark-history", "monitoring.v1"}
	for _, value := range valid {
		if !isSafeKubernetesName(value) {
			t.Fatalf("expected valid Kubernetes name %q", value)
		}
	}
	invalid := []string{"", "-airflow", "airflow-", "airflow/scheduler", "Airflow", "airflow;rm"}
	for _, value := range invalid {
		if isSafeKubernetesName(value) {
			t.Fatalf("expected invalid Kubernetes name %q", value)
		}
	}
}

func TestParseAptUpgradable(t *testing.T) {
	input := `Listing... Done
linux-image/noble-security 1.2 arm64 [upgradable from: 1.1]
curl/noble-updates 8.0 arm64 [upgradable from: 7.9]
openssl/noble-updates,noble-security 3.0 arm64 [upgradable from: 2.9]
`
	total, security := parseAptUpgradable(input)
	if total != 3 {
		t.Fatalf("total = %d, want 3", total)
	}
	if security != 2 {
		t.Fatalf("security = %d, want 2", security)
	}
}

func TestParseHumanBytes(t *testing.T) {
	cases := map[string]float64{
		"0B":    0,
		"500MB": 500_000_000,
		"1.5GB": 1_500_000_000,
		"2KB":   2_000,
	}
	for raw, want := range cases {
		got, err := parseHumanBytes(raw)
		if err != nil {
			t.Fatalf("parseHumanBytes(%q): %v", raw, err)
		}
		if got != want {
			t.Fatalf("parseHumanBytes(%q) = %v, want %v", raw, got, want)
		}
	}
	if _, err := parseHumanBytes("not-a-size"); err == nil {
		t.Fatal("expected invalid size to return an error")
	}
}

func TestApplyPodRestartCountsUsesLongestWorkloadPrefix(t *testing.T) {
	workloads := []Workload{
		{Name: "airflow", Namespace: "airflow"},
		{Name: "airflow-scheduler", Namespace: "airflow"},
	}
	var pods podList
	var pod podItem
	pod.Metadata.Name = "airflow-scheduler-7d94abcd-x1"
	pod.Metadata.Namespace = "airflow"
	pod.Status.ContainerStatuses = []struct {
		Ready        bool `json:"ready"`
		RestartCount int  `json:"restartCount"`
	}{
		{Ready: true, RestartCount: 3},
		{Ready: true, RestartCount: 1},
	}
	pods.Items = []podItem{pod}

	applyPodRestartCounts(workloads, pods)

	if workloads[0].Restarts != 0 {
		t.Fatalf("shorter prefix received restarts: %+v", workloads[0])
	}
	if workloads[1].Restarts != 4 {
		t.Fatalf("scheduler restarts = %d, want 4", workloads[1].Restarts)
	}
}

func TestBuildRestartCommand(t *testing.T) {
	args, metadata, err := buildRestartCommand(map[string]any{
		"namespace": "airflow",
		"name":      "airflow-scheduler",
		"kind":      "Deployment",
	})
	if err != nil {
		t.Fatalf("buildRestartCommand: %v", err)
	}
	want := []string{"rollout", "restart", "-n", "airflow", "deployment/airflow-scheduler"}
	if len(args) != len(want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
	for i := range want {
		if args[i] != want[i] {
			t.Fatalf("args[%d] = %q, want %q", i, args[i], want[i])
		}
	}
	if metadata["namespace"] != "airflow" || metadata["workload"] != "airflow-scheduler" {
		t.Fatalf("unexpected metadata: %#v", metadata)
	}
}

func TestBuildRestartCommandRejectsUnsafeOrUnsupportedTargets(t *testing.T) {
	cases := []map[string]any{
		{"namespace": "airflow;rm", "name": "scheduler", "kind": "Deployment"},
		{"namespace": "airflow", "name": "scheduler", "kind": "Job"},
		{"namespace": "airflow", "name": "scheduler", "kind": "Deployment", "image": "bad"},
	}
	for _, arguments := range cases {
		if _, _, err := buildRestartCommand(arguments); err == nil {
			t.Fatalf("expected validation error for %#v", arguments)
		}
	}
}
