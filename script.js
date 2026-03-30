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

    loadingScreen.style.display = 'block';
    dialogueContainer.style.display = 'none';

    let progress = 0;
    const speed = 2;
    const animationDuration = 3500;
    const intervalTime = 20;
    const totalFrames = animationDuration / intervalTime;
    const increment = 100 / totalFrames;

    const startX = 25;
    const endX = 65;

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
            }
        }, intervalTime);
    }, 500);
}

async function initGame() {
    await DialogueEngine.loadStoryFile('dialogues/stories.json');

    document.getElementById('start-button').addEventListener('click', function() {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('game-content').style.display = 'block';

        runLoadingAnimation(() => {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('dialogue-container').style.display = 'block';
            
            DialogueEngine.start('intro');
        });
    });
}

initGame();

document.getElementById('dialogue-box').addEventListener('click', () => {
    DialogueEngine.next();
});