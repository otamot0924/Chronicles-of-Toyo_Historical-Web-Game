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

        img.onclick = () => {
            handleItemInteraction(item);
        }

        itemLayer.appendChild(img);
    });
}

function handleItemInteraction(item) {
    if (item.action == 'read_letter') {
        DialogueEngine.start(item.id);
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
document.getElementById('scene-container').addEventListener('click', (e) => {
    const x = (e.offsetX / e.target.clientWidth) * 100;
    const y = (e.offsetY / e.target.clientHeight) * 100;
    console.log(`位置建議 -> left: ${x.toFixed(2)}%, top: ${y.toFixed(2)}%`);
});