FROM python:3.11-slim

WORKDIR /app

# 타임존 및 환경 설정
ENV TZ=Asia/Seoul
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=utf-8
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV OPSPULSE_PORT=9500

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스코드 복사
COPY . .

# 관제 기본 포트
EXPOSE 9500

# 앱 실행
CMD ["python", "app.py"]
