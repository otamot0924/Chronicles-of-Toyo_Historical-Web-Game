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

    start(storyId) {
        const story = this.allStories[storyId];
        document.getElementById('dialogue-container').style.display = 'block';
        if (story) {
            this.currentData = story;
            this.currentIndex = 0;
            this.updateUI();
        } else {
            console.error("找不到 ID 為 " + storyId + " 的劇情");
        }
    },

    updateUI() {
        const line = this.currentData[this.currentIndex];
        const displayElement = document.getElementById('dialogue-text');

        if (!line.name && !line.portrait) {
            document.getElementById('npc-name').innerText = '';
            document.getElementById('npc-portrait-container').style.display = 'none';
        }
        else {
            document.getElementById('npc-name').innerText = line.name;
            document.getElementById('npc-portrait-container').style.display = 'block';
            document.getElementById('npc-portrait').src = line.portrait;
        }

        this.typewriter(displayElement, line.text, 35);
    },

    typewriter(element, text, speed) {

        clearInterval(this.typewriterTimer);
        
        element.innerText = "";
        let charIndex = 0;

        this.typewriterTimer = setInterval(() => {
            if (charIndex < text.length) {
                element.innerText += text.charAt(charIndex);
                charIndex++;
            } else {
                clearInterval(this.typewriterTimer);
            }
        }, speed);
    },

    next() {
        const line = this.currentData[this.currentIndex];
        const displayElement = document.getElementById('dialogue-text');

        if (displayElement.innerText.length < line.text.length) {
            clearInterval(this.typewriterTimer);
            displayElement.innerText = line.text;
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
    const animationDuration = 5000;
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
    return requiredItems.every(rqItem => VisitedItems.includes(rqItem));
}

function handleItemInteraction(item) {
    VisitedItems.push(item.id);
    if (item.action == 'read_letter') {
        DialogueEngine.start(item.id);
    }
    else if (item.action == 'leave_scene') {
        // leave scene
        if (checkRequiredItems(item)) {
            DialogueEngine.start('leave')
            SceneManager.switch(item['next_scene'])
            fadeTransition()
        }
        else {
            DialogueEngine.start('leave_warning')
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
            this.allScenes = await response.json();
            console.log("場景載入成功！");
        } catch (error) {
            console.error("載入場景檔案時發生錯誤:", error);
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

async function initGame() {
    await DialogueEngine.loadStoryFile('dialogues/stories.json');
    await SceneManager.loadSceneFile('scenes/intro_room.json');
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