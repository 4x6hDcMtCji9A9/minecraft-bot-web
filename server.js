const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mineflayer = require('mineflayer');
const schedule = require('node-schedule');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));
app.use(express.json());

const MAX_BOTS = 10;
const bots = new Array(MAX_BOTS).fill(null);
const botConfigs = new Array(MAX_BOTS).fill(null).map((_, i) => ({
    id: i,
    name: `Bot_${i + 1}`,
    host: 'localhost',
    port: 25565,
    username: `Bot_NPC_${i + 1}`,
    version: '1.20.1',
    auth: 'offline',
    connected: false
}));

const chatHistories = new Array(MAX_BOTS).fill(null).map(() => []);

// ============ AGENDAMENTO /survival ============
console.log('⏰ Configurando /survival automático...');

// 🌙 03:30 (madrugada)
schedule.scheduleJob('30 3 * * *', () => {
    console.log('🌙 [03:30] Enviando /survival para todos...');
    sendSurvivalToAllBots('03:30');
});

// ☀️ 15:30 (tarde)
schedule.scheduleJob('30 15 * * *', () => {
    console.log('☀️ [15:30] Enviando /survival para todos...');
    sendSurvivalToAllBots('15:30');
});

function sendSurvivalToAllBots(timeLabel) {
    let sent = 0;
    for (let i = 0; i < MAX_BOTS; i++) {
        if (bots[i] && botConfigs[i].connected) {
            try {
                bots[i].chat('/survival');
                addChatMessage(i, '🤖 AUTO', `/survival [${timeLabel}]`, 'survival');
                sent++;
            } catch (e) {
                console.error(`❌ Bot ${i + 1}: ${e.message}`);
            }
        }
    }
    console.log(`📊 /survival enviado para ${sent}/${MAX_BOTS} bots`);
    io.emit('survivalBroadcast', { time: timeLabel, sentCount: sent, totalBots: MAX_BOTS });
}

// Função para enviar comando personalizado para todos
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

console.log('✅ Agendamentos configurados:');
console.log('   🌙 03:30 - /survival (madrugada)');
console.log('   ☀️ 15:30 - /survival (tarde)');
console.log('🧍 Modo: ESTÁTUA (sem movimento de cabeça)');
console.log('📋 Eventos: Chat, Mortes, Survival, Erros, Sistema');
console.log('❌ Join/Leave removidos');

// ============ FUNÇÕES DO BOT ============

function createBot(botId, config) {
    if (bots[botId]) {
        try { bots[botId].end(); } catch (e) {}
    }

    const bot = mineflayer.createBot({
        host: config.host,
        port: parseInt(config.port),
        username: config.username,
        version: config.version,
        auth: config.auth
    });

    bot.botId = botId;
    bots[botId] = bot;
    botConfigs[botId] = { ...config, id: botId, connected: true };

    // ============ SPAWN ============
    bot.on('spawn', () => {
        console.log(`✅ Bot ${botId + 1} (${config.username}) ONLINE`);
        addChatMessage(botId, '✅ SISTEMA', `${config.username} entrou no servidor`, 'spawn');
        io.emit('botStatus', { botId, connected: true, username: config.username });
    });

    // ============ CHAT NORMAL ============
    bot.on('chat', (username, message) => {
        if (username === config.username) return;
        addChatMessage(botId, username, message, 'chat');
        
        // Respostas NPC
        if (message.includes(config.username)) {
            const responses = [
                '...', 'Hmm?', 'Zzz...',
                '🧍 Sou uma estátua, não me movo',
                'Use /survival para jogar!',
                'Estou apenas observando...'
            ];
            const resp = responses[Math.floor(Math.random() * responses.length)];
            setTimeout(() => { 
                try { 
                    bot.chat(resp);
                    addChatMessage(botId, config.username, resp, 'sent');
                } catch (e) {} 
            }, 1000);
        }
    });

    // ============ MORTE DO BOT ============
    bot.on('death', () => {
        addChatMessage(botId, '💀 DEATH', `${config.username} morreu!`, 'death');
    });

    // ============ MORTE DE OUTROS ============
    bot.on('chat:death', (deathMsg) => {
        addChatMessage(botId, '💀 DEATH', deathMsg.toString(), 'death');
    });

    // ============ KICKADO ============
    bot.on('kicked', (reason) => {
        const kickMsg = typeof reason === 'string' ? reason : JSON.stringify(reason);
        addChatMessage(botId, '🚫 KICK', `Kickado: ${kickMsg}`, 'kick');
        io.emit('botStatus', { botId, connected: false });
        botConfigs[botId].connected = false;
        bots[botId] = null;
    });

    // ============ ERRO ============
    bot.on('error', (err) => {
        addChatMessage(botId, '❌ ERRO', err.message, 'error');
        botConfigs[botId].connected = false;
        bots[botId] = null;
    });

    // ============ DESCONECTADO ============
    bot.on('end', (reason) => {
        const endReason = reason || 'Desconhecido';
        addChatMessage(botId, '🔌 DISCONNECT', `Desconectado: ${endReason}`, 'disconnect');
        io.emit('botStatus', { botId, connected: false });
        botConfigs[botId].connected = false;
        bots[botId] = null;
    });

    // ============ VIDA BAIXA ============
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
        username, 
        message, 
        type 
    };
    
    chatHistories[botId].push(chatData);
    if (chatHistories[botId].length > 500) chatHistories[botId].shift();
    
    io.emit('chatMessage', { botId, ...chatData });
}

// ============ API ROUTES ============

app.post('/api/bots/:botId/connect', (req, res) => {
    const botId = parseInt(req.params.botId);
    if (botId < 0 || botId >= MAX_BOTS) return res.status(400).json({ error: 'ID inválido' });
    
    const config = {
        host: req.body.host || 'localhost',
        port: parseInt(req.body.port) || 25565,
        username: req.body.username || `Bot_NPC_${botId + 1}`,
        version: req.body.version || '1.20.1',
        auth: req.body.auth || 'offline'
    };
    
    try {
        createBot(botId, config);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/bots/:botId/disconnect', (req, res) => {
    const botId = parseInt(req.params.botId);
    if (bots[botId]) {
        try {
            addChatMessage(botId, '🔌 SISTEMA', 'Desconectado manualmente', 'disconnect');
            bots[botId].end();
            bots[botId] = null;
            botConfigs[botId].connected = false;
            io.emit('botStatus', { botId, connected: false });
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else {
        res.json({ error: 'Bot offline' });
    }
});

app.post('/api/bots/:botId/survival', (req, res) => {
    const botId = parseInt(req.params.botId);
    if (bots[botId]) {
        try {
            bots[botId].chat('/survival');
            addChatMessage(botId, '🤖 MANUAL', '/survival', 'survival');
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
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

// Comando personalizado para TODOS os bots
app.post('/api/bots/command-all', (req, res) => {
    const { command } = req.body;
    if (!command || !command.trim()) {
        return res.status(400).json({ error: 'Comando vazio' });
    }
    const sent = sendCommandToAllBots(command.trim());
    res.json({ success: true, command, sentCount: sent, totalBots: MAX_BOTS });
});

// Limpar TODAS as mensagens
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
        try {
            bots[botId].chat(message);
            addChatMessage(botId, botConfigs[botId].username, message, 'sent');
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else {
        res.status(400).json({ error: 'Bot offline ou mensagem vazia' });
    }
});

app.get('/api/bots/status', (req, res) => {
    const status = botConfigs.map((config, i) => ({
        id: i, username: config.username,
        connected: bots[i] !== null,
        mode: 'estátua'
    }));
    res.json(status);
});

app.get('/api/bots/:botId/chat', (req, res) => {
    const botId = parseInt(req.params.botId);
    res.json(chatHistories[botId] || []);
});

app.get('/api/schedule', (req, res) => {
    res.json({
        schedules: ['03:30', '15:30'],
        currentTime: new Date().toLocaleTimeString('pt-BR'),
        mode: 'ESTÁTUA (sem movimento)'
    });
});

// ============ SOCKET.IO ============

io.on('connection', (socket) => {
    console.log('🟢 Painel conectado');
    
    const allStatus = botConfigs.map((config, i) => ({
        botId: i, connected: bots[i] !== null, username: config.username
    }));
    socket.emit('allBotsStatus', allStatus);
    socket.emit('allChatHistories', chatHistories);
    
    socket.on('sendMessage', (data) => {
        const { botId, message } = data;
        if (bots[botId] && message && message.trim()) {
            try {
                bots[botId].chat(message);
                addChatMessage(botId, botConfigs[botId].username, message, 'sent');
            } catch (error) {
                addChatMessage(botId, '❌ ERRO', error.message, 'error');
            }
        }
    });
    
    socket.on('disconnect', () => console.log('🔴 Painel desconectado'));
});

// ============ INICIAR SERVIDOR ============
const PORT = process.env.PORT || 4000;

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════');
    console.log('🧍 BOT ESTÁTUA - VERSÃO FINAL');
    console.log('═══════════════════════════════════');
    console.log(`📡 Porta: ${PORT}`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log('⏰ Auto /survival: 03:30 e 15:30');
    console.log('📋 Eventos:');
    console.log('   💬 Chat | 💀 Mortes | ⚔️ Survival');
    console.log('   ❌ Erros | 🔌 Disconnect | 🚫 Kick');
    console.log('   ❤️ Health | 📋 Sistema');
    console.log('❌ Join/Leave REMOVIDOS');
    console.log('⌨️ Comando personalizado para TODOS');
    console.log('🗑️ Limpar todas mensagens');
    console.log('═══════════════════════════════════');
});
