const crypto = require("crypto");
const { formatQuery } = require("./utils");

const createKucoinHeader = (timestamp, method = "GET", endpoint, params) => {
  const apiSecret = process.env.API_SECRET;
  const apiPassphrase = process.env.API_PASSPHRASE;
  const apiKey = process.env.API_KEY;

  const header = {
    headers: {
      "Content-Type": "application/json",
    },
  };
  let strForSign = "";
  if (method === "GET" || method === "DELETE") {
    strForSign = timestamp + method + endpoint + formatQuery(params || "");
  } else {
    strForSign = timestamp + method + endpoint + JSON.stringify(params || {});
  }
  const signatureResult = crypto
    .createHmac("sha256", apiSecret)
    .update(strForSign)
    .digest("base64");
  const passphraseResult = crypto
    .createHmac("sha256", apiSecret)
    .update(apiPassphrase)
    .digest("base64");
  header.headers["KC-API-SIGN"] = signatureResult;
  header.headers["KC-API-TIMESTAMP"] = timestamp;
  header.headers["KC-API-KEY"] = apiKey;
  header.headers["KC-API-PASSPHRASE"] = passphraseResult;
  header.headers["KC-API-KEY-VERSION"] = 2;
  return header;
};

const getAvailability = async (now, baseUrlAccount) => {
  const queryAccount = "/api/v1/accounts";
  const bodyMain = {
    currency: "KDA",
    type: "main",
  };
  const endpoint = `${baseUrlAccount}${queryAccount}${formatQuery(bodyMain)}`;
  const { headers } = createKucoinHeader(now, "GET", queryAccount, bodyMain);
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers,
    });
    const { data: json } = await res.json();
    const [data] = json;
    const { available } = data;
    if (Math.floor(Number(available)) === 0) {
      throw new Error("Insufficient balance to move");
    }
    return available;
  } catch ({ message }) {
    throw new Error(`[BALANCE] ${message}`);
  }
};

const innerTransferToTradingWallet = async (now, baseUrlAccount, available) => {
  const query = "/api/v2/accounts/inner-transfer";
  const body = {
    clientOid: "testexampleforinnertransfer",
    currency: "KDA",
    from: "main",
    to: "trade",
    amount: available,
  };
  const endpoint = `${baseUrlAccount}${query}`;
  const { headers } = createKucoinHeader(now, "POST", query, body);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const { msg, code } = await res.json();
    if (res.status !== 200) throw new Error("Inner transfer API call error");
    if (code !== "200000") throw new Error(msg);
  } catch ({ message }) {
    throw new Error(`[INNERTRANSFER] ${message}`);
  }
};

const sellKDA = async (now, baseUrl, available) => {
  const body = {
    side: "sell",
    symbol: "KDA-USDT",
    type: "market",
    clientOid: "textexampleclientoid",
    size: (Number(available) - 0.01).toFixed(3),
  };
  const query = "/api/v1/orders";
  const endpoint = `${baseUrl}${query}`;
  const { headers } = createKucoinHeader(now, "POST", query, body);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });
    const { msg, code } = await res.json();
    if (res.status !== 200) throw new Error("Inner transfer API call error");
    if (code !== "200000") throw new Error(msg);
  } catch ({ message }) {
    throw new Error(`[TRADING] ${message}`);
  }
};

module.exports = {
  createKucoinHeader,
  getAvailability,
  innerTransferToTradingWallet,
  sellKDA,
};
