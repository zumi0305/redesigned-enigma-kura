const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const readline = require('readline');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let roomHistories = { '一般ロビー': [] };
let rooms = ['一般ロビー'];
let onlineCount = 0;
let userNames = {};
let timeouts = {};
let ngWords = ['死ね', 'バカ', 'アホ'];
let polls = {};

// 黒い画面（ターミナル）からの入力を受け取る設定
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('--- 管理人用ターミナルコマンド ---');
console.log('  clear [部屋名]           : 指定した部屋の履歴を消去（例: clear 一般ロビー）');
console.log('  timeout [ユーザー名]     : 指定したユーザーを30分間タイムアウト');
console.log('  addNG [言葉]             : NGワードを追加');
console.log('  announce [アナウンス文]  : 全ルームにアナウンスを送信');
console.log('------------------------------------');

rl.on('line', (line) => {
    const args = line.trim().split(' ');
    const cmd = args[0];
    const target = args.slice(1).join(' ');

    if (cmd === 'clear') {
        const roomName = target || '一般ロビー';
        if (roomHistories[roomName]) {
            roomHistories[roomName] = [];
            io.to(roomName).emit('clear messages', { name: '【管理人】' });
            console.log(`[成功] 部屋「${roomName}」の履歴を消去しました。`);
        } else {
            console.log(`[エラー] 部屋「${roomName}」が見つかりません。`);
        }
    } else if (cmd === 'timeout') {
        const targetName = target;
        let targetSocketId = null;

        for (let [id, name] of Object.entries(userNames)) {
            if (name === targetName) {
                targetSocketId = id;
                break;
            }
        }

        if (targetSocketId) {
            timeouts[targetSocketId] = Date.now() + (30 * 60 * 1000);
            io.to(targetSocketId).emit('admin error', { message: '【システム】あなたは管理人によって30分間タイムアウトされました。' });
            console.log(`[成功] ユーザー「${targetName}」を30分間タイムアウトしました。`);
        } else {
            console.log(`[エラー] ユーザー「${targetName}」が見つかりませんでした（現在チャットに接続していないか、名前が違います）。`);
        }
    } else if (cmd === 'addNG') {
        if (target && !ngWords.includes(target)) {
            ngWords.push(target);
            console.log(`[成功] NGワード「${target}」を追加しました。`);
        }
    } else if (cmd === 'announce') {
        if (target) {
            const announceData = {
                name: '【管理人アナウンス】',
                text: target,
                isAdmin: true,
                color: '#ff4757',
                badge: '📢'
            };
            for (let r in roomHistories) {
                roomHistories[r].push(announceData);
                io.to(r).emit('chat message', announceData);
            }
            console.log('[成功] 全ルームにアナウンスを送信しました。');
        }
    } else if (line.trim() !== '') {
        console.log('[不明なコマンド] clear, timeout, addNG, announce が使えます。');
    }
});

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました');
    onlineCount++;
    io.emit('online count', onlineCount);

    socket.emit('room list', rooms);

    socket.on('join room', (roomName) => {
        socket.join(roomName);
        socket.emit('init history', roomHistories[roomName] || []);
        if (polls[roomName]) {
            socket.emit('poll update', polls[roomName]);
        }
    });

    socket.on('create room', (roomName) => {
        if (!rooms.includes(roomName)) {
            rooms.push(roomName);
            roomHistories[roomName] = [];
            io.emit('room list', rooms);
        }
    });

    socket.on('chat message', (data) => {
        if (timeouts[socket.id] && Date.now() < timeouts[socket.id]) {
            socket.emit('admin error', { message: '【エラー】現在タイムアウト中のためメッセージを送信できません。' });
            return;
        }

        const nameRegex = /^[a-zA-Z0-9ぁ-んァ-ンー一-龥Ａ-Ｚａ-ｚ０-９ー＿・ﾞﾟーｰ]+$/;
        if (!data.name || !nameRegex.test(data.name) || data.name.length > 8) {
            socket.emit('admin error', { message: '【エラー】名前に使用できない文字が含まれているか、長すぎます（8文字まで）。' });
            return;
        }

        userNames[socket.id] = data.name;

        if (!data.text || data.text.length > 50) return;

        for (let word of ngWords) {
            if (data.text.includes(word)) {
                socket.emit('admin error', { message: '【エラー】NGワードが含まれているため送信できません。' });
                return;
            }
        }

        const room = data.room || '一般ロビー';
        if (!roomHistories[room]) {
            roomHistories[room] = [];
        }

        roomHistories[room].push(data);
        if (roomHistories[room].length > 100) {
            roomHistories[room].shift();
        }

        io.to(room).emit('chat message', data);
    });

    socket.on('create poll', (data) => {
        const room = data.room || '一般ロビー';
        polls[room] = {
            question: data.question,
            options: data.options,
            votes: {}
        };
        io.to(room).emit('poll update', polls[room]);
    });

    socket.on('vote', (data) => {
        const room = data.room || '一般ロビー';
        if (!polls[room]) return;
        polls[room].votes[socket.id] = data.optionIndex;
        io.to(room).emit('poll update', polls[room]);
    });

    socket.on('disconnect', () => {
        console.log('ユーザーが切断しました');
        onlineCount--;
        if (onlineCount < 0) onlineCount = 0;
        io.emit('online count', onlineCount);
        delete userNames[socket.id];
        delete timeouts[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
