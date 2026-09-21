package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const agentVersion = "0.1.0"

type Config struct {
	BaseURL  string
	Token    string
	Interval time.Duration
}

type Heartbeat struct {
	AgentVersion string    `json:"agentVersion"`
	MachineID    string    `json:"machineId"`
	Status       string    `json:"status"`
	K3sReachable bool      `json:"k3sReachable"`
	SentAt       time.Time `json:"sentAt"`
}

type Snapshot struct {
	MachineID   string             `json:"machineId"`
	CollectedAt time.Time          `json:"collectedAt"`
	Host        HostSnapshot       `json:"host"`
	Workloads   []Workload         `json:"workloads"`
	Namespaces  []NamespaceSummary `json:"namespaces"`
	Maintenance MaintenanceSummary `json:"maintenance"`
}

type HostSnapshot struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Shape        string  `json:"shape"`
	OCPU         float64 `json:"ocpu"`
	MemoryGB     float64 `json:"memoryGb"`
	CPUPercent   float64 `json:"cpuPercent"`
	MemoryUsedGB float64 `json:"memoryUsedGb"`
	DiskPercent  float64 `json:"diskPercent"`
	Uptime       string  `json:"uptime"`
	K3sVersion   string  `json:"k3sVersion"`
}

type Workload struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Namespace     string  `json:"namespace"`
	Kind          string  `json:"kind"`
	Status        string  `json:"status"`
	CPUMillicores float64 `json:"cpuMillicores"`
	MemoryMB      float64 `json:"memoryMb"`
	Restarts      int     `json:"restarts"`
}

type NamespaceSummary struct {
	Name          string  `json:"name"`
	PodsReady     int     `json:"podsReady"`
	PodsTotal     int     `json:"podsTotal"`
	CPUMillicores float64 `json:"cpuMillicores"`
	MemoryMB      float64 `json:"memoryMb"`
}

type podMetric struct {
	Namespace     string
	Name          string
	CPUMillicores float64
	MemoryMB      float64
}

type MaintenanceSummary struct {
	OS               string  `json:"os"`
	Kernel           string  `json:"kernel"`
	UpdatesAvailable int     `json:"updatesAvailable"`
	SecurityUpdates  int     `json:"securityUpdates"`
	RebootRequired   bool    `json:"rebootRequired"`
	UnusedImagesGB   float64 `json:"unusedImagesGb"`
	PrometheusGB     float64 `json:"prometheusGb"`
	LokiGB           float64 `json:"lokiGb"`
	LastBackup       string  `json:"lastBackup"`
	BackupStatus     string  `json:"backupStatus"`
}

type OCIInstanceMetadata struct {
	DisplayName string `json:"displayName"`
	Shape       string `json:"shape"`
	ShapeConfig struct {
		OCPUs       float64 `json:"ocpus"`
		MemoryInGBs float64 `json:"memoryInGBs"`
	} `json:"shapeConfig"`
}

type kubeList struct {
	Items []kubeItem `json:"items"`
}

type kubeItem struct {
	Kind string `json:"kind"`
	Metadata struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
	} `json:"metadata"`
	Status map[string]any `json:"status"`
}

type podList struct {
	Items []podItem `json:"items"`
}

type podItem struct {
	Metadata struct {
		Namespace string `json:"namespace"`
	} `json:"metadata"`
	Status struct {
		ContainerStatuses []struct {
			Ready        bool `json:"ready"`
			RestartCount int  `json:"restartCount"`
		} `json:"containerStatuses"`
		Phase string `json:"phase"`
	} `json:"status"`
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	ticker := time.NewTicker(cfg.Interval)
	defer ticker.Stop()

	for {
		runOnce(client, cfg)
		<-ticker.C
	}
}

func loadConfig() (Config, error) {
	baseURL := strings.TrimRight(os.Getenv("REACTORACLE_CONTROL_API_URL"), "/")
	token := os.Getenv("REACTORACLE_AGENT_TOKEN")
	if baseURL == "" {
		return Config{}, errors.New("REACTORACLE_CONTROL_API_URL is required")
	}
	if token == "" {
		return Config{}, errors.New("REACTORACLE_AGENT_TOKEN is required")
	}
	interval := 30 * time.Second
	if raw := os.Getenv("REACTORACLE_INTERVAL_SECONDS"); raw != "" {
		seconds, err := strconv.Atoi(raw)
		if err != nil || seconds < 10 {
			return Config{}, errors.New("REACTORACLE_INTERVAL_SECONDS must be an integer >= 10")
		}
		interval = time.Duration(seconds) * time.Second
	}
	return Config{BaseURL: baseURL, Token: token, Interval: interval}, nil
}

func runOnce(client *http.Client, cfg Config) {
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()

	host, err := collectHost(ctx)
	if err != nil {
		fmt.Fprintln(os.Stderr, "host collection:", err)
		return
	}
	workloads, namespaces, k3sReachable := collectKubernetes(ctx)
	maintenance := collectMaintenance()

	agentStatus := "healthy"
	if !k3sReachable {
		agentStatus = "warning"
	}
	heartbeat := Heartbeat{
		AgentVersion: agentVersion,
		MachineID: host.ID,
		Status: agentStatus,
		K3sReachable: k3sReachable,
		SentAt: time.Now().UTC(),
	}
	if err := postJSON(ctx, client, cfg, "/api/v1/agent/heartbeat", heartbeat); err != nil {
		fmt.Fprintln(os.Stderr, "heartbeat:", err)
		return
	}

	snapshot := Snapshot{
		MachineID: host.ID,
		CollectedAt: time.Now().UTC(),
		Host: host,
		Workloads: workloads,
		Namespaces: namespaces,
		Maintenance: maintenance,
	}
	if err := postJSON(ctx, client, cfg, "/api/v1/agent/snapshot", snapshot); err != nil {
		fmt.Fprintln(os.Stderr, "snapshot:", err)
	}
}

func postJSON(ctx context.Context, client *http.Client, cfg Config, path string, value any) error {
	body, err := json.Marshal(value)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.Token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("control API returned %s: %s", resp.Status, strings.TrimSpace(string(data)))
	}
	return nil
}

func collectHost(ctx context.Context) (HostSnapshot, error) {
	hostname, err := os.Hostname()
	if err != nil {
		return HostSnapshot{}, err
	}

	shape := "unknown"
	ocpu := float64(runtime.NumCPU())
	memoryGB := 0.0
	if metadata, err := readOCIMetadata(ctx); err == nil {
		if metadata.DisplayName != "" { hostname = metadata.DisplayName }
		if metadata.Shape != "" { shape = metadata.Shape }
		if metadata.ShapeConfig.OCPUs > 0 { ocpu = metadata.ShapeConfig.OCPUs }
		if metadata.ShapeConfig.MemoryInGBs > 0 { memoryGB = metadata.ShapeConfig.MemoryInGBs }
	}

	totalKB, availableKB := readMemInfo()
	if memoryGB == 0 && totalKB > 0 {
		memoryGB = float64(totalKB) / 1024 / 1024
	}
	memoryUsedGB := 0.0
	if totalKB > 0 {
		memoryUsedGB = float64(totalKB-availableKB) / 1024 / 1024
	}

	cpuPercent, _ := sampleCPU(350 * time.Millisecond)
	diskPercent, _ := rootDiskPercent()
	uptime := readUptime()
	k3sVersion := commandFirstLine(ctx, "k3s", "--version")
	if k3sVersion == "" { k3sVersion = "unknown" }

	return HostSnapshot{
		ID: hostname,
		Name: hostname,
		Shape: shape,
		OCPU: round1(ocpu),
		MemoryGB: round1(memoryGB),
		CPUPercent: round1(cpuPercent),
		MemoryUsedGB: round1(memoryUsedGB),
		DiskPercent: round1(diskPercent),
		Uptime: uptime,
		K3sVersion: k3sVersion,
	}, nil
}

func readOCIMetadata(ctx context.Context) (OCIInstanceMetadata, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://169.254.169.254/opc/v2/instance/", nil)
	if err != nil { return OCIInstanceMetadata{}, err }
	req.Header.Set("Authorization", "Bearer Oracle")
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil { return OCIInstanceMetadata{}, err }
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return OCIInstanceMetadata{}, fmt.Errorf("OCI metadata status %s", resp.Status)
	}
	var metadata OCIInstanceMetadata
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&metadata); err != nil {
		return OCIInstanceMetadata{}, err
	}
	return metadata, nil
}

func readMemInfo() (totalKB, availableKB uint64) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil { return 0, 0 }
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 { continue }
		value, _ := strconv.ParseUint(fields[1], 10, 64)
		switch strings.TrimSuffix(fields[0], ":") {
		case "MemTotal": totalKB = value
		case "MemAvailable": availableKB = value
		}
	}
	return totalKB, availableKB
}

type cpuTimes struct { idle uint64; total uint64 }

func readCPUTimes() (cpuTimes, error) {
	data, err := os.ReadFile("/proc/stat")
	if err != nil { return cpuTimes{}, err }
	line := strings.SplitN(string(data), "\n", 2)[0]
	fields := strings.Fields(line)
	if len(fields) < 5 || fields[0] != "cpu" {
		return cpuTimes{}, errors.New("unexpected /proc/stat format")
	}
	values := make([]uint64, 0, len(fields)-1)
	for _, field := range fields[1:] {
		value, err := strconv.ParseUint(field, 10, 64)
		if err != nil { return cpuTimes{}, err }
		values = append(values, value)
	}
	var total uint64
	for _, value := range values { total += value }
	idle := values[3]
	if len(values) > 4 { idle += values[4] }
	return cpuTimes{idle: idle, total: total}, nil
}

func sampleCPU(wait time.Duration) (float64, error) {
	first, err := readCPUTimes()
	if err != nil { return 0, err }
	time.Sleep(wait)
	second, err := readCPUTimes()
	if err != nil { return 0, err }
	totalDelta := second.total - first.total
	if totalDelta == 0 { return 0, nil }
	idleDelta := second.idle - first.idle
	return (1 - float64(idleDelta)/float64(totalDelta)) * 100, nil
}

func rootDiskPercent() (float64, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs("/", &stat); err != nil { return 0, err }
	total := float64(stat.Blocks) * float64(stat.Bsize)
	free := float64(stat.Bavail) * float64(stat.Bsize)
	if total == 0 { return 0, nil }
	return (total-free)/total*100, nil
}

func readUptime() string {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil { return "unknown" }
	fields := strings.Fields(string(data))
	if len(fields) == 0 { return "unknown" }
	secondsFloat, err := strconv.ParseFloat(fields[0], 64)
	if err != nil { return "unknown" }
	seconds := int64(secondsFloat)
	days := seconds / 86400
	hours := (seconds % 86400) / 3600
	minutes := (seconds % 3600) / 60
	if days > 0 { return fmt.Sprintf("%dd %02dh", days, hours) }
	return fmt.Sprintf("%dh %02dm", hours, minutes)
}

func collectKubernetes(ctx context.Context) ([]Workload, []NamespaceSummary, bool) {
	workloads, err := readWorkloads(ctx)
	if err != nil {
		return []Workload{}, []NamespaceSummary{}, false
	}
	namespaces, err := readNamespaces(ctx)
	if err != nil {
		return workloads, []NamespaceSummary{}, false
	}
	if metrics, err := readPodMetrics(ctx); err == nil {
		applyPodMetrics(workloads, namespaces, metrics)
	}
	return workloads, namespaces, true
}

func readWorkloads(ctx context.Context) ([]Workload, error) {
	cmd := exec.CommandContext(ctx, "kubectl", "get", "deployments,statefulsets,daemonsets,jobs", "-A", "-o", "json")
	data, err := cmd.Output()
	if err != nil { return nil, err }
	var list kubeList
	if err := json.Unmarshal(data, &list); err != nil { return nil, err }
	result := make([]Workload, 0, len(list.Items))
	for _, item := range list.Items {
		result = append(result, Workload{
			ID: item.Metadata.Namespace + "/" + item.Metadata.Name,
			Name: item.Metadata.Name,
			Namespace: item.Metadata.Namespace,
			Kind: item.Kind,
			Status: workloadStatus(item),
		})
	}
	return result, nil
}

func workloadStatus(item kubeItem) string {
	switch item.Kind {
	case "Job":
		if number(item.Status["succeeded"]) > 0 { return "Complete" }
		if number(item.Status["failed"]) > 0 { return "Failed" }
		return "Running"
	default:
		desired := number(item.Status["replicas"])
		ready := number(item.Status["readyReplicas"])
		if desired == 0 {
			desired = number(item.Status["desiredNumberScheduled"])
			ready = number(item.Status["numberReady"])
		}
		if desired > 0 && ready >= desired { return "Running" }
		return "Pending"
	}
}

func readNamespaces(ctx context.Context) ([]NamespaceSummary, error) {
	cmd := exec.CommandContext(ctx, "kubectl", "get", "pods", "-A", "-o", "json")
	data, err := cmd.Output()
	if err != nil { return nil, err }
	var pods podList
	if err := json.Unmarshal(data, &pods); err != nil { return nil, err }
	byNamespace := map[string]*NamespaceSummary{}
	for _, pod := range pods.Items {
		entry := byNamespace[pod.Metadata.Namespace]
		if entry == nil {
			entry = &NamespaceSummary{Name: pod.Metadata.Namespace}
			byNamespace[pod.Metadata.Namespace] = entry
		}
		entry.PodsTotal++
		ready := len(pod.Status.ContainerStatuses) > 0
		for _, container := range pod.Status.ContainerStatuses {
			if !container.Ready { ready = false }
		}
		if ready && pod.Status.Phase == "Running" { entry.PodsReady++ }
	}
	result := make([]NamespaceSummary, 0, len(byNamespace))
	for _, value := range byNamespace { result = append(result, *value) }
	return result, nil
}

func kubectlJSON(ctx context.Context, args ...string) ([]byte, error) {
	return kubectlOutput(ctx, args...)
}

func readPodMetrics(ctx context.Context) ([]podMetric, error) {
	data, err := kubectlOutput(ctx, "top", "pods", "-A", "--no-headers")
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	result := make([]podMetric, 0, len(lines))
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		cpu, err := parseCPUToMillicores(fields[2])
		if err != nil {
			continue
		}
		memory, err := parseMemoryToMB(fields[3])
		if err != nil {
			continue
		}
		result = append(result, podMetric{
			Namespace: fields[0],
			Name: fields[1],
			CPUMillicores: cpu,
			MemoryMB: memory,
		})
	}
	return result, nil
}

func applyPodMetrics(workloads []Workload, namespaces []NamespaceSummary, metrics []podMetric) {
	for _, metric := range metrics {
		for i := range namespaces {
			if namespaces[i].Name == metric.Namespace {
				namespaces[i].CPUMillicores += metric.CPUMillicores
				namespaces[i].MemoryMB += metric.MemoryMB
				break
			}
		}

		best := -1
		bestLen := -1
		for i := range workloads {
			if workloads[i].Namespace != metric.Namespace {
				continue
			}
			if metric.Name == workloads[i].Name || strings.HasPrefix(metric.Name, workloads[i].Name+"-") {
				if len(workloads[i].Name) > bestLen {
					best = i
					bestLen = len(workloads[i].Name)
				}
			}
		}
		if best >= 0 {
			workloads[best].CPUMillicores += metric.CPUMillicores
			workloads[best].MemoryMB += metric.MemoryMB
		}
	}
	for i := range workloads {
		workloads[i].CPUMillicores = round1(workloads[i].CPUMillicores)
		workloads[i].MemoryMB = round1(workloads[i].MemoryMB)
	}
	for i := range namespaces {
		namespaces[i].CPUMillicores = round1(namespaces[i].CPUMillicores)
		namespaces[i].MemoryMB = round1(namespaces[i].MemoryMB)
	}
}

func parseCPUToMillicores(raw string) (float64, error) {
	switch {
	case strings.HasSuffix(raw, "n"):
		value, err := strconv.ParseFloat(strings.TrimSuffix(raw, "n"), 64)
		return value / 1_000_000, err
	case strings.HasSuffix(raw, "u"):
		value, err := strconv.ParseFloat(strings.TrimSuffix(raw, "u"), 64)
		return value / 1_000, err
	case strings.HasSuffix(raw, "m"):
		return strconv.ParseFloat(strings.TrimSuffix(raw, "m"), 64)
	default:
		value, err := strconv.ParseFloat(raw, 64)
		return value * 1000, err
	}
}

func parseMemoryToMB(raw string) (float64, error) {
	units := []struct {
		suffix string
		factor float64
	}{
		{"Ki", 1.0 / 1024},
		{"Mi", 1},
		{"Gi", 1024},
		{"Ti", 1024 * 1024},
		{"K", 1.0 / 1000},
		{"M", 1},
		{"G", 1000},
	}
	for _, unit := range units {
		if strings.HasSuffix(raw, unit.suffix) {
			value, err := strconv.ParseFloat(strings.TrimSuffix(raw, unit.suffix), 64)
			return value * unit.factor, err
		}
	}
	return strconv.ParseFloat(raw, 64)
}

func kubectlOutput(ctx context.Context, args ...string) ([]byte, error) {
	if output, err := exec.CommandContext(ctx, "kubectl", args...).Output(); err == nil {
		return output, nil
	}
	k3sArgs := append([]string{"kubectl"}, args...)
	return exec.CommandContext(ctx, "k3s", k3sArgs...).Output()
}

func collectMaintenance() MaintenanceSummary {
	return MaintenanceSummary{
		OS: readOSPrettyName(),
		Kernel: commandFirstLine(context.Background(), "uname", "-r"),
		UpdatesAvailable: 0,
		SecurityUpdates: 0,
		RebootRequired: fileExists("/var/run/reboot-required"),
		UnusedImagesGB: 0,
		PrometheusGB: 0,
		LokiGB: 0,
		LastBackup: "unknown",
		BackupStatus: "unknown",
	}
}

func readOSPrettyName() string {
	data, err := os.ReadFile("/etc/os-release")
	if err != nil { return "Linux" }
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			return strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), "\"")
		}
	}
	return "Linux"
}

func commandFirstLine(ctx context.Context, name string, args ...string) string {
	output, err := exec.CommandContext(ctx, name, args...).Output()
	if err != nil { return "" }
	return strings.TrimSpace(strings.SplitN(strings.TrimSpace(string(output)), "\n", 2)[0])
}

func number(value any) float64 {
	switch typed := value.(type) {
	case float64: return typed
	case int: return float64(typed)
	case json.Number:
		value, _ := typed.Float64()
		return value
	default: return 0
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func round1(value float64) float64 {
	return float64(int(value*10+0.5)) / 10
}
