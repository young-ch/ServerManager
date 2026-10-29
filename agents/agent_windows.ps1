# ==============================================================================
# OpsPulse Windows Server Lightweight Monitoring Agent
# Usage: powershell.exe -ExecutionPolicy Bypass -File agent_windows.ps1
# ==============================================================================

param (
    [string]$DashboardUrl = "http://localhost:9500/api/agent/report",
    [int]$ServerId = 1,
    [string]$AgentToken = "SECRET_TOKEN"
)

try {
    # 1. CPU Usage (%)
    $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
    if ($null -eq $cpu) { $cpu = 0 }
    $cpu = [math]::Round($cpu, 1)

    # 2. Memory Usage (%)
    $os = Get-CimInstance Win32_OperatingSystem
    $totalMem = $os.TotalVisibleMemorySize
    $freeMem = $os.FreePhysicalMemory
    $usedMem = $totalMem - $freeMem
    $memPercent = [math]::Round(($usedMem / $totalMem) * 100, 1)
    $totalMemGB = [math]::Round($totalMem / 1MB, 1)
    $usedMemGB = [math]::Round($usedMem / 1MB, 1)

    # 3. Disk Usage (Fixed Drives)
    $disks = @()
    $overallDiskPercent = 0
    $drives = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 }
    
    foreach ($drive in $drives) {
        $totalGB = [math]::Round($drive.Size / 1GB, 1)
        $freeGB = [math]::Round($drive.FreeSpace / 1GB, 1)
        $usedGB = [math]::Round($totalGB - $freeGB, 1)
        $pct = if ($totalGB -gt 0) { [math]::Round(($usedGB / $totalGB) * 100, 1) } else { 0 }
        
        $disks += @{
            name = $drive.DeviceID
            total_gb = $totalGB
            free_gb = $freeGB
            used_gb = $usedGB
            percent = $pct
        }
        if ($drive.DeviceID -eq "C:" -or $overallDiskPercent -eq 0) {
            $overallDiskPercent = $pct
        }
    }

    # 4. System Uptime
    $bootTime = $os.LastBootUpTime
    $uptimeSpan = (Get-Date) - $bootTime
    $days = $uptimeSpan.Days
    $hours = $uptimeSpan.Hours
    $mins = $uptimeSpan.Minutes
    $uptimeText = "$days days $hours hrs $mins mins"

    # 5. Build Payload
    $payloadObj = @{
        server_id = $ServerId
        token = $AgentToken
        cpu_percent = $cpu
        memory_percent = $memPercent
        memory_total_gb = $totalMemGB
        memory_used_gb = $usedMemGB
        disk_percent = $overallDiskPercent
        disk_details = $disks
        uptime_text = $uptimeText
        os_version = $os.Caption
    }
    $payloadJson = $payloadObj | ConvertTo-Json -Depth 4

    # 6. Send to Dashboard
    $utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)
    $response = Invoke-RestMethod -Uri $DashboardUrl -Method Post -Body $utf8Bytes -ContentType "application/json; charset=utf-8" -TimeoutSec 5
    Write-Host "[OK] Report sent successfully to $DashboardUrl"
    Write-Host ($response | ConvertTo-Json -Compress)
}
catch {
    $err = $_.Exception.Message
    Write-Host "[ERROR] Failed to send report: $err"
}
