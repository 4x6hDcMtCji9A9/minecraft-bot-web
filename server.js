const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mineflayer = require('mineflayer');
const schedule = require('node-schedule');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));
app.use(express.json());

const MAX_BOTS = 10;
const bots = new Array(MAX_BOTS).fill(null);
const botConfigs = new Array(MAX_BOTS).fill(null).map((_, i) => ({
    id: i, name: `Bot_${i + 1}`, host: 'localhost', port: 25565,
    username: `Bot_NPC_${i + 1}`, version: '1.20.1', auth: 'offline', connected: false
}));

const chatHistories = new Array(MAX_BOTS).fill(null).map(() => []);

// Agendamento /survival
schedule.scheduleJob('50 0 * * *', () => sendSurvivalToAllBots('00:50'));
schedule.scheduleJob('50 12 * * *', () => sendSurvivalToAllBots('12:50'));

function sendSurvivalToAllBots(timeLabel) {
    let sent = 0;
    for (let i = 0; i < MAX_BOTS; i++) {
        if (bots[i] && botConfigs[i].connected) {
            try {
                bots[i].chat('/survival');
                addChatMessage(i, '🤖 AUTO', `/survival [${timeLabel}]`, 'survival');
                sent++;
            } catch (e) {}
        }
    }
    io.emit('survivalBroadcast', { time: timeLabel, sentCount: sent, totalBots: MAX_BOTS });
}

// Enviar comando personalizado para todos
function sendCommandToAllBots(command) {
    let sent = 0;
    for (let i = 0; i < MAX_BOTS; i++) {
        if (bots[i] && botConfigs[i].connected) {
            try {
                bots[i].chat(command);
                addChatMessage(i, '⌨️ COMANDO', command, 'command');
                sent++;
            } catch (e) {
                addChatMessage(i, '❌ ERRO', `Falha: ${e.message}`, 'error');
            }
        }
    }
    io.emit('commandBroadcast', { command, sentCount: sent, totalBots: MAX_BOTS });
    return sent;
}

function createBot(botId, config) {
    if (bots[botId]) { try { bots[botId].end(); } catch (e) {} }

    const bot = mineflayer.createBot({
        host: config.host, port: parseInt(config.port),
        username: config.username, version: config.version, auth: config.auth
    });

    bot.botId = botId;
    bots[botId] = bot;
    botConfigs[botId] = { ...config, id: botId, connected: true };

    bot.on('spawn', () => {
        addChatMessage(botId, '✅ SISTEMA', `${config.username} entrou no servidor`, 'spawn');
        io.emit('botStatus', { botId, connected: true, username: config.username });
    });

    bot.on('chat', (username, message) => {
        if (username === config.username) return;
        addChatMessage(botId, username, message, 'chat');
        
        if (message.includes(config.username)) {
            const responses = ['...', 'Hmm?', '🧍 Sou uma estátua', 'Use /survival!'];
            const resp = responses[Math.floor(Math.random() * responses.length)];
            setTimeout(() => { 
                try { 
                    bot.chat(resp);
                    addChatMessage(botId, config.username, resp, 'sent');
                } catch (e) {} 
            }, 1000);
        }
    });

    bot.on('death', () => addChatMessage(botId, '💀 DEATH', `${config.username} morreu!`, 'death'));
    
    bot.on('chat:death', (deathMsg) => {
        addChatMessage(botId, '💀 DEATH', deathMsg.toString(), 'death');
    });

    bot.on('kicked', (reason) => {
        const msg = typeof reason === 'string' ? reason : JSON.stringify(reason);
        addChatMessage(botId, '🚫 KICK', `Kickado: ${msg}`, 'kick');
        io.emit('botStatus', { botId, connected: false });
        botConfigs[botId].connected = false;
        bots[botId] = null;
    });

    bot.on('error', (err) => {
        addChatMessage(botId, '❌ ERRO', err.message, 'error');
        botConfigs[botId].connected = false;
        bots[botId] = null;
    });

    bot.on('end', (reason) => {
        addChatMessage(botId, '🔌 DISCONNECT', `Desconectado: ${reason || 'Desconhecido'}`, 'disconnect');
        io.emit('botStatus', { botId, connected: false });
        botConfigs[botId].connected = false;
        bots[botId] = null;
    });

    bot.on('health', () => {
        if (bot.health <= 5) {
            addChatMessage(botId, '❤️ HEALTH', `Vida baixa: ${Math.round(bot.health)}`, 'health');
        }
    });

    return bot;
}

function addChatMessage(botId, username, message, type = 'system') {
    const chatData = { 
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
        username, message, type 
    };
    chatHistories[botId].push(chatData);
    if (chatHistories[botId].length > 500) chatHistories[botId].shift();
    io.emit('chatMessage', { botId, ...chatData });
}

// API Routes
app.post('/api/bots/:botId/connect', (req, res) => {
    const botId = parseInt(req.params.botId);
    if (botId < 0 || botId >= MAX_BOTS) return res.status(400).json({ error: 'ID inválido' });
    try {
        createBot(botId, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/bots/:botId/disconnect', (req, res) => {
    const botId = parseInt(req.params.botId);
    if (bots[botId]) {
        addChatMessage(botId, '🔌 SISTEMA', 'Desconectado manualmente', 'disconnect');
        bots[botId].end();
        bots[botId] = null;
        botConfigs[botId].connected = false;
        io.emit('botStatus', { botId, connected: false });
        res.json({ success: true });
    } else {
        res.json({ error: 'Bot offline' });
    }
});

app.post('/api/bots/:botId/survival', (req, res) => {
    const botId = parseInt(req.params.botId);
    if (bots[botId]) {
        bots[botId].chat('/survival');
        addChatMessage(botId, '🤖 MANUAL', '/survival', 'survival');
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Bot offline' });
    }
});

app.post('/api/bots/survival-all', (req, res) => {
    let sent = 0;
    for (let i = 0; i < MAX_BOTS; i++) {
        if (bots[i]) {
            try {
                bots[i].chat('/survival');
                addChatMessage(i, '🤖 MANUAL', '/survival [TODOS]', 'survival');
                sent++;
            } catch (e) {}
        }
    }
    res.json({ success: true, sentCount: sent, total: MAX_BOTS });
});

// NOVA ROTA: Comando personalizado para todos
app.post('/api/bots/command-all', (req, res) => {
    const { command } = req.body;
    if (!command || !command.trim()) {
        return res.status(400).json({ error: 'Comando vazio' });
    }
    const sent = sendCommandToAllBots(command.trim());
    res.json({ success: true, command, sentCount: sent, totalBots: MAX_BOTS });
});

// NOVA ROTA: Limpar histórico de chat
app.post('/api/bots/clear-all-chat', (req, res) => {
    for (let i = 0; i < MAX_BOTS; i++) {
        chatHistories[i] = [];
    }
    io.emit('clearAllChat');
    res.json({ success: true, message: 'Chat limpo em todos os bots' });
});

app.post('/api/bots/:botId/chat', (req, res) => {
    const botId = parseInt(req.params.botId);
    const { message } = req.body;
    if (bots[botId] && message) {
        bots[botId].chat(message);
        addChatMessage(botId, botConfigs[botId].username, message, 'sent');
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Bot offline' });
    }
});

app.get('/api/bots/status', (req, res) => {
    res.json(botConfigs.map((c, i) => ({
        id: i, username: c.username, connected: bots[i] !== null
    })));
});

app.get('/api/bots/:botId/chat', (req, res) => {
    res.json(chatHistories[parseInt(req.params.botId)] || []);
});

io.on('connection', (socket) => {
    socket.emit('allBotsStatus', botConfigs.map((c, i) => ({
        botId: i, connected: bots[i] !== null, username: c.username
    })));
    socket.emit('allChatHistories', chatHistories);
    
    socket.on('sendMessage', (data) => {
        const { botId, message } = data;
        if (bots[botId] && message && message.trim()) {
            bots[botId].chat(message);
            addChatMessage(botId, botConfigs[botId].username, message, 'sent');
        }
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🧍 Bot ESTÁTUA rodando na porta ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log('⏰ /survival: 00:50 e 12:50');
    console.log('⌨️ Comando personalizado para todos');
    console.log('🗑️ Limpar chat geral');
});
