const https = require("https");

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error("JSON parse error: " + raw.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("Request timeout")); });
  });
}

function toUk(str) {
  if (!str || str === "-" || str.trim() === "") return null;
  const s = str.replace(/,/g, "").trim();
  const n = s.startsWith("(") && s.endsWith(")")
    ? -parseInt(s.slice(1, -1), 10)
    : parseInt(s, 10);
  if (isNaN(n)) return null;
  return Math.round(n / 100_000_000);
}

function extract(d) {
  if (!d || d.status !== "000" || !d.list) return null;
  let revenue = null, opProfit = null, netProfit = null;
  for (const item of d.list) {
    const nm  = (item.account_nm || "").trim();
    const val = toUk(item.thstrm_amount);
    if (val === null) continue;
    if (revenue  === null && /^(매출액|수익\(매출액\)|영업수익)$/.test(nm))  revenue  = val;
    if (opProfit === null && /영업이익/.test(nm))                             opProfit = val;
    if (netProfit=== null && /^(당기순이익|당기순이익\(손실\)|분기순이익|분기순이익\(손실\))$/.test(nm)) netProfit = val;
  }
  if (revenue === null && opProfit === null) return null;
  return { revenue, opProfit, netProfit };
}

async function fetchFin(key, code, year, reprt) {
  const base = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${key}&corp_code=${code}&bsns_year=${year}&reprt_code=${reprt}`;
  try {
    const r1 = extract(await fetchJson(base + "&fs_div=CFS"));
    if (r1) return r1;
    return extract(await fetchJson(base + "&fs_div=OFS"));
  } catch { return null; }
}

function diff(a, b) {
  if (!a || !b) return null;
  const s = (x, y) => (x !== null && y !== null) ? x - y : null;
  return { revenue: s(a.revenue, b.revenue), opProfit: s(a.opProfit, b.opProfit), netProfit: s(a.netProfit, b.netProfit) };
}

exports.handler = async (event) => {
  const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { ...CORS, "Access-Control-Allow-Methods": "GET", "Access-Control-Allow-Headers": "Content-Type" }, body: "" };
  }

  const KEY = process.env.DART_API_KEY;
  if (!KEY) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "DART_API_KEY 환경변수 없음" }) };

  const p      = event.queryStringParameters || {};
  const action = p.action;

  try {

    if (action === "search_corp") {
      const query = (p.corp_name || "").trim();
      if (!query) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "corp_name 필요" }) };

      const name = encodeURIComponent(query);
     const bgn = new Date(); bgn.setFullYear(bgn.getFullYear() - 1);
const bgnStr = bgn.toISOString().slice(0,10).replace(/-/g,"");
const url  = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${KEY}&corp_name=${name}&bgn_de=${bgnStr}&page_count=20`;
      const data = await fetchJson(url);

      const statusMsg = {
        "010": "등록되지 않은 API 키입니다.",
        "011": "사용할 수 없는 API 키입니다. DART에서 키 상태를 확인해주세요.",
        "012": "접근 IP가 차단되었습니다.",
        "020": "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
        "013": `"${query}"에 해당하는 기업을 찾을 수 없습니다. 정확한 기업명을 입력해주세요.`,
      };

      if (data.status !== "000") {
        const msg = statusMsg[data.status] || `DART 오류 (${data.status}): ${data.message || "알 수 없는 오류"}`;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false, message: msg }) };
      }
      if (!data.list?.length) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false, message: `"${query}"에 해당하는 기업을 찾을 수 없습니다.` }) };
      }

      const seen  = new Set();
      const corps = data.list
        .filter(i => { if (seen.has(i.corp_code)) return false; seen.add(i.corp_code); return true; })
        .slice(0, 5)
        .map(i => ({ corp_code: i.corp_code, corp_name: i.corp_name, stock_code: i.stock_code || "" }));

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: true, corps }) };
    }

    if (action === "get_financials") {
      const corpCode = p.corp_code;
      if (!corpCode) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "corp_code 필요" }) };

      const now  = new Date();
      const curY = now.getFullYear();
      const latestAnnual = now.getMonth() >= 3 ? curY - 1 : curY - 2;

      const annYears = Array.from({ length: 5 }, (_, i) => String(latestAnnual - i));
      const annRaw   = await Promise.all(annYears.map(y => fetchFin(KEY, corpCode, y, "11011")));
      const annual   = annYears.map((y, i) => annRaw[i] ? { year: y, ...annRaw[i] } : null).filter(Boolean).reverse();

      const qYears  = [String(latestAnnual), String(latestAnnual - 1), String(latestAnnual - 2)];
      const QCODES  = ["11011", "11014", "11012", "11013"];
      const fetches = qYears.flatMap(y => QCODES.map(c => ({ y, c })));
      const rawAll  = await Promise.all(fetches.map(f => fetchFin(KEY, corpCode, f.y, f.c)));

      const cumMap = {};
      fetches.forEach(({ y, c }, i) => { if (!cumMap[y]) cumMap[y] = {}; cumMap[y][c] = rawAll[i]; });

      const quarterly = [];
      for (const yr of qYears) {
        const cm = cumMap[yr] || {};
        const yy = yr.slice(2);
        const q1 = cm["11013"];
        const q2 = diff(cm["11012"], cm["11013"]);
        const q3 = diff(cm["11014"], cm["11012"]);
        const q4 = diff(cm["11011"], cm["11014"]);
        if (q1?.revenue != null) quarterly.push({ quarter: yy + "Q1", ...q1 });
        if (q2?.revenue != null) quarterly.push({ quarter: yy + "Q2", ...q2 });
        if (q3?.revenue != null) quarterly.push({ quarter: yy + "Q3", ...q3 });
        if (q4?.revenue != null) quarterly.push({ quarter: yy + "Q4", ...q4 });
      }
      quarterly.sort((a, b) => a.quarter.localeCompare(b.quarter));

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ annual, quarterly: quarterly.slice(-8) }) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "알 수 없는 action" }) };

  } catch (err) {
    console.error("DART function error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
