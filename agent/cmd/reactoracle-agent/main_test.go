package main

import "testing"

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
