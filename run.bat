@echo off
chcp 65001 > nul
title OpsPulse - 통합 서버 관제 시스템
echo ========================================================
echo   OpsPulse - 통합 서버 모니터링 & 관제 대시보드
echo ========================================================
echo.
echo [1/2] 가동 환경 확인 중...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [오류] Python이 설치되어 있지 않거나 PATH에 등록되지 않았습니다.
    pause
    exit /b 1
)

echo [2/2] 서버 관제 센터 기동 중 (포트: 9500)...
echo 브라우저에서 아래 주소로 접속하세요:
echo http://localhost:9500
echo.
python app.py
pause
