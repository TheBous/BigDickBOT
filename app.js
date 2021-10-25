const { Telegraf } = require('telegraf')
const crypto = require('crypto')
require('isomorphic-fetch');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const checkCredentials = (ctx = {}) => ["The_Bous", "tosettil"].includes(ctx.chat.username) && [64901697, 76981651].includes(ctx.chat.id);
console.log(process.env.API_SECRET);
const formatQuery = (queryObj) => {
    if (JSON.stringify(queryObj).length !== 2) {
        return '?' + qs.stringify(queryObj)
    } else {
        return ''
    }
};

const createKucoinHeader = (timestamp, method = "GET", endpoint, params) => {
    const apiSecret = process.env.API_SECRET;
    const apiPassphrase = process.env.API_PASSPHRASE;
    const apiKey = process.env.API_KEY;

    const header = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    let strForSign = '';
    if (method === 'GET' || method === 'DELETE') {
        strForSign = timestamp + method + endpoint + formatQuery(params);
    } else {
        strForSign = timestamp + method + endpoint + JSON.stringify(params);
    }
    const signatureResult = crypto.createHmac('sha256', apiSecret)
        .update(strForSign)
        .digest('base64');
    const passphraseResult = crypto.createHmac('sha256', apiSecret)
        .update(apiPassphrase)
        .digest('base64');
    header.headers['KC-API-SIGN'] = signatureResult;
    header.headers['KC-API-TIMESTAMP'] = timestamp;
    header.headers['KC-API-KEY'] = apiKey;
    header.headers['KC-API-PASSPHRASE'] = passphraseResult;
    header.headers['KC-API-KEY-VERSION'] = 2;
    return header;
};


bot.start((ctx) => ctx.reply('Benvenuto! Per te un enorme fallo!'))

bot.hears('hi', (ctx) => {
    if (checkCredentials(ctx)) {
        console.log(ctx.chat);
        ctx.reply('Lollo fai cagare porcodio')
    }
});

bot.hears('/recap', async (ctx) => {
    if (checkCredentials(ctx)) {
        const res = await fetch("https://poolflare.com/api/v1/coin/kda/account/d58a9d2a48ce6c5e1611ca476dc4c86b2c9d11a10d20aaf70f53b6a1f7992167/stats");
        const { data: { payout, reward24h } } = await res.json();
        ctx.reply(`payout: ${payout}
        \n Reward 24h: ${reward24h}`);
    }
});

bot.hears('/sellall', async (ctx) => {
    if (checkCredentials(ctx)) {
        const body = {
            side: "sell",
            symbol: "KDA-USDT",
            type: "market",
            clientOid: "fkhb388bc4utyg4iug498hu45iuh",
            size: "1",
        };
        const now = Date.now() + '';
        const baseUrl = "https://api.kucoin.com";
        const query = "/api/v1/orders";
        const endpoint = `${baseUrl}${query}`;
        const { headers } = createKucoinHeader(now, "POST", query, body);
        console.log(headers, JSON.stringify(body));
        const res = await fetch(endpoint, {
            method: "POST",
            body: JSON.stringify(body),
            headers,
        })
        console.log(res);
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));