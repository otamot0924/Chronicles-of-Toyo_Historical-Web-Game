async function fadeTransition(callback, duration = 500) {
    const mask = document.getElementById('scene-transition-mask');

    mask.classList.add('active');

    await new Promise(resolve => setTimeout(resolve, 800));
    if (callback) callback();
    await new Promise(resolve => setTimeout(resolve, duration));

    mask.classList.remove('active');
}

const DialogueEngine = {
    allStories: {},
    currentData: [],
    currentIndex: 0,
    typewriterTimer: null,
    onEnd: null,

    isTyping: false,
    currentTextChars: [],

    async loadStoryFile(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("無法讀取劇情檔案");
            this.allStories = await response.json();
            console.log("劇情載入成功！");
        } catch (error) {
            console.error("錯誤:", error);
        }
    },

    start(storyId, onComplete = null) {
        const story = this.allStories[storyId];

        document.getElementById('dialogue-container').style.display = 'block';
        this.onEnd = typeof onComplete === 'function' ? onComplete : null;

        if (story) {
            this.currentData = story;
            this.currentIndex = 0;
            this.updateUI();
        } else {
            console.error("找不到 ID 為 " + storyId + " 的劇情");
        }
    },

    parseRichText(text) {
        const chars = [];
        let isGold = false;
        let i = 0;
        while (i < text.length) {
            if (text.substring(i, i + 3) === "[g]") {
                isGold = true;
                i += 3;
            } else if (text.substring(i, i + 4) === "[/g]") {
                isGold = false;
                i += 4;
            } else {
                chars.push({ char: text.charAt(i), isGold: isGold });
                i++;
            }
        }
        return chars;
    },

    updateUI() {
        const line = this.currentData[this.currentIndex];
        
        if (!line.name && !line.portrait) {
            document.getElementById('npc-name').innerText = '';
            document.getElementById('npc-portrait-container').style.display = 'none';
        } else {
            document.getElementById('npc-name').innerText = line.name;
            document.getElementById('npc-portrait-container').style.display = 'block';
            document.getElementById('npc-portrait').src = line.portrait;
        }

        const displayElement = document.getElementById('dialogue-text');
        
        this.currentTextChars = this.parseRichText(line.text);
        this.typewriter(displayElement, this.currentTextChars, 30); // 30毫秒一字
    },

    typewriter(element, chars, speed) {
        clearInterval(this.typewriterTimer);
        element.innerHTML = ''; // 改用 innerHTML
        let charIndex = 0;
        this.isTyping = true;

        this.typewriterTimer = setInterval(() => {
            if (charIndex < chars.length) {
                const c = chars[charIndex];
                if (c.isGold) {
                    element.innerHTML += `<span class="dialogue-gold">${c.char}</span>`;
                } else {
                    element.innerHTML += c.char;
                }
                charIndex++;
            } else {
                clearInterval(this.typewriterTimer);
                this.isTyping = false;
            }
        }, speed);
    },

    getLineHTML(chars) {
        return chars.map(c => c.isGold ? `<span class="dialogue-gold">${c.char}</span>` : c.char).join('');
    },

    next() {
        const displayElement = document.getElementById('dialogue-text');

        if (this.isTyping) {
            clearInterval(this.typewriterTimer);
            this.isTyping = false;
            displayElement.innerHTML = this.getLineHTML(this.currentTextChars);
        } else {
            this.currentIndex++;
            if (this.currentIndex < this.currentData.length) {
                this.updateUI();
            } else {
                this.end();
            }
        }
    },

    end() {
        console.log("對話結束");
        document.getElementById('dialogue-container').style.display = 'none';
        if (this.onEnd) this.onEnd();
    }
};

function runLoadingAnimation(callback) {
    const loadingScreen = document.getElementById('loading-screen');
    const movingImg = document.getElementById('loading-bar-moving-img');
    const dialogueContainer = document.getElementById('dialogue-container');
    const loadingBar = document.getElementById('loading-bar');

    loadingScreen.style.display = 'block';
    dialogueContainer.style.display = 'none';

    let progress = 0;
    const animationDuration = 3000;
    const intervalTime = 20;
    const totalFrames = animationDuration / intervalTime;
    const increment = 100 / totalFrames;

    const startX = 35;
    const endX = 55;

    setTimeout(() => {
        const timer = setInterval(() => {
            progress += increment;

            if (progress >= 100) {
                clearInterval(timer);
                setTimeout(() => {
                    callback();
                }, 1000);
            } else {
                const currentX = startX + (endX - startX) * (progress / 100);
                movingImg.style.left = `${currentX}%`;
                loadingBar.style.width = `${progress}%`;
            }
        }, intervalTime);
    }, 500);
}

let VisitedItems = []

function renderSceneItems(scene) {
    const itemLayer = document.getElementById('item-layer');
    itemLayer.innerHTML = '';

    scene.items.forEach(item => {
        const img = document.createElement('img');
        img.src = item.image;
        img.className = 'interactive-item';

        img.style.top = item.top;
        img.style.left = item.left;
        img.style.width = item.width;

        DevTool.init(img, item)

        img.onclick = () => {
            handleItemInteraction(item);
        }

        itemLayer.appendChild(img);
    });
}

function checkRequiredItems(item) {
    const requiredItems = item['required_items'];
    if (!requiredItems || DevSceneTeleporter.enabled) {
        return true;
    }
    return requiredItems.every(rqItem => VisitedItems.includes(rqItem));
}

async function handleItemInteraction(item) {
    VisitedItems.push(item.id);
    if (item.action == 'read') {
        DialogueEngine.start(item.id);
    }
    else if (item.action == 'leave_scene' || item.action == 'enter') {
        if (checkRequiredItems(item)) {

            if (item['leave_dialogue']) {
                await new Promise(resolve => DialogueEngine.start(item['leave_dialogue'], resolve)); // start leave scene dialogue
            }
            
            await fadeTransition(() => {
                SceneManager.switch(item['next_scene'] || item.id); // switch scene
            }, 500);
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (item['next_dialogue']) {
                DialogueEngine.start(item['next_dialogue'] || item.id); // start scene init dialogue
            }

        }
        else {
            if (item['leave_warning']) {
                DialogueEngine.start(item['leave_warning']);
            }
        }
    }
}

const SceneManager = {
    allScenes: {},
    currentScene: null,

    async loadSceneFile(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("無法讀取場景檔案");
            const sceneData = await response.json();
            this.allScenes = { ...this.allScenes, ...sceneData };
            console.log("場景載入成功！", url);
        } catch (error) {
            console.error("載入場景檔案時發生錯誤:", error);
        }
    },

    async loadSceneIndex(indexUrl) {
        try {
            const response = await fetch(indexUrl);
            if (!response.ok) throw new Error("無法讀取場景索引檔案");
            const indexData = await response.json();
            const sceneFiles = indexData.files || [];
            const folder = indexUrl.substring(0, indexUrl.lastIndexOf('/') + 1);

            const loadedScenes = await Promise.all(sceneFiles.map(async (filename) => {
                const sceneResponse = await fetch(folder + filename);
                if (!sceneResponse.ok) throw new Error("無法讀取場景檔案: " + filename);
                const data = await sceneResponse.json();
                
                // ✨ 新增：標註這組場景來自哪個 JSON 檔案 (章節)
                Object.keys(data).forEach(sceneId => {
                    data[sceneId]._fromFile = filename;
                });
                return data;
            }));

            // 合併所有場景
            this.allScenes = loadedScenes.reduce((acc, scene) => ({ ...acc, ...scene }), {});
            console.log("所有場景載入完成，共計:", Object.keys(this.allScenes).length);

            // ✨ 重要：資料載入完成後，叫跳轉工具更新選單內容
            if (window.DevSceneTeleporter) {
                DevSceneTeleporter.updateMenu();
            }
        } catch (error) {
            console.error("載入場景索引檔案時發生錯誤:", error);
        }
    },

    switch(sceneId) {
        const scene = this.allScenes[sceneId];
        this.currentScene = scene;
        document.getElementById('scene-container').style.backgroundImage = `url(${this.currentScene['image']})`;
        
        if (scene['right']) {
            document.getElementById('scene-right-button').style.display = 'block';
        } else {
            document.getElementById('scene-right-button').style.display = 'none';
        }
        if (scene['left']) {
            document.getElementById('scene-left-button').style.display = 'block';
        } else {
            document.getElementById('scene-left-button').style.display = 'none';
        }

        renderSceneItems(scene);
    },

    right() {
        if (this.currentScene && this.currentScene['right']) {
            this.switch(this.currentScene['right']);
            document.getElementById('scene-container').style.backgroundImage = `url(${this.currentScene['image']})`;
        }
    },

    left() {
        if (this.currentScene && this.currentScene['left']) {
            this.switch(this.currentScene['left']);
            document.getElementById('scene-container').style.backgroundImage = `url(${this.currentScene['image']})`;
        }
    },

    back() {
        if (this.currentScene && this.currentScene['back']) {
            this.switch(this.currentScene['back']);
            document.getElementById('scene-container').style.backgroundImage = `url(${this.currentScene['image']})`;
        }
    }
}

// --- 開發者工具模組 ---
const DevTool = {
    enabled: false, // 設為 true 開啟功能
    selectedItem: null,
    isDragging: false,
    startX: 0,
    startY: 0,

    init(itemElement, itemData) {
        if (!this.enabled) return;

        // 滑鼠按下：開始拖曳
        itemElement.addEventListener('mousedown', (e) => {
            this.selectedItem = itemElement;
            this.isDragging = true;
            
            // 計算點擊位置相對於圖片左上角的偏移
            const rect = itemElement.getBoundingClientRect();
            this.offsetX = e.clientX - rect.left;
            this.offsetY = e.clientY - rect.top;
            
            itemElement.style.zIndex = 1000; // 拖曳時置頂
            e.preventDefault();
        });

        // 滑鼠移動：更新位置
        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging || !this.selectedItem) return;

            const container = document.getElementById('scene-container');
            const containerRect = container.getBoundingClientRect();

            // 計算滑鼠在容器內的百分比位置
            let leftPercent = ((e.clientX - containerRect.left - this.offsetX) / containerRect.width) * 100;
            let topPercent = ((e.clientY - containerRect.top - this.offsetY) / containerRect.height) * 100;

            this.selectedItem.style.left = leftPercent.toFixed(2) + '%';
            this.selectedItem.style.top = topPercent.toFixed(2) + '%';
        });

        // 滑鼠放開：停止拖曳並印出數值
        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.printStatus();
            }
        });
    },

    // 處理鍵盤縮放 (+ 與 -)
    handleKeyPress(e) {
        if (!this.enabled || !this.selectedItem) return;

        // 取得目前寬度百分比
        let currentWidth = parseFloat(this.selectedItem.style.width);
        
        if (e.key === '=' || e.key === '+') { // 加號
            currentWidth += 0.5;
        } else if (e.key === '-' || e.key === '_') { // 減號
            currentWidth -= 0.5;
        }

        if (currentWidth > 0) {
            this.selectedItem.style.width = currentWidth.toFixed(2) + '%';
            this.printStatus();
        }
    },

    // 在控制台印出當前座標與大小，方便你複製到 JSON
    printStatus() {
        if (!this.selectedItem) return;
        const id = this.selectedItem.getAttribute('data-id');
        const left = this.selectedItem.style.left;
        const top = this.selectedItem.style.top;
        const width = this.selectedItem.style.width;

        console.log(`%c [道具更新] ID: ${id} `, 'background: #222; color: #bada55; padding: 2px 5px;');
        console.log(`JSON 配置: "left": "${left}", "top": "${top}", "width": "${width}"`);
    }
};

// --- 開發者跳關工具 ---
const DevSceneTeleporter = {
    enabled: false,

    init() {
        if (!this.enabled || document.getElementById('dev-teleport-tool')) return;

        const container = document.createElement('div');
        container.id = 'dev-teleport-tool';
        container.innerHTML = `
            <div style="color: #f5af2d; font-size: 12px; font-weight: bold; margin-bottom: 5px;">DEBUG: 跳轉章節</div>
            <select id="dev-scene-select" style="width: 100%; margin-bottom: 5px; background: #222; color: #fff;"></select>
            <button id="dev-teleport-btn" style="width: 100%; background: #f5af2d; border: none; cursor: pointer;">立即跳轉</button>
        `;
        
        // 基本樣式設定 (建議移到 CSS)
        Object.assign(container.style, {
            position: 'fixed', top: '10px', right: '10px', zIndex: '9999',
            background: 'rgba(0,0,0,0.8)', padding: '10px', border: '1px solid #f5af2d', borderRadius: '5px'
        });

        document.body.appendChild(container);
        this.updateMenu();

        document.getElementById('dev-teleport-btn').onclick = () => {
            const selectedScene = document.getElementById('dev-scene-select').value;
            this.teleport(selectedScene);
        };
    },

    updateMenu() {
        const select = document.getElementById('dev-scene-select');
        if (!select) return;
        
        select.innerHTML = '';
        
        // 按檔案名稱 (章節) 進行分組
        const groups = {};
        Object.entries(SceneManager.allScenes).forEach(([id, data]) => {
            const fileName = data._fromFile || "其他";
            if (!groups[fileName]) groups[fileName] = [];
            groups[fileName].push(id);
        });

        // 生成帶有 <optgroup> 的選單
        for (const [fileName, ids] of Object.entries(groups)) {
            const group = document.createElement('optgroup');
            group.label = `章節: ${fileName}`;
            ids.forEach(id => {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = id;
                group.appendChild(opt);
            });
            select.appendChild(group);
        }
    },

    async teleport(sceneId) {
        console.log("正在跳轉至:", sceneId);
        // 如果有淡入淡出遮罩就用，沒有就直接切換
        if (typeof fadeTransition === 'function') {
            await fadeTransition(() => SceneManager.switch(sceneId));
        } else {
            SceneManager.switch(sceneId);
        }
    }
};

async function initGame() {
    await DialogueEngine.loadStoryFile('dialogues/stories.json');
    await SceneManager.loadSceneIndex('scenes/index.json');

    // 初始化開發者工具
    DevSceneTeleporter.init();

    document.getElementById('start-button').addEventListener('click', function() {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('game-content').style.display = 'block';

        runLoadingAnimation(async () => {
            SceneManager.switch('room_front');
            await fadeTransition(() => {
                document.getElementById('loading-screen').style.display = 'none';
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            DialogueEngine.start('intro');
        });
    });
}

initGame();

document.getElementById('dialogue-box').addEventListener('click', () => {
    DialogueEngine.next();
});

document.getElementById('scene-right-button').addEventListener('click', () => {
    SceneManager.right();
});

document.getElementById('scene-left-button').addEventListener('click', () => {
    SceneManager.left();
});

// for testing
// 監聽鍵盤事件
window.addEventListener('keydown', (e) => DevTool.handleKeyPress(e));