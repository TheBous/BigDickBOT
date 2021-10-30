const TeleBot = require("telebot");
const { formatQuery } = require("./helpers/utils");
const {
  createKucoinHeader,
  getAvailability,
  innerTransferToTradingWallet,
  sellKDA,
} = require("./helpers/kucoin");
require("isomorphic-fetch");
const nodeCron = require("node-cron");

require("dotenv").config();

const bot = new TeleBot(process.env.BOT_TOKEN);
bot.start();

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
  bot.sendMessage(
    64901697,
    `KDA MORNING STATS: \n Rank: ${cmc_rank} \n 1h %: ${percent_change_1h.toFixed(
      1
    )}% \n 24h%: ${percent_change_24h.toFixed(
      1
    )}% \n 7d%: ${percent_change_7d.toFixed(
      1
    )}% \n 30g%: ${percent_change_30d.toFixed(1)}%`
  );
  bot.sendMessage(
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

bot.on("/stats", async (msg) => {
  if (checkCredentials(msg)) {
    const {
      cmc_rank,
      percent_change_1h,
      percent_change_24h,
      percent_change_7d,
      percent_change_30d,
    } = await getStats();
    bot.sendMessage(
      msg.from.id,
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

bot.on("/recap", async (msg) => {
  if (checkCredentials(msg)) {
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

    bot.on("callbackQuery", (msg) => {
      const { data: category } = msg;
      if (["total", "total24", "payout", "price"].includes(category)) {
        let reply = "";
        switch (category) {
          case "total":
            reply = `${payout} KDA`;
            break;
          case "total24":
            reply = `${reward24h} KDA`;
            break;
          case "payout":
            reply = `${balance} KDA`;
            break;
          case "price":
            reply = `${price} USD`;
            break;
          default:
            reply = "Choose one";
        }
        return bot.answerCallbackQuery(msg.id, { text: reply, alert: true });
      }
    });

    const replyMarkup = bot.inlineKeyboard(
      [
        [
          bot.inlineButton("TOT", { callback: "total" }),
          bot.inlineButton("TOT24H", { callback: "total24" }),
          bot.inlineButton("2am-2pm", { callback: "payout" }),
          bot.inlineButton("KDA price", { callback: "price" }),
        ],
      ],
      { resize: true }
    );

    bot.sendMessage(msg.from.id, "Choose stat to see!", { replyMarkup });
  }
});

bot.on("/balance", async (msg) => {
  if (checkCredentials(msg)) {
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

    bot.on("callbackQuery", (msg) => {
      const { data: category } = msg;
      if (["main", "trading", "tot"].includes(category)) {
        let reply = "";
        switch (category) {
          case "main":
            reply = `${dataMain.balance} USDT`;
            break;
          case "trading":
            reply = `${dataTrading.balance} USDT`;
            break;
          case "tot":
            reply = `${
              Number(dataTrading.balance) + Number(dataMain.balance)
            } USDT`;
            break;
          default:
            reply = "Choose one";
        }
        return bot.answerCallbackQuery(msg.id, { text: reply, alert: true });
      }
    });

    const replyMarkup = bot.inlineKeyboard(
      [
        [
          bot.inlineButton("Main", { callback: "main" }),
          bot.inlineButton("Trading", { callback: "trading" }),
          bot.inlineButton("TOT", { callback: "tot" }),
        ],
      ],
      { resize: true }
    );

    bot.sendMessage(msg.from.id, "Choose wallet to see!", { replyMarkup });
  }
});

bot.on("/lollo", (msg) => {
  if (checkCredentials(msg)) {
    bot.on("callback_query", async (callbackQuery) => {
      const { data: category } = callbackQuery;
    });

    bot.on("callbackQuery", async (msg) => {
      const { data: category } = msg;
      if (["si", "no"].includes(category)) {
        if (category === "si") {
          try {
            const now = Date.now() + "";
            const baseUrlAccount = "https://api.kucoin.com";

            const available = await getAvailability(now, baseUrlAccount);
            await innerTransferToTradingWallet(now, baseUrlAccount, available);
            await sellKDA(now, baseUrlAccount, available);
            return bot.answerCallbackQuery(msg.id, {
              text: "Transfer completed🤙",
              alert: true,
            });
          } catch ({ message }) {
            return bot.answerCallbackQuery(msg.id, {
              text: `🚨 👏  ${message}`,
              alert: true,
            });
          }
        }
      }
    });

    const replyMarkup = bot.inlineKeyboard(
      [
        [
          bot.inlineButton("Si", { callback: "si" }),
          bot.inlineButton("Fottiti", { callback: "no" }),
        ],
      ],
      { resize: true }
    );
    bot.sendMessage(msg.from.id, "Are you sure?", { replyMarkup });
  }
});
