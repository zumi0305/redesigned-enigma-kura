<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>オンラインチャットルーム</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f4f4f9; }
        #chat-container { max-width: 650px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        #status-bar { font-size: 14px; margin-bottom: 10px; color: #666; display: flex; justify-content: space-between; align-items: center; }
        #online-count { font-weight: bold; color: #28a745; }
        
        #room-section { margin-bottom: 15px; display: flex; gap: 10px; align-items: center; background: #e9ecef; padding: 10px; border-radius: 6px; }
        
        #poll-section { background: #e7f3ff; padding: 10px; margin-bottom: 10px; border-radius: 6px; border: 1px solid #bce8f1; font-size: 14px; }
        #poll-section input { padding: 6px; font-size: 13px; border: 1px solid #ddd; border-radius: 4px; margin-right: 5px; }
        .poll-options-container button { margin: 3px; padding: 6px 10px; background: #17a2b8; font-size: 13px; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .poll-options-container button:hover { background: #138496; }

        #messages { list-style-type: none; padding: 0; height: 320px; overflow-y: scroll; border: 1px solid #ddd; margin-bottom: 10px; padding: 10px; background: #fff; }
        #messages li { padding: 6px 10px; border-bottom: 1px solid #eee; word-break: break-all; }
        
        .mentioned { background: #fff3cd !important; border-left: 4px solid #ffc107; }

        form { display: flex; flex-direction: column; gap: 10px; }
        .input-row { display: flex; gap: 10px; }
        input[type="text"], select { padding: 10px; font-size: 14px; border: 1px solid #ddd; border-radius: 4px; }
        #username { width: 30%; }
        #message-input { flex: 1; }

        .custom-options { display: flex; gap: 10px; align-items: center; font-size: 14px; }
        .form-bottom { display: flex; justify-content: space-between; align-items: center; }
        #char-count { font-size: 12px; color: #666; }
        
        button { padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        
        .system-msg { color: #888; font-style: italic; }
        .error-msg { color: #ff4757; font-weight: bold; }
    </style>
</head>
<body>

    <div id="chat-container">
        <h2>オンラインチャットルーム</h2>
        
        <div id="room-section">
            <label for="room-select">部屋:</label>
            <select id="room-select"></select>
            <input type="text" id="new-room-input" placeholder="新しい部屋名" maxlength="15" />
            <button type="button" id="create-room-btn">部屋を作成</button>
        </div>

        <div id="poll-section">
            <b>📊 投票:</b>
            <div id="poll-creator" style="margin-top: 5px;">
                <input type="text" id="poll-q" placeholder="質問内容" style="width: 40%;" />
                <input type="text" id="poll-o" placeholder="選択肢(カンマ区切り)" style="width: 40%;" />
                <button type="button" id="create-poll-btn" style="padding: 6px 10px; font-size: 13px;">作成</button>
            </div>
            <div id="poll-display" style="margin-top: 8px;">現在投票はありません。</div>
        </div>

        <div id="status-bar">
            <div><span>身分: 一般ユーザー</span></div>
            <div><span>オンライン: <span id="online-count">0</span>人</span></div>
        </div>

        <ul id="messages"></ul>

        <form id="form">
            <div class="input-row">
                <input id="username" type="text" placeholder="名前 (8文字まで)" maxlength="8" required autocomplete="off" />
                <input id="message-input" type="text" placeholder="メッセージ (50文字まで)" maxlength="50" required autocomplete="off" />
            </div>
            
            <div class="custom-options">
                <label>文字色: 
                    <select id="text-color">
                        <option value="#333333">黒（標準）</option>
                        <option value="#007bff">青</option>
                        <option value="#28a745">緑</option>
                        <option value="#dc3545">赤</option>
                        <option value="#6f42c1">紫</option>
                    </select>
                </label>
                <label>肩書: 
                    <select id="badge-type">
                        <option value="">なし</option>
                        <option value="🌟 [VIP]">🌟 VIP</option>
                        <option value="☕ [常連]">☕ 常連</option>
                        <option value="🎮 [ゲーマー]">🎮 ゲーマー</option>
                    </select>
                </label>
            </div>

            <div class="form-bottom">
                <span id="char-count">残り文字数: 50</span>
                <button id="send-btn">送信</button>
            </div>
        </form>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();

        const form = document.getElementById('form');
        const usernameInput = document.getElementById('username');
        const messageInput = document.getElementById('message-input');
        const messages = document.getElementById('messages');
        const charCount = document.getElementById('char-count');
        const onlineCountElem = document.getElementById('online-count');
        const sendBtn = document.getElementById('send-btn');
        const roomSelect = document.getElementById('room-select');
        const newRoomInput = document.getElementById('new-room-input');
        const createRoomBtn = document.getElementById('create-room-btn');
        
        const textColorSelect = document.getElementById('text-color');
        const badgeTypeSelect = document.getElementById('badge-type');

        const pollQ = document.getElementById('poll-q');
        const pollO = document.getElementById('poll-o');
        const createPollBtn = document.getElementById('create-poll-btn');
        const pollDisplay = document.getElementById('poll-display');

        let isCooldown = false;
        let currentRoom = '一般ロビー';

        window.addEventListener('DOMContentLoaded', () => {
            const savedName = localStorage.getItem('chat_username');
            if (savedName) {
                usernameInput.value = savedName;
            }
        });

        usernameInput.addEventListener('input', () => {
            localStorage.setItem('chat_username', usernameInput.value.trim());
        });

        messageInput.addEventListener('input', () => {
            const currentLength = messageInput.value.length;
            const remaining = 50 - currentLength;
            charCount.textContent = `残り文字数: ${remaining}`;
        });

        socket.on('room list', (rooms) => {
            roomSelect.innerHTML = '';
            rooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room;
                option.textContent = room;
                if (room === currentRoom) option.selected = true;
                roomSelect.appendChild(option);
            });
        });

        roomSelect.addEventListener('change', (e) => {
            currentRoom = e.target.value;
            messages.innerHTML = '';
            pollDisplay.innerHTML = '現在投票はありません。';
            socket.emit('join room', currentRoom);
        });

        createRoomBtn.addEventListener('click', () => {
            const roomName = newRoomInput.value.trim();
            if (roomName) {
                socket.emit('create room', roomName);
                newRoomInput.value = '';
            }
        });

        createPollBtn.addEventListener('click', () => {
            const question = pollQ.value.trim();
            const optionsText = pollO.value.trim();
            if (!question || !optionsTest) {
                alert('質問と選択肢を入力してください');
                return;
            }
            const options = optionsText.split(',').map(o => o.trim()).filter(o => o);
            socket.emit('create poll', { room: currentRoom, question, options });
            pollQ.value = '';
            pollO.value = '';
        });

        socket.on('poll update', (poll) => {
            let html = `<b>Q. ${poll.question}</b><div class="poll-options-container" style="margin-top:5px;">`;
            
            let voteCounts = new Array(poll.options.length).fill(0);
            let totalVotes = 0;
            for (let socketId in poll.votes) {
                let optIdx = poll.votes[socketId];
                if (voteCounts[optIdx] !== undefined) {
                    voteCounts[optIdx]++;
                    totalVotes++;
                }
            }

            poll.options.forEach((opt, idx) => {
                let count = voteCounts[idx];
                html += `<button type="button" onclick="castVote(${idx})">${opt} (${count}票)</button> `;
            });
            html += `</div><div style="font-size:12px; color:#666; margin-top:3px;">総投票数: ${totalVotes}票</div>`;
            pollDisplay.innerHTML = html;
        });

        function castVote(optionIndex) {
            socket.emit('vote', { room: currentRoom, optionIndex });
        }

        socket.on('init history', (history) => {
            messages.innerHTML = '';
            history.forEach(data => addMessageToUI(data));
        });

        socket.on('online count', (count) => {
            onlineCountElem.textContent = count;
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            if (isCooldown) {
                alert('連続投稿はできません。少し待ってください。');
                return;
            }

            const rawName = usernameInput.value.trim();
            const text = messageInput.value.trim();

            if (!text || !rawName) return;

            const nameRegex = /^[a-zA-Z0-9ぁ-んァ-ンー一-龥Ａ-Ｚａ-ｚ０-９ー＿・ﾞﾟーｰ]+$/;
            if (!nameRegex.test(rawName)) {
                alert('名前には絵文字や特殊なUnicode文字、紛らわしい文字は使用できません。');
                return;
            }

            if (rawName.length > 8) {
                alert('名前は8文字以内で入力してください。');
                return;
            }

            if (text.length > 50) {
                alert('メッセージは50文字以内で入力してください。');
                return;
            }

            const data = {
                name: rawName,
                text: text,
                isAdmin: false,
                color: textColorSelect.value,
                badge: badgeTypeSelect.value,
                room: currentRoom
            };

            socket.emit('chat message', data);

            messageInput.value = '';
            charCount.textContent = '残り文字数: 50';
            startCooldown();
        });

        function startCooldown() {
            isCooldown = true;
            sendBtn.disabled = true;
            let countdown = 3;
            sendBtn.textContent = `${countdown}秒待機`;

            const timer = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    sendBtn.textContent = `${countdown}秒待機`;
                } else {
                    clearInterval(timer);
                    isCooldown = false;
                    sendBtn.disabled = false;
                    sendBtn.textContent = '送信';
                }
            }, 1000);
        }

        socket.on('chat message', (data) => {
            addMessageToUI(data);
        });

        socket.on('clear messages', (data) => {
            messages.innerHTML = '';
            appendSystemMessage('【管理人がこの部屋の履歴を消去しました】');
        });

        socket.on('admin error', (data) => {
            appendErrorMessage(data.message);
        });

        function addMessageToUI(data) {
            const item = document.createElement('li');
            const badgeStr = data.badge ? data.badge + ' ' : '';
            
            item.textContent = `${badgeStr}${data.name}: ${data.text}`;
            
            if (data.color) {
                item.style.color = data.color;
            }

            const myName = usernameInput.value.trim();
            if (myName && data.text.includes(`@${myName}`)) {
                item.classList.add('mentioned');
            }

            messages.appendChild(item);
            messages.scrollTop = messages.scrollHeight;
        }

        function appendSystemMessage(text) {
            const item = document.createElement('li');
            item.className = 'system-msg';
            item.textContent = text;
            messages.appendChild(item);
            messages.scrollTop = messages.scrollHeight;
        }

        function appendErrorMessage(text) {
            const item = document.createElement('li');
            item.className = 'error-msg';
            item.textContent = text;
            messages.appendChild(item);
            messages.scrollTop = messages.scrollHeight;
        }

        socket.emit('join room', currentRoom);
    </script>
</body>
</html>
