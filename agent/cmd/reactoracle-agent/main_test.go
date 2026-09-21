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
