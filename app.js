const { Telegraf, Markup } = require('telegraf');
const crypto = require('crypto');
const qs = require('querystring')
const { table } = require('table');
require('isomorphic-fetch');
const nodeCron = require("node-cron");

require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const getStats = async () => {
    const endpoint = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=kda&convert=USD&CMC_PRO_API_KEY=${process.env.CMCAPI}`;
    const res = await fetch(endpoint);
    const { data: { KDA: { cmc_rank, quote: { USD: { percent_change_1h, percent_change_24h, percent_change_7d, percent_change_30d } } } } } = await res.json();
    return {
        cmc_rank,
        percent_change_1h,
        percent_change_24h,
        percent_change_7d,
        percent_change_30d,
    };
}

nodeCron.schedule("0 8 * * *", async () => {
    const {
        cmc_rank,
        percent_change_1h,
        percent_change_24h,
        percent_change_7d,
        percent_change_30d,
    } = await getStats();
    bot.telegram.sendMessage(64901697, `KDA MORNING STATS: \n Rank: ${cmc_rank} \n 1h %: ${percent_change_1h.toFixed(1)}% \n 24h%: ${percent_change_24h.toFixed(1)}% \n 7d%: ${percent_change_7d.toFixed(1)}% \n 30g%: ${percent_change_30d.toFixed(1)}%`);
    bot.telegram.sendMessage(76981651, `KDA MORNING STATS: \n Rank: ${cmc_rank} \n 1h %: ${percent_change_1h.toFixed(1)}% \n 24h%: ${percent_change_24h.toFixed(1)}% \n 7d%: ${percent_change_7d.toFixed(1)}% \n 30g%: ${percent_change_30d.toFixed(1)}%`);
});

const checkCredentials = (ctx = {}) => ["The_Bous", "tosettil"].includes(ctx.chat.username) && [64901697, 76981651].includes(ctx.chat.id);
const formatQuery = (queryObj) => {
    if (JSON.stringify(queryObj).length !== 2) {
        return '?' + qs.stringify(queryObj)
    } else {
        return ""
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
        strForSign = timestamp + method + endpoint + formatQuery(params || "");
    } else {
        strForSign = timestamp + method + endpoint + JSON.stringify(params || {});
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


bot.start((ctx) => ctx.reply('Benvenuto! Per te un enorme fallo! 👺'));

bot.hears('/stats', async (ctx) => {
    if (checkCredentials(ctx)) {
        const {
            cmc_rank,
            percent_change_1h,
            percent_change_24h,
            percent_change_7d,
            percent_change_30d,
        } = await getStats();
        ctx.reply(`KDA MORNING STATS: \n Rank: ${cmc_rank} \n 1h %: ${percent_change_1h.toFixed(1)}% \n 24h%: ${percent_change_24h.toFixed(1)}% \n 7d%: ${percent_change_7d.toFixed(1)}% \n 30g%: ${percent_change_30d.toFixed(1)}%`);
    }
});

bot.hears('/recap', async (ctx) => {
    if (checkCredentials(ctx)) {
        const now = Date.now() + '';
        const baseUrl = "https://api.kucoin.com";
        const query = "/api/v1/market/orderbook/level1";
        const body = {
            symbol: "KDA-USDT"
        };
        const endpoint = `${baseUrl}${query}${formatQuery(body)}`;
        const { headers } = createKucoinHeader(now, "GET", query, body);
        const coinResponse = await fetch(endpoint, {
            method: "GET",
            headers,
        });
        const { data: { price } } = await coinResponse.json();
        const res = await fetch(`https://poolflare.com/api/v1/coin/kda/account/${process.env.POOLFLARE_ADDRESS}/stats`);
        const { data: { payout, reward24h, balance } } = await res.json();
        const data = [
            ['TOT', 'TOT24H', '2am-2pm'],
            [`${payout}`, `${reward24h}`, `${balance}`],
        ];

        ctx.replyWithHTML(`<b>Miner stats: </b><pre>${table(data)}</pre>`);
        ctx.reply(`KDA price: ${price} USD`);
    }
});

bot.hears('/payout', async (ctx) => {
    if (checkCredentials(ctx)) {
        const res = await fetch(`https://poolflare.com/api/v1/coin/kda/account/${process.env.POOLFLARE_ADDRESS}/payouts`);
        const { data: { payouts } } = await res.json();
        const [lastPayout, preLastPayout] = payouts;
        const { address, amount: lastAmount, status, txID, timestamp: lastTimestamp, info } = preLastPayout;
        const { amount: lastToFillAmount, timestamp: timestampToFill } = lastPayout;

        bot.action('last-to-fill', async (ctx) => {
            ctx.replyWithHTML(`
        <b>Address</b>: ${address}
        <b>Amount 24h</b>: ${lastToFillAmount}
        <b>Timestamp</b>: ${new Date(timestampToFill * 1000)}
        `);
        });
        bot.action('last-filled', async (ctx) => {
            ctx.replyWithHTML(`
        <b>Address</b>: ${address}
        <b>Amount 24h</b>: ${lastAmount}
        <b>Status</b>: ${status}
        <b>TxID</b>: ${txID}
        <b>Timestamp</b>: ${new Date(lastTimestamp * 1000)}
        `);
        });

        return ctx.replyWithPhoto({ url: 'https://media-exp1.licdn.com/dms/image/C4D03AQFyXdvCWVwApg/profile-displayphoto-shrink_800_800/0/1533629374484?e=1640822400&v=beta&t=sW-WbWmvrvN8aXgFUwApgkyGNMs-9aoZ776Ej78itkk' },
            {
                caption: `Scegli di visualizzare l'ultimo payout eseguito oppure l'ultimo ancora da eseguire`,
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    Markup.button.callback('Payout da fare', 'last-to-fill'),
                    Markup.button.callback('Payout fatto', 'last-filled'),
                ])
            }
        )
    }
});

bot.hears('/balance', (ctx) => {
    if (checkCredentials(ctx)) {
        ctx.reply(process.env.SECURITY_QUESTION);
        bot.on('text', async (textCtx) => {
            const { message: { text } } = textCtx;
            if (text === process.env.SECURITY_ANSWER) {
                const now = Date.now() + '';
                const baseUrl = "https://api.kucoin.com";
                const query = "/api/v1/accounts";
                const bodyMain = {
                    currency: "USDT",
                    type: "main"
                }
                const bodyTrading = {
                    currency: "USDT",
                    type: "trade"
                }
                const endpointMain = `${baseUrl}${query}${formatQuery(bodyMain)}`;
                const endpointTrading = `${baseUrl}${query}${formatQuery(bodyTrading)}`;
                const { headers: headersMain } = createKucoinHeader(now, "GET", query, bodyMain);
                const { headers: headersTrading } = createKucoinHeader(now, "GET", query, bodyTrading);
                const [resMain, resTrading] = await Promise.all([
                    fetch(endpointMain, {
                        method: "GET",
                        headers: headersMain,
                    }), fetch(endpointTrading, {
                        method: "GET",
                        headers: headersTrading,
                    })]);

                const { data: jsonMain } = await resMain.json();
                const { data: jsonTrading } = await resTrading.json();
                const [dataMain] = jsonMain;
                const [dataTrading] = jsonTrading;
                const tableData = [
                    ['Wal Type', 'Balance[USDT]'],
                    [`${dataMain.type}`, `${dataMain.balance}`],
                    [`${dataTrading.type}`, `${dataTrading.balance}`],
                    ["Tot", `${Number(dataTrading.balance) + Number(dataMain.balance)}`]
                ];

                textCtx.replyWithHTML(`<b>Wallet balances: </b><pre>${table(tableData)}</pre>`);
            } else {
                textCtx.reply("🚨 👏 Chiamata in errore");
            }
        });
    }
});

bot.hears('/sellkda', (ctx) => {
    if (checkCredentials(ctx)) {
        ctx.reply(process.env.SECURITY_QUESTION);
        bot.on('text', async (textCtx) => {
            const { message: { text } } = textCtx;
            if (text === process.env.SECURITY_ANSWER) {
                try {
                    const now = Date.now() + '';
                    const baseUrlAccount = "https://api.kucoin.com";
                    const queryAccount = "/api/v1/accounts";
                    const bodyMain = {
                        currency: "KDA",
                        type: "main"
                    }
                    const endpointMain = `${baseUrlAccount}${queryAccount}${formatQuery(bodyMain)}`;
                    const { headers: headersMain } = createKucoinHeader(now, "GET", queryAccount, bodyMain);
                    const resMain = await fetch(endpointMain, {
                        method: "GET",
                        headers: headersMain,
                    })
                    const { data: jsonMain } = await resMain.json();
                    const [dataMain] = jsonMain;
                    const { available } = dataMain;
                    const baseUrlInnerTransfer = "https://api.kucoin.com";
                    const queryInnerTransfer = "/api/v2/accounts/inner-transfer";
                    const bodyInnerTransfer = {
                        clientOid: "testexampleforinnertransfer",
                        currency: "KDA",
                        from: "main",
                        to: "trade",
                        amount: available,
                    }
                    const endpointInnerTransfer = `${baseUrlInnerTransfer}${queryInnerTransfer}`;
                    const { headers: headersInnerTransfer } = createKucoinHeader(now, "POST", queryInnerTransfer, bodyInnerTransfer);
                    const innerTransferRes = await fetch(endpointInnerTransfer, {
                        method: "POST",
                        headers: headersInnerTransfer,
                        body: JSON.stringify(bodyInnerTransfer),
                    });
                    const { msg: innerTransferMsg, code: innerTransferCode } = await innerTransferRes.json();
                    if (innerTransferRes.status !== 200) throw new Error({ message: "[INNER] Errore nella chiamata inner transfer" });
                    if (innerTransferCode !== "200000") throw new Error({ message: `[INNER] ${innerTransferMsg}` });
                    textCtx.reply("Valuta spostata da wallet main a trading wallet");
                    const body = {
                        side: "sell",
                        symbol: "KDA-USDT",
                        type: "market",
                        clientOid: "textexampleclientoid",
                        size: Math.round((available * 100) / 100).toFixed(3)
                    };
                    const baseUrl = "https://api.kucoin.com";
                    const query = "/api/v1/orders";
                    const endpoint = `${baseUrl}${query}`;
                    const { headers } = createKucoinHeader(now, "POST", query, body);
                    const res = await fetch(endpoint, {
                        method: "POST",
                        body: JSON.stringify(body),
                        headers,
                    });
                    const { msg, code } = await res.json();
                    if (res.status !== 200) throw new Error({ message: "[TRADING] Errore nella chiamata di trading" });
                    if (code !== "200000") throw new Error({ message: `[TRADING] ${msg}` });

                    textCtx.reply("🤙");
                } catch ({ message }) {
                    textCtx.reply(`🚨 👏  ${message}`);
                }
            } else {
                textCtx.reply("🚨 👏 Esci di qui porcoddio!");
            }
        });
    }
});

bot.hears('/vendi', (ctx) => {
    if (checkCredentials(ctx)) {
        ctx.reply(process.env.SECURITY_QUESTION);
        bot.on('text', async (textCtx) => {
            const { message: { text } } = textCtx;
            if (text === process.env.SECURITY_ANSWER) {
                try {
                    const now = Date.now() + '';
                    const baseUrlAccount = "https://api.kucoin.com";
                    const queryAccount = "/api/v1/accounts";
                    const bodyMain = {
                        currency: "KDA",
                        type: "main"
                    }
                    const endpointMain = `${baseUrlAccount}${queryAccount}${formatQuery(bodyMain)}`;
                    const { headers: headersMain } = createKucoinHeader(now, "GET", queryAccount, bodyMain);
                    const resMain = await fetch(endpointMain, {
                        method: "GET",
                        headers: headersMain,
                    })
                    const { data: jsonMain } = await resMain.json();
                    const [dataMain] = jsonMain;
                    const { available } = dataMain;
                    const baseUrlInnerTransfer = "https://api.kucoin.com";
                    const queryInnerTransfer = "/api/v2/accounts/inner-transfer";
                    const bodyInnerTransfer = {
                        clientOid: "testexampleforinnertransfer",
                        currency: "KDA",
                        from: "main",
                        to: "trade",
                        amount: available,
                    }
                    const endpointInnerTransfer = `${baseUrlInnerTransfer}${queryInnerTransfer}`;
                    const { headers: headersInnerTransfer } = createKucoinHeader(now, "POST", queryInnerTransfer, bodyInnerTransfer);
                    const innerTransferRes = await fetch(endpointInnerTransfer, {
                        method: "POST",
                        headers: headersInnerTransfer,
                        body: JSON.stringify(bodyInnerTransfer),
                    });
                    const { msg: innerTransferMsg, code: innerTransferCode } = await innerTransferRes.json();
                    if (innerTransferRes.status !== 200) throw new Error({ message: "[INNER] Errore nella chiamata inner transfer" });
                    if (innerTransferCode !== "200000") throw new Error({ message: `[INNER] ${innerTransferMsg}` });
                    textCtx.reply("Valuta spostata da wallet main a trading wallet");
                    const body = {
                        side: "sell",
                        symbol: "KDA-USDT",
                        type: "market",
                        clientOid: "textexampleclientoid",
                        size: Math.round((available * 100) / 100).toFixed(3)
                    };
                    const baseUrl = "https://api.kucoin.com";
                    const query = "/api/v1/orders";
                    const endpoint = `${baseUrl}${query}`;
                    const { headers } = createKucoinHeader(now, "POST", query, body);
                    const res = await fetch(endpoint, {
                        method: "POST",
                        body: JSON.stringify(body),
                        headers,
                    });
                    const { msg, code } = await res.json();
                    if (res.status !== 200) throw new Error({ message: "[TRADING] Errore nella chiamata di trading" });
                    if (code !== "200000") throw new Error({ message: `[TRADING] ${msg}` });

                    textCtx.reply("🤙");
                } catch ({ message }) {
                    textCtx.reply(`🚨 👏  ${message}`);
                }
            } else {
                textCtx.reply("🚨 👏 Esci di qui porcoddio!");
            }
        });
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));