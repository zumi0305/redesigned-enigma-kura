<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>完全版チャット</title>
    <style>
        body { font-family: sans-serif; background: #f4f4f9; padding: 20px; }
        #chat-container { max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 8px; }
        #messages { height: 300px; overflow-y: scroll; border: 1px solid #ddd; padding: 10px; list-style: none; }
        .mentioned { background: #fff3cd; }
        #poll-section { background: #e7f3ff; padding: 10px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>

<div id="chat-container">
    <h2>チャットルーム</h2>
    <div id="poll-section">
        <h3>投票を作成</h3>
        <input id="poll-q" placeholder="質問内容">
        <input id="poll-o" placeholder="選択肢(カンマ区切り)">
        <button onclick="createPoll()">投票開始</button>
        <div id="poll-display"></div>
    </div>
    <ul id="messages"></ul>
    <form id="form">
        <input id="username" placeholder="名前" maxlength="8">
        <input id="message-input" placeholder="メッセージ" maxlength="50">
        <input id="command-input" type="password" placeholder="Admin Code">
        <button>送信</button>
    </form>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
    const socket = io();
    let currentRoom = '一般ロビー';

    // 読み込み時名前復元
    window.onload = () => { username.value = localStorage.getItem('chat_name') || ''; };
    username.oninput = () => localStorage.setItem('chat_name', username.value);

    function createPoll() {
        socket.emit('create poll', { room: currentRoom, question: pollQ.value, options: pollO.value.split(',') });
    }

    socket.on('poll update', (poll) => {
        let html = `<h4>${poll.question}</h4>`;
        poll.options.forEach((opt, i) => {
            html += `<button onclick="vote(${i})">${opt}</button>`;
        });
        pollDisplay.innerHTML = html;
    });

    function vote(idx) { socket.emit('vote', { room: currentRoom, optionIndex: idx }); }

    form.onsubmit = (e) => {
        e.preventDefault();
        const text = messageInput.value;
        if(text.startsWith('/')) {
            const [cmd, arg] = text.split(' ');
            socket.emit('admin command', { command: cmd.replace('/',''), arg, secret: commandInput.value });
        } else {
            socket.emit('chat message', { name: username.value, text, room: currentRoom });
        }
        messageInput.value = '';
    };

    socket.on('chat message', (data) => {
        const li = document.createElement('li');
        li.textContent = `${data.name}: ${data.text}`;
        if(data.text.includes(`@${username.value}`)) li.className = 'mentioned';
        messages.appendChild(li);
    });
</script>
</body>
</html>
