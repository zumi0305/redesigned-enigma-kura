const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

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
const ADMIN_SECRET = '0305';

// 投票用データ { roomName: { question: "", options: [], votes: {} } }
let polls = {};

io.on('connection', (socket) => {
    onlineCount++;
    io.emit('online count', onlineCount);

    socket.on('join room', (roomName) => {
        socket.join(roomName);
        socket.emit('init history', roomHistories[roomName] || []);
        if (polls[roomName]) socket.emit('poll update', polls[roomName]);
    });

    socket.on('chat message', (data) => {
        if (timeouts[socket.id] && Date.now() < timeouts[socket.id]) return;
        userNames[socket.id] = data.name;
        
        for (let word of ngWords) if (data.text.includes(word)) return;

        const room = data.room || '一般ロビー';
        if (!roomHistories[room]) roomHistories[room] = [];
        roomHistories[room].push(data);
        io.to(room).emit('chat message', data);
    });

    // 投票関連
    socket.on('create poll', (data) => {
        polls[data.room] = { question: data.question, options: data.options, votes: {} };
        io.to(data.room).emit('poll update', polls[data.room]);
    });

    socket.on('vote', (data) => {
        if (!polls[data.room]) return;
        polls[data.room].votes[socket.id] = data.optionIndex;
        io.to(data.room).emit('poll update', polls[data.room]);
    });

    socket.on('admin command', (data) => {
        if (data.secret !== ADMIN_SECRET) return;
        if (data.command === 'timeout') {
            for (let [id, name] of Object.entries(userNames)) {
                if (name === data.arg) { timeouts[id] = Date.now() + (30 * 60 * 1000); break; }
            }
        } else if (data.command === 'announce') {
            for (let r in roomHistories) {
                const msg = { name: '【管理人】', text: data.arg, isAdmin: true, color: '#ff4757', badge: '📢' };
                roomHistories[r].push(msg);
                io.to(r).emit('chat message', msg);
            }
        }
    });

    socket.on('disconnect', () => { onlineCount--; io.emit('online count', onlineCount); });
});

server.listen(3000, () => console.log('Server running on port 3000'));
