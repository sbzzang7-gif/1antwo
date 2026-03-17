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
        const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`);
        if (!res.ok) return [code, null];
        const data = await res.json();
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
