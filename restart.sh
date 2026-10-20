#!/bin/bash
# ========================================================
# OpsPulse (ServerManager) Container Restart & Rebuild Script
# ========================================================

export LC_ALL=C.UTF-8 2>/dev/null || export LANG=C.UTF-8 2>/dev/null

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================"
echo " [OpsPulse] 서비스 재빌드 및 재시작 시작..."
echo "========================================================"

if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker가 설치되어 있지 않거나 실행 중이 아닙니다."
    exit 1
fi

echo "[1/2] 소스 변경사항 반영하여 재빌드 및 컨테이너 시작 중..."

if docker compose version &> /dev/null 2>&1; then
    docker compose up -d --build --remove-orphans
elif command -v docker-compose &> /dev/null; then
    docker-compose up -d --build --remove-orphans
else
    echo "[ERROR] docker compose 명령어를 찾을 수 없습니다."
    exit 1
fi

echo ""
echo "[2/2] 컨테이너 가동 상태:"
if docker compose version &> /dev/null 2>&1; then
    docker compose ps
else
    docker-compose ps
fi

echo ""
echo "========================================================"
echo " [SUCCESS] OpsPulse 재시작이 완료되었습니다!"
echo " - 서비스 포트: 9500"
echo " - 실시간 로그 확인: docker compose logs -f"
echo "========================================================"