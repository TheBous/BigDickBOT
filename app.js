const { Telegraf, Markup } = require("telegraf");
const { formatQuery } = require("./helpers/utils");
const {
  createKucoinHeader,
  getAvailability,
  innerTransferToTradingWallet,
  sellKDA,
} = require("./helpers/kucoin");
const { table } = require("table");
require("isomorphic-fetch");
const nodeCron = require("node-cron");

require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const getStats = async () => {
  const endpoint = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=kda&convert=USD&CMC_PRO_API_KEY=${process.env.CMCAPI}`;
  const res = await fetch(endpoint);
  const {
    data: {
      KDA: {
        cmc_rank,
        quote: {
          USD: {
            percent_change_1h,
            percent_change_24h,
            percent_change_7d,
            percent_change_30d,
          },
        },
      },
    },
  } = await res.json();
  return {
    cmc_rank,
    percent_change_1h,
    percent_change_24h,
    percent_change_7d,
    percent_change_30d,
  };
};

nodeCron.schedule("0 8 * * *", async () => {
  const {
    cmc_rank,
    percent_change_1h,
    percent_change_24h,
    percent_change_7d,
    percent_change_30d,
  } = await getStats();
  bot.telegram.sendMessage(
    64901697,
    `KDA MORNING STATS: \n Rank: ${cmc_rank} \n 1h %: ${percent_change_1h.toFixed(
      1
    )}% \n 24h%: ${percent_change_24h.toFixed(
      1
    )}% \n 7d%: ${percent_change_7d.toFixed(
      1
    )}% \n 30g%: ${percent_change_30d.toFixed(1)}%`
  );
  bot.telegram.sendMessage(
    76981651,
    `KDA MORNING STATS: \n Rank: ${cmc_rank} \n 1h %: ${percent_change_1h.toFixed(
      1
    )}% \n 24h%: ${percent_change_24h.toFixed(
      1
    )}% \n 7d%: ${percent_change_7d.toFixed(
      1
    )}% \n 30g%: ${percent_change_30d.toFixed(1)}%`
  );
});

const checkCredentials = (ctx = {}) =>
  ["The_Bous", "tosettil"].includes(ctx.chat.username) &&
  [64901697, 76981651].includes(ctx.chat.id);

bot.start((ctx) => ctx.reply("Benvenuto! Per te un enorme fallo! 👺"));

bot.command("/stats", async (ctx) => {
  if (checkCredentials(ctx)) {
    const {
      cmc_rank,
      percent_change_1h,
      percent_change_24h,
      percent_change_7d,
      percent_change_30d,
    } = await getStats();
    ctx.reply(
      `KDA MORNING STATS: \n Rank: ${cmc_rank} \n 1h %: ${percent_change_1h.toFixed(
        1
      )}% \n 24h%: ${percent_change_24h.toFixed(
        1
      )}% \n 7d%: ${percent_change_7d.toFixed(
        1
      )}% \n 30g%: ${percent_change_30d.toFixed(1)}%`
    );
  }
});

bot.command("/recap", async (ctx) => {
  if (checkCredentials(ctx)) {
    const now = Date.now() + "";
    const baseUrl = "https://api.kucoin.com";
    const query = "/api/v1/market/orderbook/level1";
    const body = {
      symbol: "KDA-USDT",
    };
    const endpoint = `${baseUrl}${query}${formatQuery(body)}`;
    const { headers } = createKucoinHeader(now, "GET", query, body);
    const coinResponse = await fetch(endpoint, {
      method: "GET",
      headers,
    });
    const {
      data: { price },
    } = await coinResponse.json();
    const res = await fetch(
      `https://poolflare.com/api/v1/coin/kda/account/${process.env.POOLFLARE_ADDRESS}/stats`
    );
    const {
      data: { payout, reward24h, balance },
    } = await res.json();
    const data = [
      ["TOT", "TOT24H", "2am-2pm"],
      [`${payout}`, `${reward24h}`, `${balance}`],
    ];

    ctx.replyWithHTML(`<b>Miner stats: </b><pre>${table(data)}</pre>`);
    ctx.reply(`KDA price: ${price} USD`);
  }
});

bot.command("/payout", async (ctx) => {
  if (checkCredentials(ctx)) {
    const res = await fetch(
      `https://poolflare.com/api/v1/coin/kda/account/${process.env.POOLFLARE_ADDRESS}/payouts`
    );
    const {
      data: { payouts },
    } = await res.json();
    const [lastPayout, preLastPayout] = payouts;
    const {
      address,
      amount: lastAmount,
      status,
      txID,
      timestamp: lastTimestamp,
      info,
    } = preLastPayout;
    const { amount: lastToFillAmount, timestamp: timestampToFill } = lastPayout;

    bot.action("last-to-fill", async (ctx) => {
      ctx.replyWithHTML(`
        <b>Address</b>: ${address}
        <b>Amount 24h</b>: ${lastToFillAmount}
        <b>Timestamp</b>: ${new Date(timestampToFill * 1000)}
        `);
    });
    bot.action("last-filled", async (ctx) => {
      ctx.replyWithHTML(`
        <b>Address</b>: ${address}
        <b>Amount 24h</b>: ${lastAmount}
        <b>Status</b>: ${status}
        <b>TxID</b>: ${txID}
        <b>Timestamp</b>: ${new Date(lastTimestamp * 1000)}
        `);
    });

    return ctx.replyWithPhoto(
      {
        url: "https://media-exp1.licdn.com/dms/image/C4D03AQFyXdvCWVwApg/profile-displayphoto-shrink_800_800/0/1533629374484?e=1640822400&v=beta&t=sW-WbWmvrvN8aXgFUwApgkyGNMs-9aoZ776Ej78itkk",
      },
      {
        caption: `Scegli di visualizzare l'ultimo payout eseguito oppure l'ultimo ancora da eseguire`,
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          Markup.button.callback("Payout da fare", "last-to-fill"),
          Markup.button.callback("Payout fatto", "last-filled"),
        ]),
      }
    );
  }
});

bot.command("/balance", (ctx) => {
  if (checkCredentials(ctx)) {
    ctx.reply(process.env.SECURITY_QUESTION);
    bot.on("text", async (textCtx) => {
      const {
        message: { text },
      } = textCtx;
      if (text === process.env.SECURITY_ANSWER) {
        const now = Date.now() + "";
        const baseUrl = "https://api.kucoin.com";
        const query = "/api/v1/accounts";
        const bodyMain = {
          currency: "USDT",
          type: "main",
        };
        const bodyTrading = {
          currency: "USDT",
          type: "trade",
        };
        const endpointMain = `${baseUrl}${query}${formatQuery(bodyMain)}`;
        const endpointTrading = `${baseUrl}${query}${formatQuery(bodyTrading)}`;
        const { headers: headersMain } = createKucoinHeader(
          now,
          "GET",
          query,
          bodyMain
        );
        const { headers: headersTrading } = createKucoinHeader(
          now,
          "GET",
          query,
          bodyTrading
        );
        const [resMain, resTrading] = await Promise.all([
          fetch(endpointMain, {
            method: "GET",
            headers: headersMain,
          }),
          fetch(endpointTrading, {
            method: "GET",
            headers: headersTrading,
          }),
        ]);

        const { data: jsonMain } = await resMain.json();
        const { data: jsonTrading } = await resTrading.json();
        const [dataMain] = jsonMain;
        const [dataTrading] = jsonTrading;
        const tableData = [
          ["Wal Type", "Balance[USDT]"],
          [`${dataMain.type}`, `${dataMain.balance}`],
          [`${dataTrading.type}`, `${dataTrading.balance}`],
          ["Tot", `${Number(dataTrading.balance) + Number(dataMain.balance)}`],
        ];

        textCtx.replyWithHTML(
          `<b>Wallet balances: </b><pre>${table(tableData)}</pre>`
        );
      } else {
        textCtx.reply("🚨 👏 Chiamata in errore");
      }
    });
  }
});

bot.command("/lollo", (ctx) => {
  if (checkCredentials(ctx)) {
    ctx.reply(process.env.SECURITY_QUESTION);
    bot.on("text", async (textCtx) => {
      const {
        message: { text },
      } = textCtx;
      if (text === process.env.SECURITY_ANSWER) {
        try {
          const now = Date.now() + "";
          const baseUrlAccount = "https://api.kucoin.com";

          const available = await getAvailability(now, baseUrlAccount);
          await innerTransferToTradingWallet(now, baseUrlAccount, available);
          await sellKDA(now, baseUrlAccount, available);

          textCtx.reply("Transfer completed🤙");
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

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
