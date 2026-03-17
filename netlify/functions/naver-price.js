const https = require("https");

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://m.stock.naver.com/",
      },
    }, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers };

  const codes = (event.queryStringParameters?.codes || "")
    .split(",")
    .map(c => c.trim())
    .filter(Boolean);

  if (!codes.length)
    return { statusCode: 400, headers, body: JSON.stringify({ error: "codes 파라미터 필요" }) };

  const results = await Promise.all(
    codes.map(async code => {
      try {
        const data = await fetchJson(`https://m.stock.naver.com/api/stock/${code}/basic`);
        const price = parseInt((data.closePrice || "").replace(/,/g, ""), 10);
        return [code, isNaN(price) ? null : price];
      } catch {
        return [code, null];
      }
    })
  );

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ prices: Object.fromEntries(results) }),
  };
};
