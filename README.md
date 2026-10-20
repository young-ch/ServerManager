# OpsPulse - 통합 서버 관제 시스템 (Server Operations Center)

리눅스(Linux) 및 윈도우 서버(Windows Server)가 혼재된 전산실/클라우드 인프라를 웹에서 한눈에 통합 관리하고 모니터링하는 전문 관제 시스템입니다.

---

## 🌟 주요 특징

1. **하이브리드 환경 지원 (Linux & Windows Server)**
   - **Linux**: Ubuntu, CentOS, Rocky Linux, Debian, RHEL 등 (SSH, HTTP/S, DB, Rsync 감시)
   - **Windows Server**: Windows Server 2016, 2019, 2022 (RDP, SMB, IIS, MSSQL 감시)

2. **2가지 모니터링 방식 동시 지원**
   - **Agentless 방식 (설치 불필요)**: 대시보드가 중앙에서 주기적으로 TCP 포트(22, 3389, 80 등) 응답 및 지연시간(Latency)을 측정하여 가동 여부 판별.
   - **경량 Agent 연동 방식 (상세 모니터링)**: 
     - Windows용: 순수 PowerShell 스크립트 1개 (별도 설치 프로그램 없음)
     - Linux용: 순수 Bash 스크립트 1개 (curl 기반)
     - 실시간 CPU%, 메모리%, 드라이브별 잔여량(C:, D:, /, /data), Uptime 자동 수집.

3. **신속한 원격 접속 편의 기능**
   - **Windows**: 원클릭 `.rdp` 접속 파일 다운로드 및 `mstsc /v:IP:포트` 복사
   - **Linux**: 터미널용 `ssh user@IP -p 포트` 원클릭 복사

4. **실시간 관제 대시보드 UI**
   - 어두운 관제 센터 스타일 (Dark Glassmorphism)
   - OS별, 환경별(운영, 개발, 인프라), 상태별(정상, 경고, 장애) 실시간 필터링 및 검색
   - 15초 자동 갱신 및 일시정지 기능

---

## 🚀 빠른 시작 방법

### 1. 관제 웹 사이트 실행
Windows 탐색기에서 `run.bat`을 더블 클릭하거나 콘솔에서 아래 명령을 실행합니다:
```bash
cd server_manager
python app.py
```
브라우저에서 `http://localhost:5000`으로 접속합니다.

### 2. 관리 대상 서버 등록
1. 우측 상단 **[➕ 신규 서버 등록]** 클릭
2. 서버명, IP, OS 종류(Linux / Windows), 환경(운영/개발 등), 주요 포트 입력 후 저장

### 3. 실시간 리소스(CPU/RAM/디스크) 연동 스크립트
대시보드에서 서버 카드의 **[상세 관제]**를 누르면 하단에 전용 1줄 명령어가 생성됩니다:

- **Windows Server**: PowerShell(관리자 권한)에서 실행
- **Linux Server**: 터미널에서 실행 (crontab에 `* * * * *` 등록 시 1분마다 자동 보고)
