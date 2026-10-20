#!/bin/bash
# ========================================================
# OpsPulse (ServerManager) ì»¨í…Œ?´ë„ˆ ?¬ì‹œ??& ?¬ë°°???¤í¬ë¦½íŠ¸
# ?ŒìŠ¤ì½”ë“œ ë³€ê²??????¤í¬ë¦½íŠ¸ ?˜ë‚˜ë§??¤í–‰?˜ë©´ ?ë™ ?¬ë¹Œ??& ?¬ì‹œ?‘ë©?ˆë‹¤.
# ========================================================

# ?¤í¬ë¦½íŠ¸ê°€ ?„ì¹˜???”ë ‰? ë¦¬ë¡??´ë™
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================"
echo " [OpsPulse] ?œë¹„???¬ë¹Œ??ë°??¬ì‹œ?‘ì„ ì§„í–‰?©ë‹ˆ??.."
echo "========================================================"

# 1. Docker ?¤ì¹˜ ?¬ë? ?•ì¸
if ! command -v docker &> /dev/null; then
    echo "??[?¤ë¥˜] Dockerê°€ ?¤ì¹˜?˜ì–´ ?ˆì? ?Šê±°??PATH???†ìŠµ?ˆë‹¤."
    exit 1
fi

# 2. docker compose ëª…ë ¹?´ë¡œ ?´ë?ì§€ ?¬ë¹Œ??ë°?ë°±ê·¸?¼ìš´???¬ì‹œ??echo "?“¦ [1/2] ?ŒìŠ¤ ë³€ê²½ì‚¬??ë°˜ì˜?˜ì—¬ ?¬ë¹Œ??ë°?ì»¨í…Œ?´ë„ˆ ?œì‘ ì¤?.."

if docker compose version &> /dev/null 2>&1; then
    docker compose up -d --build --remove-orphans
elif command -v docker-compose &> /dev/null; then
    docker-compose up -d --build --remove-orphans
else
    echo "??[?¤ë¥˜] docker compose ?ëŠ” docker-compose ëª…ë ¹?´ë? ì°¾ì„ ???†ìŠµ?ˆë‹¤."
    exit 1
fi

# 3. ì»¨í…Œ?´ë„ˆ ?íƒœ ?•ì¸
echo ""
echo "?” [2/2] ì»¨í…Œ?´ë„ˆ ê°€???íƒœ ?•ì¸:"
if docker compose version &> /dev/null 2>&1; then
    docker compose ps
else
    docker-compose ps
fi

echo ""
echo "========================================================"
echo " ??OpsPulse ?¬ì‹œ?‘ì´ ?„ë£Œ?˜ì—ˆ?µë‹ˆ??"
echo " ?Œ ?œë¹„???¬íŠ¸: 9500"
echo " ?“œ ë¡œê·¸ ?¤ì‹œê°??•ì¸ ëª…ë ¹?? docker compose logs -f"
echo "========================================================"
