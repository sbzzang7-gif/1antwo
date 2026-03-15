const https = require("https");

// ── HTTP GET → JSON 파싱 ──────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error("JSON parse error: " + raw.slice(0, 120))); }
      });
    }).on("error", reject);
  });
}

// ── 금액 문자열 → 억원 정수 ──────────────────────────────────────
function toUk(str) {
  if (!str || str === "-" || str.trim() === "") return null;
  const s = str.replace(/,/g, "").trim();
  let n;
  if (s.startsWith("(") && s.endsWith(")")) n = -parseInt(s.slice(1, -1), 10);
  else n = parseInt(s, 10);
  if (isNaN(n)) return null;
  return Math.round(n / 100_000_000); // 원 → 억원
}

// ── DART 재무제표에서 매출/영업이익/순이익 추출 ──────────────────
function extract(dartData) {
  if (!dartData || dartData.status !== "000" || !dartData.list) return null;
  let revenue = null, opProfit = null, netProfit = null;

  for (const item of dartData.list) {
    const nm  = (item.account_nm || "").trim();
    const val = toUk(item.thstrm_amount);
    if (val === null) continue;

    if (revenue  === null && /^(매출액|수익\(매출액\)|영업수익)$/.test(nm)) revenue  = val;
    if (opProfit === null && /영업이익/.test(nm)) opProfit = val;
    if (netProfit=== null && /^(당기순이익|당기순이익\(손실\)|분기순이익|분기순이익\(손실\))$/.test(nm)) netProfit = val;
  }
  if (revenue === null && opProfit === null) return null;
  return { revenue, opProfit, netProfit };
}

// ── DART 재무제표 1건 fetch (CFS 우선, 실패시 OFS) ──────────────
async function fetchFin(key, code, year, reprt) {
  const base = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${key}&corp_code=${code}&bsns_year=${year}&reprt_code=${reprt}`;
  try {
    const cfs = await fetchJson(base + "&fs_div=CFS");
    const res = extract(cfs);
    if (res) return res;
    const ofs = await fetchJson(base + "&fs_div=OFS");
    return extract(ofs);
  } catch { return null; }
}

// ── 두 기간 차이 (standalone 분기 계산) ─────────────────────────
function diff(a, b) {
  if (!a || !b) return null;
  const sub = (x, y) => (x !== null && y !== null) ? x - y : null;
  return { revenue: sub(a.revenue, b.revenue), opProfit: sub(a.opProfit, b.opProfit), netProfit: sub(a.netProfit, b.netProfit) };
}

// ════════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  const KEY  = process.env.DART_API_KEY;
  if (!KEY) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "DART_API_KEY 환경변수가 설정되지 않았습니다." }) };

  const p      = event.queryStringParameters || {};
  const action = p.action;

  try {
    // ── 1. 기업 검색 (이름 → corp_code 후보 반환) ──────────────
    if (action === "search_corp") {
      const name = encodeURIComponent(p.corp_name || "");
      const url  = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${KEY}&corp_name=${name}&bgn_de=20200101&page_count=20`;
      const data = await fetchJson(url);
      if (data.status !== "000" || !data.list?.length)
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false, message: "기업을 찾을 수 없습니다." }) };

      const seen = new Set();
      const corps = data.list
        .filter(i => { if (seen.has(i.corp_code)) return false; seen.add(i.corp_code); return true; })
        .slice(0, 5)
        .map(i => ({ corp_code: i.corp_code, corp_name: i.corp_name, stock_code: i.stock_code || "" }));

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: true, corps }) };
    }

    // ── 2. 재무 데이터 로드 (연간 5개년 + 분기 8개) ────────────
    if (action === "get_financials") {
      const corpCode = p.corp_code;
      if (!corpCode) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "corp_code 필요" }) };

      const now  = new Date();
      const curY = now.getFullYear();
      // 가장 최근 확정 연간: 4월 이후면 전년도, 이전이면 전전년도
      const latestAnnual = now.getMonth() >= 3 ? curY - 1 : curY - 2;

      // ── 연간 5개년 (병렬) ──
      const annYears = Array.from({ length: 5 }, (_, i) => String(latestAnnual - i));
      const annRaw   = await Promise.all(annYears.map(y => fetchFin(KEY, corpCode, y, "11011")));
      const annual   = annYears
        .map((year, i) => annRaw[i] ? { year, ...annRaw[i] } : null)
        .filter(Boolean)
        .reverse(); // 오래된 순

      // ── 분기 8개: 최근 2~3년 누적치 병렬 수집 ──
      const qYears = [String(latestAnnual), String(latestAnnual - 1), String(latestAnnual - 2)];
      const CODES  = ["11011", "11014", "11012", "11013"]; // 연간, Q3, 반기, Q1
      const fetches = qYears.flatMap(y => CODES.map(c => ({ y, c })));
      const rawAll  = await Promise.all(fetches.map(f => fetchFin(KEY, corpCode, f.y, f.c)));

      // 누적 맵 구성
      const cumMap = {};
      fetches.forEach(({ y, c }, i) => {
        if (!cumMap[y]) cumMap[y] = {};
        cumMap[y][c] = rawAll[i];
      });

      // Standalone 분기 계산
      const quarterly = [];
      for (const yr of qYears) {
        const cm = cumMap[yr] || {};
        const q1 = cm["11013"];
        const q2 = diff(cm["11012"], cm["11013"]);
        const q3 = diff(cm["11014"], cm["11012"]);
        const q4 = diff(cm["11011"], cm["11014"]);
        const yy = yr.slice(2);
        if (q1?.revenue !== null && q1) quarterly.push({ quarter: yy + "Q1", ...q1 });
        if (q2?.revenue !== null && q2) quarterly.push({ quarter: yy + "Q2", ...q2 });
        if (q3?.revenue !== null && q3) quarterly.push({ quarter: yy + "Q3", ...q3 });
        if (q4?.revenue !== null && q4) quarterly.push({ quarter: yy + "Q4", ...q4 });
      }
      quarterly.sort((a, b) => a.quarter.localeCompare(b.quarter));
      const last8 = quarterly.slice(-8);

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ annual, quarterly: last8 }) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "알 수 없는 action" }) };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
