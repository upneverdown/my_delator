document.addEventListener('DOMContentLoaded', () => {
    const ROWS = 8;
    const COLS = 8;
    const TILE_SIZE = 60; // 包含间距
    const EMOJIS = ['🐱', '🐶', '🐼', '🦊'];
    
    const boardEl = document.getElementById('board');
    const scoreEl = document.getElementById('score');
    const comboTextEl = document.getElementById('comboText');

    let board = []; // 二维数组，存储 tile 对象
    let selected = null; // 当前选中的坐标 {r, c}
    let isAnimating = false;
    let score = 0;
    let combo = 0;

    // 初始化棋盘数据
    function initBoard() {
        board = [];
        for (let r = 0; r < ROWS; r++) {
            board[r] = [];
            for (let c = 0; c < COLS; c++) {
                let emoji;
                // 确保初始化时没有 3 连
                do {
                    emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
                } while (
                    (c >= 2 && board[r][c-1].emoji === emoji && board[r][c-2].emoji === emoji) ||
                    (r >= 2 && board[r-1][c].emoji === emoji && board[r-2][c].emoji === emoji)
                );
                
                const tile = createTileData(r, c, emoji);
                board[r][c] = tile;
                boardEl.appendChild(tile.element);
            }
        }
    }

    // 创建方块数据与 DOM
    function createTileData(r, c, emoji) {
        const el = document.createElement('div');
        el.className = 'tile';
        el.textContent = emoji;
        el.dataset.row = r;
        el.dataset.col = c;
        
        const tile = { emoji, row: r, col: c, element: el };
        updateTilePosition(tile);
        return tile;
    }

    // 更新方块 DOM 位置
    function updateTilePosition(tile) {
        tile.element.style.top = `${tile.row * TILE_SIZE + 2}px`;
        tile.element.style.left = `${tile.col * TILE_SIZE + 2}px`;
        tile.element.dataset.row = tile.row;
        tile.element.dataset.col = tile.col;
    }

    // 交互逻辑
    boardEl.addEventListener('click', (e) => {
        if (isAnimating) return;
        const tileEl = e.target.closest('.tile');
        if (!tileEl || tileEl.classList.contains('melt')) return;
        
        const r = parseInt(tileEl.dataset.row);
        const c = parseInt(tileEl.dataset.col);
        
        if (!selected) {
            selected = { r, c };
            tileEl.classList.add('selected');
        } else {
            const prev = selected;
            const prevEl = document.querySelector('.tile.selected');
            if(prevEl) prevEl.classList.remove('selected');
            selected = null;
            
            if (prev.r === r && prev.c === c) {
                return; // 点击同一个，取消选中
            }
            
            if (isAdjacent(prev.r, prev.c, r, c)) {
                trySwap(prev.r, prev.c, r, c);
            } else {
                // 点击不相邻的，重新选中新的
                selected = { r, c };
                tileEl.classList.add('selected');
            }
        }
    });

    // 判断是否相邻
    function isAdjacent(r1, c1, r2, c2) {
        return (Math.abs(r1 - r2) === 1 && c1 === c2) || (Math.abs(c1 - c2) === 1 && r1 === r2);
    }

    // 尝试交换
    async function trySwap(r1, c1, r2, c2) {
        isAnimating = true;
        
        // 交换数据
        swapData(r1, c1, r2, c2);
        updateTilePosition(board[r1][c1]);
        updateTilePosition(board[r2][c2]);
        
        await sleep(300); // 等待滑动动画
        
        const matches = findMatches();
        if (matches.length > 0) {
            combo = 0;
            await processMatches(matches);
        } else {
            // 没有匹配，换回原位
            swapData(r1, c1, r2, c2);
            updateTilePosition(board[r1][c1]);
            updateTilePosition(board[r2][c2]);
            await sleep(300);
        }
        
        isAnimating = false;
    }

    // 交换数据引用
    function swapData(r1, c1, r2, c2) {
        const temp = board[r1][c1];
        board[r1][c1] = board[r2][c2];
        board[r2][c2] = temp;
        
        if (board[r1][c1]) {
            board[r1][c1].row = r1;
            board[r1][c1].col = c1;
        }
        if (board[r2][c2]) {
            board[r2][c2].row = r2;
            board[r2][c2].col = c2;
        }
    }

    // 查找所有匹配 (支持 3连、4连、5连)
    function findMatches() {
        const matched = new Set();
        
        // 水平匹配
        for (let r = 0; r < ROWS; r++) {
            let c = 0;
            while (c < COLS) {
                let end = c;
                while (end + 1 < COLS && board[r][end+1] && board[r][c] && board[r][end+1].emoji === board[r][c].emoji) {
                    end++;
                }
                if (end - c >= 2) {
                    for (let i = c; i <= end; i++) matched.add(`${r},${i}`);
                }
                c = end + 1;
            }
        }
        
        // 垂直匹配
        for (let c = 0; c < COLS; c++) {
            let r = 0;
            while (r < ROWS) {
                let end = r;
                while (end + 1 < ROWS && board[end+1][c] && board[r][c] && board[end+1][c].emoji === board[r][c].emoji) {
                    end++;
                }
                if (end - r >= 2) {
                    for (let i = r; i <= end; i++) matched.add(`${i},${c}`);
                }
                r = end + 1;
            }
        }
        
        return Array.from(matched).map(str => {
            const [r, c] = str.split(',').map(Number);
            return { r, c };
        });
    }

    // 处理匹配、消除与掉落
    async function processMatches(matches) {
        combo++;
        updateScore(matches.length * 10 * combo);
        showCombo(combo);
        
        // 1. 播放消除动画
        matches.forEach(({r, c}) => {
            board[r][c].element.classList.add('melt');
        });
        await sleep(300);
        
        // 2. 移除 DOM 和数据
        matches.forEach(({r, c}) => {
            board[r][c].element.remove();
            board[r][c] = null;
        });
        
        // 3. 掉落与补位
        for (let c = 0; c < COLS; c++) {
            let emptyRow = ROWS - 1;
            // 现有方块下落
            for (let r = ROWS - 1; r >= 0; r--) {
                if (board[r][c] !== null) {
                    if (r !== emptyRow) {
                        board[emptyRow][c] = board[r][c];
                        board[r][c] = null;
                        board[emptyRow][c].row = emptyRow;
                        updateTilePosition(board[emptyRow][c]);
                    }
                    emptyRow--;
                }
            }
            
            // 顶部生成新方块
            let dropCount = 0;
            for (let r = emptyRow; r >= 0; r--) {
                dropCount++;
                const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
                const newTile = createTileData(r, c, emoji);
                board[r][c] = newTile;
                
                // 设置初始位置在棋盘上方，准备掉落
                newTile.element.style.transition = 'none';
                newTile.element.style.top = `${-dropCount * TILE_SIZE + 2}px`;
                boardEl.appendChild(newTile.element);
                
                // 强制重绘后恢复过渡动画
                newTile.element.offsetHeight; 
                newTile.element.style.transition = '';
                updateTilePosition(newTile);
            }
        }
        
        await sleep(400); // 等待掉落动画完成
        
        // 4. 检查连锁 (Combo)
        const newMatches = findMatches();
        if (newMatches.length > 0) {
            await processMatches(newMatches);
        }
    }

    // 更新分数
    function updateScore(points) {
        score += points;
        scoreEl.textContent = score;
    }

    // 显示 Combo 提示
    function showCombo(combo) {
        if (combo > 1) {
            comboTextEl.textContent = `🌟 ${combo} Combo! 🌟`;
            comboTextEl.classList.add('show');
            setTimeout(() => comboTextEl.classList.remove('show'), 1000);
        } else {
            comboTextEl.textContent = '';
        }
    }

    // 休眠函数，用于控制动画节奏
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 启动游戏
    initBoard();
});