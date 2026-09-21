package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
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

type AgentCommand struct {
	ID        string         `json:"id"`
	MachineID string         `json:"machineId"`
	Command   string         `json:"command"`
	Arguments map[string]any `json:"arguments,omitempty"`
}

type CommandResult struct {
	Status string         `json:"status"`
	Result map[string]any `json:"result,omitempty"`
	Error  string         `json:"error,omitempty"`
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
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Shape         string  `json:"shape"`
	OCPU          float64 `json:"ocpu"`
	MemoryGB      float64 `json:"memoryGb"`
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryUsedGB  float64 `json:"memoryUsedGb"`
	SwapUsedGB    float64 `json:"swapUsedGb"`
	Load1         float64 `json:"load1"`
	DiskPercent   float64 `json:"diskPercent"`
	DiskUsedGB    float64 `json:"diskUsedGb"`
	DiskTotalGB   float64 `json:"diskTotalGb"`
	NetworkRxMbps float64 `json:"networkRxMbps"`
	NetworkTxMbps float64 `json:"networkTxMbps"`
	Uptime        string  `json:"uptime"`
	K3sVersion    string  `json:"k3sVersion"`
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
	maintenance := collectMaintenance(ctx)

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
		return
	}

	if err := processNextCommand(ctx, client, cfg, host, workloads, namespaces, k3sReachable); err != nil {
		fmt.Fprintln(os.Stderr, "command:", err)
	}
}

func processNextCommand(
	ctx context.Context,
	client *http.Client,
	cfg Config,
	host HostSnapshot,
	workloads []Workload,
	namespaces []NamespaceSummary,
	k3sReachable bool,
) error {
	command, err := getNextCommand(ctx, client, cfg, host.ID)
	if err != nil || command == nil {
		return err
	}

	result := CommandResult{Status: "failed"}
	switch command.Command {
	case "vm.health_check":
		result.Status = "success"
		result.Result = map[string]any{
			"machineId":      host.ID,
			"cpuPercent":     host.CPUPercent,
			"memoryUsedGb":   host.MemoryUsedGB,
			"memoryGb":       host.MemoryGB,
			"diskPercent":    host.DiskPercent,
			"k3sReachable":   k3sReachable,
			"workloadCount":  len(workloads),
			"namespaceCount": len(namespaces),
			"checkedAt":      time.Now().UTC().Format(time.RFC3339),
		}
	case "k8s.logs":
		result = executeLogCommand(ctx, command.Arguments)
	default:
		result.Error = "unsupported command"
	}

	return postJSON(ctx, client, cfg, "/api/v1/agent/commands/"+url.PathEscape(command.ID)+"/result", result)
}

func executeLogCommand(ctx context.Context, arguments map[string]any) CommandResult {
	args, metadata, err := buildLogCommand(arguments)
	if err != nil {
		return CommandResult{Status: "failed", Error: err.Error()}
	}

	output, err := kubectlOutput(ctx, args...)
	if err != nil {
		return CommandResult{Status: "failed", Error: "kubectl logs failed: " + err.Error()}
	}

	const maxLogBytes = 256 * 1024
	truncated := false
	if len(output) > maxLogBytes {
		output = output[len(output)-maxLogBytes:]
		truncated = true
	}

	text := string(output)
	lineCount := 0
	if strings.TrimSpace(text) != "" {
		lineCount = len(strings.Split(strings.TrimRight(text, "\n"), "\n"))
	}
	metadata["text"] = text
	metadata["lineCount"] = lineCount
	metadata["truncated"] = truncated
	metadata["collectedAt"] = time.Now().UTC().Format(time.RFC3339)

	return CommandResult{Status: "success", Result: metadata}
}

func buildLogCommand(arguments map[string]any) ([]string, map[string]any, error) {
	namespace, ok := arguments["namespace"].(string)
	if !ok || !isSafeKubernetesName(namespace) {
		return nil, nil, errors.New("invalid Kubernetes namespace")
	}
	name, ok := arguments["name"].(string)
	if !ok || !isSafeKubernetesName(name) {
		return nil, nil, errors.New("invalid Kubernetes workload name")
	}
	kind, ok := arguments["kind"].(string)
	if !ok {
		return nil, nil, errors.New("missing Kubernetes workload kind")
	}
	resourceKind := ""
	switch kind {
	case "Deployment":
		resourceKind = "deployment"
	case "StatefulSet":
		resourceKind = "statefulset"
	case "DaemonSet":
		resourceKind = "daemonset"
	case "Job":
		resourceKind = "job"
	default:
		return nil, nil, errors.New("unsupported Kubernetes workload kind")
	}

	tail := 100
	if raw, exists := arguments["tail"]; exists {
		switch value := raw.(type) {
		case float64:
			tail = int(value)
		case int:
			tail = value
		case json.Number:
			parsed, err := value.Int64()
			if err != nil {
				return nil, nil, errors.New("invalid log tail")
			}
			tail = int(parsed)
		default:
			return nil, nil, errors.New("invalid log tail")
		}
	}
	if tail < 10 || tail > 500 {
		return nil, nil, errors.New("log tail must be between 10 and 500")
	}

	resource := resourceKind + "/" + name
	args := []string{"logs", "-n", namespace, resource, "--tail", strconv.Itoa(tail), "--timestamps=true", "--all-pods=true"}
	metadata := map[string]any{
		"namespace": namespace,
		"workload":  name,
		"kind":      kind,
		"tail":      tail,
	}
	return args, metadata, nil
}

func isSafeKubernetesName(value string) bool {
	if value == "" || len(value) > 253 {
		return false
	}
	for i, r := range value {
		valid := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '.'
		if !valid {
			return false
		}
		if (i == 0 || i == len(value)-1) && (r == '-' || r == '.') {
			return false
		}
	}
	return true
}

func getNextCommand(ctx context.Context, client *http.Client, cfg Config, machineID string) (*AgentCommand, error) {
	endpoint := cfg.BaseURL + "/api/v1/agent/commands/next?machineId=" + url.QueryEscape(machineID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.Token)
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		return nil, nil
	}
	if resp.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("command poll returned %s: %s", resp.Status, strings.TrimSpace(string(data)))
	}

	var command AgentCommand
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&command); err != nil {
		return nil, err
	}
	if command.MachineID != machineID {
		return nil, fmt.Errorf("received command for unexpected machine %q", command.MachineID)
	}
	return &command, nil
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
	rxMbps, txMbps, _ := sampleNetwork(350 * time.Millisecond)
	diskPercent, diskUsedGB, diskTotalGB, _ := rootDiskStats()
	swapUsedGB := readSwapUsedGB()
	load1 := readLoad1()
	uptime := readUptime()
	k3sVersion := commandFirstLine(ctx, "k3s", "--version")
	if k3sVersion == "" { k3sVersion = "unknown" }

	return HostSnapshot{
		ID: hostname,
		Name: hostname,
		Shape: shape,
		OCPU: round1(ocpu),
		MemoryGB: round1(memoryGB),
		CPUPercent:    round1(cpuPercent),
		MemoryUsedGB:  round1(memoryUsedGB),
		SwapUsedGB:    round1(swapUsedGB),
		Load1:         round1(load1),
		DiskPercent:   round1(diskPercent),
		DiskUsedGB:    round1(diskUsedGB),
		DiskTotalGB:   round1(diskTotalGB),
		NetworkRxMbps: round1(rxMbps),
		NetworkTxMbps: round1(txMbps),
		Uptime:        uptime,
		K3sVersion:    k3sVersion,
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

func rootDiskStats() (percent, usedGB, totalGB float64, err error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs("/", &stat); err != nil {
		return 0, 0, 0, err
	}
	total := float64(stat.Blocks) * float64(stat.Bsize)
	free := float64(stat.Bavail) * float64(stat.Bsize)
	if total == 0 {
		return 0, 0, 0, nil
	}
	used := total - free
	const gib = 1024 * 1024 * 1024
	return used / total * 100, used / gib, total / gib, nil
}

func readSwapUsedGB() float64 {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0
	}
	var totalKB, freeKB uint64
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		value, _ := strconv.ParseUint(fields[1], 10, 64)
		switch strings.TrimSuffix(fields[0], ":") {
		case "SwapTotal":
			totalKB = value
		case "SwapFree":
			freeKB = value
		}
	}
	if totalKB <= freeKB {
		return 0
	}
	return float64(totalKB-freeKB) / 1024 / 1024
}

func readLoad1() float64 {
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(data))
	if len(fields) == 0 {
		return 0
	}
	value, _ := strconv.ParseFloat(fields[0], 64)
	return value
}

func readNetworkBytes() (rx, tx uint64, err error) {
	data, err := os.ReadFile("/proc/net/dev")
	if err != nil {
		return 0, 0, err
	}
	for _, line := range strings.Split(string(data), "\n") {
		if !strings.Contains(line, ":") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		iface := strings.TrimSpace(parts[0])
		if iface == "lo" {
			continue
		}
		fields := strings.Fields(parts[1])
		if len(fields) < 16 {
			continue
		}
		rxBytes, parseErr := strconv.ParseUint(fields[0], 10, 64)
		if parseErr != nil {
			continue
		}
		txBytes, parseErr := strconv.ParseUint(fields[8], 10, 64)
		if parseErr != nil {
			continue
		}
		rx += rxBytes
		tx += txBytes
	}
	return rx, tx, nil
}

func sampleNetwork(wait time.Duration) (rxMbps, txMbps float64, err error) {
	firstRx, firstTx, err := readNetworkBytes()
	if err != nil {
		return 0, 0, err
	}
	time.Sleep(wait)
	secondRx, secondTx, err := readNetworkBytes()
	if err != nil {
		return 0, 0, err
	}
	seconds := wait.Seconds()
	if seconds <= 0 {
		return 0, 0, nil
	}
	return float64(secondRx-firstRx) * 8 / seconds / 1_000_000,
		float64(secondTx-firstTx) * 8 / seconds / 1_000_000,
		nil
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
	data, err := kubectlJSON(ctx, "get", "deployments,statefulsets,daemonsets,jobs", "-A", "-o", "json")
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
	data, err := kubectlJSON(ctx, "get", "pods", "-A", "-o", "json")
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

func collectMaintenance(ctx context.Context) MaintenanceSummary {
	updatesAvailable, securityUpdates := readAptUpdates(ctx)
	unusedImagesGB := readDockerReclaimableGB(ctx)
	return MaintenanceSummary{
		OS:               readOSPrettyName(),
		Kernel:           commandFirstLine(ctx, "uname", "-r"),
		UpdatesAvailable: updatesAvailable,
		SecurityUpdates:  securityUpdates,
		RebootRequired:   fileExists("/var/run/reboot-required"),
		UnusedImagesGB:   round1(unusedImagesGB),
		PrometheusGB:     0,
		LokiGB:           0,
		LastBackup:       "unknown",
		BackupStatus:     "unknown",
	}
}

func readAptUpdates(ctx context.Context) (total, security int) {
	output, err := exec.CommandContext(ctx, "apt", "list", "--upgradable").Output()
	if err != nil {
		return 0, 0
	}
	return parseAptUpgradable(string(output))
}

func parseAptUpgradable(output string) (total, security int) {
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "Listing...") {
			continue
		}
		total++
		lower := strings.ToLower(line)
		if strings.Contains(lower, "-security") || strings.Contains(lower, "/security") || strings.Contains(lower, ",security") {
			security++
		}
	}
	return total, security
}

func readDockerReclaimableGB(ctx context.Context) float64 {
	output, err := exec.CommandContext(ctx, "docker", "system", "df", "--format", "{{json .}}").Output()
	if err != nil {
		return 0
	}

	var totalBytes float64
	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		var row map[string]any
		if err := json.Unmarshal([]byte(line), &row); err != nil {
			continue
		}
		typeName, _ := row["Type"].(string)
		if typeName != "Images" && typeName != "Build Cache" {
			continue
		}
		reclaimable, _ := row["Reclaimable"].(string)
		if idx := strings.Index(reclaimable, " ("); idx >= 0 {
			reclaimable = reclaimable[:idx]
		}
		bytes, err := parseHumanBytes(strings.TrimSpace(reclaimable))
		if err == nil {
			totalBytes += bytes
		}
	}
	return totalBytes / (1024 * 1024 * 1024)
}

func parseHumanBytes(raw string) (float64, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, errors.New("empty size")
	}
	units := []struct {
		suffix string
		factor float64
	}{
		{"TB", 1e12},
		{"GB", 1e9},
		{"MB", 1e6},
		{"KB", 1e3},
		{"B", 1},
	}
	upper := strings.ToUpper(value)
	for _, unit := range units {
		if strings.HasSuffix(upper, unit.suffix) {
			numeric := strings.TrimSpace(value[:len(value)-len(unit.suffix)])
			parsed, err := strconv.ParseFloat(numeric, 64)
			if err != nil {
				return 0, err
			}
			return parsed * unit.factor, nil
		}
	}
	return 0, fmt.Errorf("unsupported size %q", raw)
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
