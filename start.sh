#!/bin/bash
# ============================================================
# 一键启动脚本 - 不笑挑战游戏
# 同时启动前端开发服务器 + 本地 API 模拟服务
# ============================================================

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 端口配置
FRONTEND_PORT=3000
API_PORT=1234

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}   不笑挑战游戏 - 一键启动${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# ---- 1. 检查 Node.js ----
if ! command -v node &> /dev/null; then
    echo -e "${RED}[错误] 未找到 Node.js，请先安装 Node.js${NC}"
    exit 1
fi
echo -e "${GREEN}[✓] Node.js $(node -v)${NC}"

# ---- 2. 检查/安装依赖 ----
cd "$PROJECT_DIR"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[!] 依赖未安装，正在安装...${NC}"
    npm install
    echo -e "${GREEN}[✓] 依赖安装完成${NC}"
else
    echo -e "${GREEN}[✓] 依赖已安装${NC}"
fi

# ---- 3. 检查端口占用 ----
check_port() {
    local port=$1
    if lsof -i :$port -sTCP:LISTEN &> /dev/null; then
        echo -e "${YELLOW}[!] 端口 $port 已被占用，尝试释放...${NC}"
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

check_port $FRONTEND_PORT
check_port $API_PORT

# ---- 4. 启动本地 API 服务 (端口 1234) ----
echo -e "${CYAN}[启动] 本地 API 模拟服务 (端口 $API_PORT)...${NC}"
cd "$PROJECT_DIR"
node -e "
const http = require('http');

// 加载云函数模块
const { audience, judge } = require('${PROJECT_DIR}/cloud-function/prompts.js');

const SILENCE_KEYWORDS = ['过', '嗯', '知道了', '下一个', '……'];

// 模拟 AI 观众反应
function mockAudienceReaction(sceneDesc, level) {
    const reactions = [
        '哈哈哈哈笑死我了！',
        '这也太搞笑了吧🤣',
        '我不行了哈哈哈哈',
        '主播你是认真的吗😂',
        '笑不活了家人们',
        '？？？？？？',
        '666666',
        '太抽象了',
        '绷不住了',
        '绝了',
    ];
    // 高难度下更容易沉默
    if (level >= 4 && Math.random() < 0.4) return '';
    return reactions[Math.floor(Math.random() * reactions.length)];
}

// 模拟 AI 裁判评分
function mockJudgeScore(reaction, level) {
    const isSilence = !reaction || reaction.length <= 2;
    if (isSilence) {
        return { funny_score: Math.floor(Math.random() * 3) + 1, reason: '观众没什么反应...' };
    }
    const score = Math.floor(Math.random() * 5) + 5;
    const reasons = [
        '观众笑得很开心！',
        '效果不错，继续加油！',
        '有几位观众被逗乐了',
        '弹幕反响热烈',
        '观众参与度很高',
    ];
    return { funny_score: score, reason: reasons[Math.floor(Math.random() * reasons.length)] };
}

const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { sceneDesc, level } = JSON.parse(body);
                const difficulty = Math.min(5, Math.max(1, Number(level) || 1));
                const reaction = mockAudienceReaction(sceneDesc || '表演', difficulty);
                const isSilence = !reaction || SILENCE_KEYWORDS.includes(reaction) || reaction.length <= 2;
                const { funny_score, reason } = mockJudgeScore(reaction, difficulty);

                const sseBody = [
                    'data: ' + reaction,
                    'data: [REACTION_DONE]',
                    'data: ' + JSON.stringify({ reaction, funnyScore: funny_score, reason, isSilence }),
                ].join('\n\n');

                res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
                res.end(sseBody);
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

server.listen($API_PORT, '127.0.0.1', () => {
    console.log('  API 服务已启动: http://127.0.0.1:$API_PORT');
});
" &

API_PID=$!
sleep 1

# ---- 5. 启动前端开发服务器 (端口 3000) ----
echo -e "${CYAN}[启动] Vite 前端开发服务器 (端口 $FRONTEND_PORT)...${NC}"
npx vite --port $FRONTEND_PORT --host &
VITE_PID=$!

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   全部服务已启动！${NC}"
echo -e "${GREEN}   前端: http://localhost:$FRONTEND_PORT${NC}"
echo -e "${GREEN}   API:  http://localhost:$API_PORT${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止所有服务${NC}"

# ---- 6. 清理函数 ----
cleanup() {
    echo ""
    echo -e "${YELLOW}正在停止服务...${NC}"
    kill $VITE_PID 2>/dev/null || true
    kill $API_PID 2>/dev/null || true
    # 确保端口释放
    lsof -ti :$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti :$API_PORT | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}服务已停止${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ---- 7. 等待子进程 ----
wait
