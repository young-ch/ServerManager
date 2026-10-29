/**
 * OpsPulse - Server Unified Operations Center Frontend Engine
 */

let allServers = [];
let currentView = 'card'; // 'card' or 'table'
let currentFilters = {
  os: 'ALL',
  status: 'ALL',
  env: 'ALL',
  search: ''
};

let refreshInterval = 15;
let refreshCountdown = refreshInterval;
let timerId = null;
let isRefreshPaused = false;
let currentDetailServerId = null;

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  fetchOverview();
  fetchServers();
  startRefreshLoop();
});

function initEventListeners() {
  // Search input
  const searchInput = document.getElementById("filter-search");
  searchInput.addEventListener("input", (e) => {
    currentFilters.search = e.target.value.toLowerCase().trim();
    renderServers();
  });

  // OS Filters
  document.querySelectorAll("#filter-os-group .filter-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#filter-os-group .filter-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilters.os = btn.dataset.os;
      renderServers();
    });
  });

  // Status Filters
  document.querySelectorAll("#filter-status-group .filter-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#filter-status-group .filter-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilters.status = btn.dataset.status;
      renderServers();
    });
  });

  // Env Filters
  document.querySelectorAll("#filter-env-group .filter-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#filter-env-group .filter-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilters.env = btn.dataset.env;
      renderServers();
    });
  });

  const bind = (id, event, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  };

  bind("view-card-btn", "click", () => setView('card'));
  bind("view-table-btn", "click", () => setView('table'));
  bind("btn-toggle-refresh", "click", toggleRefresh);
  bind("btn-print-report", "click", printServerAssetReport);
  bind("btn-export-csv", "click", exportServersToCsv);
  bind("btn-check-all", "click", checkAllServers);
  bind("btn-open-add-modal", "click", openAddModal);
  bind("add-server-form", "submit", handleSaveServer);
  bind("btn-modal-edit", "click", () => {
    if (currentDetailServerId) openEditModal(currentDetailServerId);
  });
  bind("btn-modal-check-now", "click", () => {
    if (currentDetailServerId) checkSingleServer(currentDetailServerId);
  });
  bind("btn-modal-delete", "click", () => {
    if (currentDetailServerId && confirm("이 서버를 삭제하시겠습니까? 관련 모니터링 기록이 모두 제거됩니다.")) {
      deleteServer(currentDetailServerId);
    }
  });

  // Primary port dynamic placeholder
  const osSelect = document.getElementById("form-os-type");
  const portInput = document.getElementById("form-primary-port");
  if (osSelect && portInput) {
    osSelect.addEventListener("change", () => {
      if (osSelect.value === "windows") {
        portInput.placeholder = "Windows RDP 기본값: 3389";
      } else {
        portInput.placeholder = "Linux SSH 기본값: 22";
      }
    });
  }
}

function setView(view) {
  currentView = view;
  const gridContainer = document.getElementById("servers-grid-container");
  const tableContainer = document.getElementById("servers-table-container");
  const cardBtn = document.getElementById("view-card-btn");
  const tableBtn = document.getElementById("view-table-btn");

  if (view === 'card') {
    gridContainer.style.display = 'grid';
    tableContainer.style.display = 'none';
    cardBtn.classList.add("active");
    tableBtn.classList.remove("active");
  } else {
    gridContainer.style.display = 'none';
    tableContainer.style.display = 'block';
    cardBtn.classList.remove("active");
    tableBtn.classList.add("active");
  }
}

// Auto-Refresh Loop
function startRefreshLoop() {
  if (timerId) clearInterval(timerId);
  refreshCountdown = refreshInterval;
  updateTimerDisplay();

  timerId = setInterval(() => {
    if (!isRefreshPaused) {
      refreshCountdown--;
      updateTimerDisplay();
      if (refreshCountdown <= 0) {
        refreshCountdown = refreshInterval;
        fetchOverview();
        fetchServers(false); // silent refresh
      }
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById("refresh-timer");
  if (el) el.innerText = `${refreshCountdown}s`;
}

function toggleRefresh() {
  isRefreshPaused = !isRefreshPaused;
  const btn = document.getElementById("btn-toggle-refresh");
  if (isRefreshPaused) {
    btn.innerHTML = '<i class="fa-solid fa-play"></i>';
    btn.title = "갱신 재개";
    showToast("자동 갱신이 일시 정지되었습니다.", "info");
  } else {
    btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    btn.title = "일시정지";
    showToast("자동 갱신이 다시 시작되었습니다.", "info");
  }
}

// Fetch API Data
async function fetchOverview() {
  try {
    const res = await fetch("/api/overview");
    if (!res.ok) return;
    const data = await res.json();
    
    document.getElementById("kpi-total").innerHTML = `${data.total}<span style="font-size: 1rem; color: var(--text-dim);">대</span>`;
    document.getElementById("kpi-online").innerHTML = `${data.online}<span style="font-size: 1rem; color: var(--text-dim);">대</span>`;
    document.getElementById("kpi-warning").innerHTML = `${data.warning}<span style="font-size: 1rem; color: var(--text-dim);">대</span>`;
    document.getElementById("kpi-offline").innerHTML = `${data.offline}<span style="font-size: 1rem; color: var(--text-dim);">대</span>`;
    document.getElementById("kpi-linux").innerText = data.linux_count;
    document.getElementById("kpi-windows").innerText = data.windows_count;

    const onlinePct = data.total > 0 ? Math.round(((data.online + data.warning) / data.total) * 100) : 100;
    document.getElementById("kpi-online-pct").innerText = `전체 가동률 ${onlinePct}%`;
  } catch (err) {
    console.error("Overview fetch error:", err);
  }
}

async function fetchServers(showSpinner = true) {
  try {
    const res = await fetch("/api/servers");
    if (!res.ok) throw new Error("서버 목록 로드 실패");
    allServers = await res.json();
    renderServers();
  } catch (err) {
    console.error("Servers fetch error:", err);
    showToast("서버 목록을 가져오지 못했습니다.", "danger");
  }
}

// Rendering Function
function renderServers() {
  // Apply filtering
  const filtered = allServers.filter(s => {
    // Search query
    if (currentFilters.search) {
      const q = currentFilters.search;
      const match = (s.name && s.name.toLowerCase().includes(q)) ||
                    (s.host && s.host.toLowerCase().includes(q)) ||
                    (s.ip_private && s.ip_private.toLowerCase().includes(q)) ||
                    (s.location && s.location.toLowerCase().includes(q)) ||
                    (s.description && s.description.toLowerCase().includes(q));
      if (!match) return false;
    }

    // OS
    if (currentFilters.os !== 'ALL' && s.os_type !== currentFilters.os) {
      return false;
    }

    // Status
    if (currentFilters.status !== 'ALL' && s.status !== currentFilters.status) {
      return false;
    }

    // Env
    if (currentFilters.env !== 'ALL' && s.env !== currentFilters.env) {
      return false;
    }

    return true;
  });

  renderGrid(filtered);
  renderTable(filtered);
}

function renderGrid(servers) {
  const container = document.getElementById("servers-grid-container");
  if (!servers || servers.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-dim);">
        <i class="fa-solid fa-server" style="font-size: 3rem; margin-bottom: 14px; opacity: 0.3;"></i>
        <div style="font-size: 1.1rem; font-weight: 600;">조건에 일치하는 서버가 없습니다.</div>
        <p style="font-size: 0.85rem; margin-top: 6px;">필터를 재설정하거나 신규 서버를 등록해 보세요.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = servers.map(s => {
    const isWin = s.os_type === 'windows';
    const osIcon = isWin ? 'fa-brands fa-windows' : 'fa-brands fa-linux';
    const osClass = isWin ? 'windows' : 'linux';
    
    // Status text & class
    let statusClass = 'offline';
    let statusLabel = '오프라인';
    if (s.status === 'online') {
      statusClass = 'online';
      statusLabel = '정상 가동';
    } else if (s.status === 'warning') {
      statusClass = 'warning';
      statusLabel = '주의 요망';
    }

    // Gauge helper
    const cpu = s.cpu_percent || 0;
    const mem = s.memory_percent || 0;
    const disk = s.disk_percent || 0;

    const cpuClass = cpu >= 90 ? 'danger' : (cpu >= 70 ? 'warn' : 'normal');
    const memClass = mem >= 90 ? 'danger' : (mem >= 70 ? 'warn' : 'normal');
    const diskClass = disk >= 90 ? 'danger' : (disk >= 70 ? 'warn' : 'normal');

    // Ports list preview
    const portsHtml = (s.ports || []).map(p => `
      <span class="port-badge ${p.status === 'open' ? 'open' : 'closed'}" title="${p.service_name}: ${p.status === 'open' ? (p.latency_ms ? p.latency_ms + 'ms' : 'Open') : 'Closed'}">
        <i class="fa-solid fa-circle" style="font-size: 6px;"></i> ${p.service_name} (${p.port_number})
      </span>
    `).join('');

    return `
      <div class="server-card">
        <i class="${osIcon} os-watermark"></i>

        <div class="card-top">
          <div class="server-title-wrap">
            <div class="os-icon-badge ${osClass}">
              <i class="${osIcon}"></i>
            </div>
            <div class="server-name-env">
              <div class="server-name">
                ${escapeHtml(s.name)}
                <span class="env-tag ${s.env}">${s.env}</span>
              </div>
              <div class="server-os-version">${escapeHtml(s.os_version || (isWin ? 'Windows Server' : 'Linux'))}</div>
            </div>
          </div>

          <div class="status-pill ${statusClass}">
            <span class="dot"></span>
            <span>${statusLabel}</span>
          </div>
        </div>

        <div class="server-meta-row">
          <span class="meta-ip">
            <i class="fa-solid fa-network-wired"></i>
            ${escapeHtml(s.ip_private || s.host)}
          </span>
          <span class="meta-loc" title="${escapeHtml(s.location || '')}">
            <i class="fa-solid fa-location-dot"></i>
            ${escapeHtml(s.location || '전산실')}
          </span>
        </div>

        <div class="metrics-bars-wrap">
          <div class="metric-item">
            <div class="metric-label-row">
              <span>CPU 사용률</span>
              <span class="metric-val">${cpu.toFixed(1)}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${cpuClass}" style="width: ${Math.min(cpu, 100)}%;"></div>
            </div>
          </div>

          <div class="metric-item">
            <div class="metric-label-row">
              <span>메모리 (RAM)</span>
              <span class="metric-val">
                ${s.memory_total_gb ? `${s.memory_used_gb} / ${s.memory_total_gb} GB (${mem.toFixed(1)}%)` : `${mem.toFixed(1)}%`}
              </span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${memClass}" style="width: ${Math.min(mem, 100)}%;"></div>
            </div>
          </div>

          <div class="metric-item">
            <div class="metric-label-row">
              <span>디스크 (스토리지)</span>
              <span class="metric-val">${disk.toFixed(1)}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${diskClass}" style="width: ${Math.min(disk, 100)}%;"></div>
            </div>
          </div>
        </div>

        <div class="ports-badge-row">
          ${portsHtml || '<span class="port-badge">포트 미등록</span>'}
        </div>

        <div class="card-actions">
          <button class="btn btn-secondary btn-sm" onclick="openServerDetail(${s.id})">
            <i class="fa-solid fa-sliders"></i> 상세 관제
          </button>
          ${isWin ? `
            <a href="/api/servers/${s.id}/rdp" class="btn btn-secondary btn-sm" title="원클릭 원격데스크톱 접속">
              <i class="fa-solid fa-desktop" style="color: #38bdf8;"></i> RDP 접속
            </a>
          ` : `
            <button class="btn btn-secondary btn-sm" onclick="copySshCommand('${escapeHtml(s.ip_private || s.host)}', ${s.primary_port || 22})" title="SSH 접속 명령어 복사">
              <i class="fa-solid fa-terminal" style="color: #facc15;"></i> SSH 복사
            </button>
          `}
          <button class="btn btn-secondary btn-sm" onclick="openEditModal(${s.id})" title="서버 정보 수정">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="checkSingleServer(${s.id})" title="즉시 헬스체크">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderTable(servers) {
  const tbody = document.getElementById("servers-table-body");
  if (!servers || servers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 40px; color: var(--text-dim);">검색 결과가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = servers.map(s => {
    const isWin = s.os_type === 'windows';
    const osIcon = isWin ? '<i class="fa-brands fa-windows" style="color: #38bdf8;"></i>' : '<i class="fa-brands fa-linux" style="color: #facc15;"></i>';
    
    let statusPill = `<span class="status-pill offline"><span class="dot"></span> 장애</span>`;
    if (s.status === 'online') statusPill = `<span class="status-pill online"><span class="dot"></span> 정상</span>`;
    else if (s.status === 'warning') statusPill = `<span class="status-pill warning"><span class="dot"></span> 주의</span>`;

    return `
      <tr>
        <td>${statusPill}</td>
        <td>
          <strong style="color: #fff; cursor: pointer;" onclick="openServerDetail(${s.id})">${escapeHtml(s.name)}</strong>
        </td>
        <td>${osIcon} ${escapeHtml(s.os_version || s.os_type)}</td>
        <td><span class="env-tag ${s.env}">${s.env}</span></td>
        <td style="font-family: var(--font-mono); color: #38bdf8;">${escapeHtml(s.ip_private || s.host)}</td>
        <td>${escapeHtml(s.location || '-')}</td>
        <td style="font-family: var(--font-mono);">${(s.cpu_percent || 0).toFixed(1)}%</td>
        <td style="font-family: var(--font-mono);">
          ${s.memory_total_gb ? `<span title="${s.memory_used_gb}GB / ${s.memory_total_gb}GB 사용">${(s.memory_percent || 0).toFixed(1)}% <span style="font-size: 0.75rem; color: var(--text-dim); display: block;">${s.memory_used_gb}/${s.memory_total_gb}G</span></span>` : `${(s.memory_percent || 0).toFixed(1)}%`}
        </td>
        <td style="font-family: var(--font-mono);">${(s.disk_percent || 0).toFixed(1)}%</td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${(s.ports || []).map(p => `
              <span class="port-badge ${p.status === 'open' ? 'open' : 'closed'}" style="font-size: 0.65rem;">
                ${p.service_name}
              </span>
            `).join('')}
          </div>
        </td>
        <td style="white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="openServerDetail(${s.id})">상세</button>
          <button class="btn btn-secondary btn-sm" onclick="openEditModal(${s.id})" title="정보 수정"><i class="fa-solid fa-pen-to-square"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

// Open Server Details Modal
async function openServerDetail(serverId) {
  currentDetailServerId = serverId;
  try {
    const res = await fetch(`/api/servers/${serverId}`);
    if (!res.ok) throw new Error("서버 정보를 불러올 수 없습니다.");
    const s = await res.json();

    const isWin = s.os_type === 'windows';
    const osIcon = isWin ? 'fa-brands fa-windows' : 'fa-brands fa-linux';
    const osColor = isWin ? '#38bdf8' : '#facc15';

    document.getElementById("modal-server-os-icon").innerHTML = `<i class="${osIcon}" style="color: ${osColor}; margin-right: 8px;"></i>`;
    document.getElementById("modal-server-name").innerText = s.name;

    let statusPill = `<span class="status-pill offline"><span class="dot"></span> 오프라인</span>`;
    if (s.status === 'online') statusPill = `<span class="status-pill online"><span class="dot"></span> 정상 가동</span>`;
    else if (s.status === 'warning') statusPill = `<span class="status-pill warning"><span class="dot"></span> 주의 요망</span>`;
    document.getElementById("modal-server-status-pill").innerHTML = statusPill;

    // IP Info
    const ipPublicText = s.ip_public ? ` (공인: ${s.ip_public})` : '';
    document.getElementById("modal-ip-info").innerText = `${s.ip_private || s.host}${ipPublicText}`;
    document.getElementById("modal-os-info").innerText = `${s.os_version || s.os_type} [${s.env} 환경]`;
    document.getElementById("modal-location-info").innerText = s.location || '전산실 미지정';
    document.getElementById("modal-uptime-info").innerText = s.uptime_text || '-';

    // RAM Breakdown
    const ramDetailEl = document.getElementById("modal-ram-detail");
    if (ramDetailEl) {
      if (s.memory_total_gb > 0) {
        const freeGb = Math.max(0, (s.memory_total_gb - s.memory_used_gb)).toFixed(1);
        const memPercent = (s.memory_percent || 0).toFixed(1);
        const barClass = memPercent >= 90 ? 'danger' : (memPercent >= 70 ? 'warn' : 'normal');
        ramDetailEl.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;">
            <span>
              <strong>${s.memory_used_gb} GB</strong> 사용 중 / 전체 <strong>${s.memory_total_gb} GB</strong>
              <span style="color: var(--text-dim); margin-left: 8px;">(여유 공간: ${freeGb} GB)</span>
            </span>
            <span style="font-family: var(--font-mono); font-weight: 700; color: #fff;">${memPercent}%</span>
          </div>
          <div class="progress-track" style="height: 8px;">
            <div class="progress-fill ${barClass}" style="width: ${Math.min(memPercent, 100)}%;"></div>
          </div>
        `;
      } else {
        ramDetailEl.innerHTML = `
          <div style="font-size: 0.8rem; color: var(--text-dim);">
            에이전트가 아직 세부 RAM 용량(GB)을 보고하지 않았습니다. (현재 사용률: ${(s.memory_percent || 0).toFixed(1)}%)
          </div>
        `;
      }
    }

    // Drives Breakdown
    const drivesList = document.getElementById("modal-drives-list");
    if (s.disk_details && s.disk_details.length > 0) {
      drivesList.innerHTML = s.disk_details.map(d => {
        const pct = d.percent || 0;
        const barClass = pct >= 90 ? 'danger' : (pct >= 70 ? 'warn' : 'normal');
        return `
          <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
              <span><strong>${escapeHtml(d.name)}</strong> 드라이브 (총 ${d.total_gb}GB 중 ${d.used_gb}GB 사용)</span>
              <span style="font-family: var(--font-mono); font-weight: 700; color: #fff;">${pct}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${barClass}" style="width: ${Math.min(pct, 100)}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      drivesList.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-dim);">에이전트로부터 수집된 상세 드라이브 정보가 아직 없습니다.</div>`;
    }

    // Ports Status
    const portsList = document.getElementById("modal-ports-list");
    if (s.ports && s.ports.length > 0) {
      portsList.innerHTML = s.ports.map(p => `
        <div class="port-badge ${p.status === 'open' ? 'open' : 'closed'}" style="padding: 6px 12px; font-size: 0.8rem;">
          <i class="fa-solid fa-circle" style="font-size: 6px;"></i>
          <strong>${p.service_name}</strong> (${p.port_number}) : 
          ${p.status === 'open' ? `열림 [${p.latency_ms || 1.0}ms]` : '연결 실패'}
        </div>
      `).join('');
    } else {
      portsList.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-dim);">등록된 포트가 없습니다.</span>`;
    }

    // Remote Action Box
    const remoteBox = document.getElementById("modal-remote-action-box");
    const targetHost = s.ip_private || s.host;
    if (isWin) {
      remoteBox.innerHTML = `
        <a href="/api/servers/${s.id}/rdp" class="btn btn-primary btn-sm">
          <i class="fa-solid fa-desktop"></i> Windows RDP 연결 파일 다운로드
        </a>
        <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('mstsc /v:${targetHost}:${s.primary_port || 3389}'); showToast('mstsc 실행 명령어가 복사되었습니다.', 'success');">
          <i class="fa-solid fa-copy"></i> mstsc 명령어 복사
        </button>
      `;
    } else {
      remoteBox.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="copySshCommand('${targetHost}', ${s.primary_port || 22})">
          <i class="fa-solid fa-terminal"></i> SSH 접속 명령어 복사 (ssh user@${targetHost})
        </button>
      `;
    }

    // Agent Install Script Snippets
    const testEl = document.getElementById("agent-command-test");
    const schedEl = document.getElementById("agent-command-sched");
    const currentHostUrl = window.location.origin;

    if (isWin) {
      if (testEl) {
        testEl.innerText = `Invoke-WebRequest -Uri "${currentHostUrl}/agents/agent_windows.ps1" -OutFile "$env:TEMP\\agent_windows.ps1" -UseBasicParsing; powershell.exe -ExecutionPolicy Bypass -File "$env:TEMP\\agent_windows.ps1" -DashboardUrl "${currentHostUrl}/api/agent/report" -ServerId ${s.id} -AgentToken "${s.agent_token}"`;
      }
      if (schedEl) {
        schedEl.innerText = `$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -Command \\"Invoke-WebRequest -Uri '${currentHostUrl}/agents/agent_windows.ps1' -OutFile 'C:\\agent_windows.ps1' -UseBasicParsing; & 'C:\\agent_windows.ps1' -DashboardUrl '${currentHostUrl}/api/agent/report' -ServerId ${s.id} -AgentToken '${s.agent_token}'\\"";
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1);
Register-ScheduledTask -TaskName "OpsPulse_${s.id}" -Action $Action -Trigger $Trigger -User "SYSTEM" -Force`;
      }
    } else {
      if (testEl) {
        testEl.innerText = `curl -s "${currentHostUrl}/agents/agent_linux.sh" | bash -s "${currentHostUrl}/api/agent/report" ${s.id} "${s.agent_token}"`;
      }
      if (schedEl) {
        schedEl.innerText = `(crontab -l 2>/dev/null; echo "* * * * * curl -s \\"${currentHostUrl}/agents/agent_linux.sh\\" | bash -s \\"${currentHostUrl}/api/agent/report\\" ${s.id} \\"${s.agent_token}\\" >/dev/null 2>&1") | crontab -`;
      }
    }

    openModal("detail-modal");
  } catch (err) {
    console.error(err);
    showToast("서버 상세 정보를 불러오지 못했습니다.", "danger");
  }
}

// Open Add Modal
function openAddModal() {
  const form = document.getElementById("add-server-form");
  if (form) form.reset();
  const idInput = document.getElementById("form-server-id");
  if (idInput) idInput.value = "";

  const titleEl = document.getElementById("modal-form-title");
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-server" style="color: var(--accent-blue);"></i> 신규 서버 등록`;
  }
  const submitBtn = document.getElementById("btn-submit-server");
  if (submitBtn) {
    submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> 서버 등록 완료`;
  }
  openModal("add-modal");
}

// Open Edit Modal with Pre-filled Server Data
async function openEditModal(serverId) {
  try {
    const res = await fetch(`/api/servers/${serverId}`);
    if (!res.ok) throw new Error("서버 정보를 불러올 수 없습니다.");
    const s = await res.json();

    const idInput = document.getElementById("form-server-id");
    if (idInput) idInput.value = s.id;

    document.getElementById("form-name").value = s.name || "";
    document.getElementById("form-host").value = s.host || "";
    document.getElementById("form-os-type").value = s.os_type || "linux";
    document.getElementById("form-os-version").value = s.os_version || "";
    document.getElementById("form-env").value = s.env || "PROD";
    document.getElementById("form-primary-port").value = s.primary_port || "";
    document.getElementById("form-ip-private").value = s.ip_private || "";
    document.getElementById("form-ip-public").value = s.ip_public || "";
    document.getElementById("form-location").value = s.location || "";
    document.getElementById("form-web-url").value = s.web_url || "";
    document.getElementById("form-desc").value = s.description || "";

    const titleEl = document.getElementById("modal-form-title");
    if (titleEl) {
      titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: var(--accent-cyan);"></i> 서버 정보 수정`;
    }
    const submitBtn = document.getElementById("btn-submit-server");
    if (submitBtn) {
      submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> 수정 내용 저장`;
    }

    closeModal("detail-modal");
    openModal("add-modal");
  } catch (err) {
    console.error(err);
    showToast("서버 정보를 불러오지 못했습니다.", "danger");
  }
}

// Save Server (Add or Edit Handler)
async function handleSaveServer(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("btn-submit-server");
  const origBtnHtml = submitBtn ? submitBtn.innerHTML : "저장";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...';
  }

  const idInput = document.getElementById("form-server-id");
  const serverId = idInput ? idInput.value : "";
  const isEdit = Boolean(serverId);

  const payload = {
    name: document.getElementById("form-name").value.trim(),
    host: document.getElementById("form-host").value.trim(),
    os_type: document.getElementById("form-os-type").value,
    os_version: document.getElementById("form-os-version").value.trim(),
    env: document.getElementById("form-env").value,
    primary_port: document.getElementById("form-primary-port").value ? parseInt(document.getElementById("form-primary-port").value) : null,
    ip_private: document.getElementById("form-ip-private").value.trim(),
    ip_public: document.getElementById("form-ip-public").value.trim(),
    location: document.getElementById("form-location").value.trim(),
    web_url: document.getElementById("form-web-url").value.trim(),
    description: document.getElementById("form-desc").value.trim()
  };

  try {
    const url = isEdit ? `/api/servers/${serverId}` : "/api/servers";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({ error: `서버 통신 오류 (HTTP ${res.status})` }));
    if (!res.ok) throw new Error(result.error || (isEdit ? "수정 실패" : "등록 실패"));

    // 모든 모달창 즉시 닫기
    closeModal("add-modal");
    closeModal("detail-modal");
    currentDetailServerId = null;

    showToast(isEdit ? `'${payload.name}' 서버 정보가 수정되었습니다.` : `'${payload.name}' 서버가 성공적으로 등록되었습니다.`, "success");
    fetchOverview();
    fetchServers();
  } catch (err) {
    showToast(err.message, "danger");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
    }
  }
}

// Health Check Single Server
async function checkSingleServer(serverId) {
  showToast("서버 상태 점검 중...", "info");
  try {
    const res = await fetch(`/api/servers/${serverId}/check`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error("점검 실패");

    showToast(`점검 완료: 상태 [${data.status}] (${data.latency_ms ? data.latency_ms + 'ms' : '포트 응답 없음'})`, data.status === 'online' ? "success" : "warning");
    fetchOverview();
    fetchServers(false);
    if (currentDetailServerId === serverId) {
      openServerDetail(serverId);
    }
  } catch (err) {
    showToast("상태 점검 중 오류가 발생했습니다.", "danger");
  }
}

// Health Check All
async function checkAllServers() {
  const btn = document.getElementById("btn-check-all");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 전체 점검 중...';

  try {
    const res = await fetch("/api/servers/check-all", { method: "POST" });
    const data = await res.json();
    showToast(`전체 ${data.count}대 서버 헬스체크가 완료되었습니다.`, "success");
    fetchOverview();
    fetchServers();
  } catch (err) {
    showToast("전체 점검 실패", "danger");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> 전체 즉시 점검';
  }
}

// Delete Server
async function deleteServer(serverId) {
  try {
    const res = await fetch(`/api/servers/${serverId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("삭제 실패");
    closeModal("detail-modal");
    showToast("서버가 성공적으로 삭제되었습니다.", "success");
    fetchOverview();
    fetchServers();
  } catch (err) {
    showToast("삭제 중 오류가 발생했습니다.", "danger");
  }
}

// Copy Helpers
function copySshCommand(host, port) {
  const cmd = `ssh root@${host} -p ${port}`;
  navigator.clipboard.writeText(cmd).then(() => {
    showToast(`SSH 명령어가 클립보드에 복사되었습니다: ${cmd}`, "success");
  });
}

function copyAgentSnippet() {
  const text = document.getElementById("agent-command-text").innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast("에이전트 실행 명령어가 클립보드에 복사되었습니다.", "success");
  });
}

// Modal Helpers
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add("active");
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove("active");
}

// Toast System
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";

  let icon = '<i class="fa-solid fa-circle-info" style="color: #60a5fa;"></i>';
  if (type === "success") icon = '<i class="fa-solid fa-circle-check" style="color: #34d399;"></i>';
  if (type === "warning") icon = '<i class="fa-solid fa-triangle-exclamation" style="color: #fbbf24;"></i>';
  if (type === "danger") icon = '<i class="fa-solid fa-circle-xmark" style="color: #f87171;"></i>';

  toast.innerHTML = `${icon} <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Copy Code Snippet Handler
function copySnippet(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.innerText || el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast("명령어가 클립보드에 복사되었습니다.", "success");
  }).catch(() => {
    showToast("복사에 실패했습니다.", "danger");
  });
}

// ==============================================================================
// Print Server Asset Report
// ==============================================================================
function printServerAssetReport() {
  if (!allServers || allServers.length === 0) {
    showToast("출력할 서버 목록이 없습니다.", "warning");
    return;
  }

  // Set date
  const now = new Date();
  const dateStr = now.getFullYear() + "년 " + 
    String(now.getMonth() + 1).padStart(2, '0') + "월 " + 
    String(now.getDate()).padStart(2, '0') + "일 " + 
    String(now.getHours()).padStart(2, '0') + ":" + 
    String(now.getMinutes()).padStart(2, '0');
  
  const tsEl = document.getElementById("print-timestamp");
  if (tsEl) tsEl.innerText = dateStr;

  // Set Summary Stats
  const onlineCount = allServers.filter(s => s.status === 'online').length;
  const warningCount = allServers.filter(s => s.status === 'warning').length;
  const offlineCount = allServers.filter(s => s.status === 'offline').length;
  const linuxCount = allServers.filter(s => s.os_type === 'linux').length;
  const windowsCount = allServers.filter(s => s.os_type === 'windows').length;

  document.getElementById("print-stat-total").innerText = allServers.length;
  document.getElementById("print-stat-online").innerText = onlineCount;
  document.getElementById("print-stat-warning").innerText = warningCount;
  document.getElementById("print-stat-offline").innerText = offlineCount;
  document.getElementById("print-stat-linux").innerText = linuxCount;
  document.getElementById("print-stat-windows").innerText = windowsCount;

  // Build Print Table Body
  const tbody = document.getElementById("print-table-body");
  tbody.innerHTML = allServers.map((s, idx) => {
    let statusBadge = '<span class="print-status-tag offline">장애(점검)</span>';
    if (s.status === 'online') statusBadge = '<span class="print-status-tag online">정상 가동</span>';
    else if (s.status === 'warning') statusBadge = '<span class="print-status-tag warning">주의 요망</span>';

    // Format disk details
    let diskText = (s.disk_percent || 0).toFixed(1) + '%';
    if (s.disk_details && Array.isArray(s.disk_details) && s.disk_details.length > 0) {
      diskText = s.disk_details.map(d => `${d.name} (${d.used_gb}G/${d.total_gb}G, ${d.percent}%)`).join(' / ');
    }

    const ipText = s.ip_private ? (s.ip_public ? `${s.ip_private} (공인: ${s.ip_public})` : s.ip_private) : (s.host || '-');
    const locText = [s.location, s.description].filter(Boolean).join(' - ') || '-';

    return `
      <tr>
        <td class="center">${idx + 1}</td>
        <td class="center">${statusBadge}</td>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.os_version || s.os_type)}</td>
        <td class="center"><span class="print-env-tag">${s.env}</span></td>
        <td style="font-family: monospace;">${escapeHtml(ipText)}</td>
        <td>${escapeHtml(locText)}</td>
        <td class="center" style="font-family: monospace;">${(s.cpu_percent || 0).toFixed(1)}%</td>
        <td class="center" style="font-family: monospace;">
          ${(s.memory_percent || 0).toFixed(1)}%
          ${s.memory_total_gb ? `<br><span style="font-size: 7.5pt; color: #666;">(${s.memory_used_gb}/${s.memory_total_gb}G)</span>` : ''}
        </td>
        <td style="font-size: 8pt;">${escapeHtml(diskText)}</td>
      </tr>
    `;
  }).join('');

  // Open browser print dialog
  setTimeout(() => {
    window.print();
  }, 100);
}

// ==============================================================================
// Export Servers to Excel (CSV with UTF-8 BOM)
// ==============================================================================
function exportServersToCsv() {
  if (!allServers || allServers.length === 0) {
    showToast("내보낼 서버 목록이 없습니다.", "warning");
    return;
  }

  const headers = [
    "No", "서버식별명", "상태", "OS구분", "OS상세버전", "환경", 
    "내부IP", "공인IP", "설치위치", "용도설명", 
    "CPU사용률(%)", "RAM사용률(%)", "대표디스크사용률(%)", "드라이브상세", 
    "대표포트", "가동시간", "최종확인일시"
  ];

  const rows = allServers.map((s, idx) => {
    let driveStr = "";
    if (s.disk_details && Array.isArray(s.disk_details)) {
      driveStr = s.disk_details.map(d => `${d.name}:${d.used_gb}GB/${d.total_gb}GB(${d.percent}%)`).join(';');
    }
    return [
      idx + 1,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      s.status || 'unknown',
      s.os_type || '',
      `"${(s.os_version || '').replace(/"/g, '""')}"`,
      s.env || '',
      `"${s.ip_private || s.host || ''}"`,
      `"${s.ip_public || ''}"`,
      `"${(s.location || '').replace(/"/g, '""')}"`,
      `"${(s.description || '').replace(/"/g, '""')}"`,
      (s.cpu_percent || 0).toFixed(1),
      s.memory_total_gb ? `"${(s.memory_percent || 0).toFixed(1)}% (${s.memory_used_gb}/${s.memory_total_gb}GB)"` : (s.memory_percent || 0).toFixed(1),
      (s.disk_percent || 0).toFixed(1),
      `"${driveStr.replace(/"/g, '""')}"`,
      s.primary_port || '',
      `"${(s.uptime_text || '').replace(/"/g, '""')}"`,
      `"${s.last_seen || ''}"`
    ].join(',');
  });

  const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const now = new Date();
  const filename = `전산실_서버자산대장_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.csv`;
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showToast("서버 자산 대장이 엑셀(CSV) 파일로 다운로드되었습니다.", "success");
}

