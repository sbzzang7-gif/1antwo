// Netlify Function — DART API proxy (Node 18 fetch)
const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

async function dartGet(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(9000),
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
  });
  return res.json();
}

function toUk(str) {
  if (!str || str === "-" || !str.trim()) return null;
  const s = str.replace(/,/g, "").trim();
  const n = s.startsWith("(") && s.endsWith(")")
    ? -parseInt(s.slice(1, -1), 10) : parseInt(s, 10);
  return isNaN(n) ? null : Math.round(n / 100_000_000);
}

function extract(d) {
  if (!d || d.status !== "000" || !d.list) return null;
  let revenue = null, opProfit = null, netProfit = null;
  for (const item of d.list) {
    const nm = (item.account_nm || "").trim();
    const val = toUk(item.thstrm_amount);
    if (val === null) continue;
    if (!revenue   && /^(매출액|수익\(매출액\)|영업수익)$/.test(nm))  revenue   = val;
    if (!opProfit  && /영업이익/.test(nm))                             opProfit  = val;
    if (!netProfit && /^(당기순이익|당기순이익\(손실\)|분기순이익|분기순이익\(손실\))$/.test(nm)) netProfit = val;
  }
  return (revenue === null && opProfit === null) ? null : { revenue, opProfit, netProfit };
}

async function fetchFin(key, code, year, reprt) {
  const u = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${key}&corp_code=${code}&bsns_year=${year}&reprt_code=${reprt}`;
  try {
    const r1 = extract(await dartGet(u + "&fs_div=CFS"));
    if (r1) return r1;
    return extract(await dartGet(u + "&fs_div=OFS"));
  } catch { return null; }
}

function diff(a, b) {
  if (!a || !b) return null;
  const s = (x, y) => (x != null && y != null) ? x - y : null;
  return { revenue: s(a.revenue, b.revenue), opProfit: s(a.opProfit, b.opProfit), netProfit: s(a.netProfit, b.netProfit) };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: { ...CORS, "Access-Control-Allow-Methods": "GET" }, body: "" };

  const KEY = process.env.DART_API_KEY;
  if (!KEY) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "DART_API_KEY 없음" }) };

  const p = event.queryStringParameters || {};

  try {
    // ── 기업 검색 ───────────────────────────────────────────────
    if (p.action === "search_corp") {
      const query = (p.corp_name || "").trim();
      if (!query) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "corp_name 필요" }) };

      const name = encodeURIComponent(query);
      const base = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${KEY}&corp_name=${name}&page_count=10`;
      const [dA, dB, dI] = await Promise.all([
        dartGet(base + "&pblntf_ty=A").catch(() => null),
        dartGet(base + "&pblntf_ty=B").catch(() => null),
        dartGet(base + "&pblntf_ty=I").catch(() => null),
      ]);

      if (!dA && !dB && !dI)
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false, message: "DART 서버 연결 실패. 잠시 후 다시 시도해주세요." }) };

      const data = dA || dB || dI;
      const errMsgs = { "010":"등록되지 않은 API 키", "011":"사용 불가 API 키", "012":"IP 차단", "020":"요청 한도 초과" };
      if (errMsgs[data.status])
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false, message: errMsgs[data.status] }) };

      const merged = [dA, dB, dI]
        .filter(d => d?.status === "000" && Array.isArray(d.list))
        .flatMap(d => d.list);

      if (!merged.length) {
        const sts = [dA,dB,dI].filter(Boolean).map(d=>d.status).join(",");
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false, message: `"${query}" 검색 결과 없음 (status: ${sts})` }) };
      }

      const seen = new Set();
      const corps = merged
        .filter(i => { if (seen.has(i.corp_code)) return false; seen.add(i.corp_code); return true; })
        .slice(0, 5)
        .map(i => ({ corp_code: i.corp_code, corp_name: i.corp_name, stock_code: i.stock_code || "" }));

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: true, corps }) };
    }

    // ── 재무 데이터 ─────────────────────────────────────────────
    if (p.action === "get_financials") {
      const code = p.corp_code;
      if (!code) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "corp_code 필요" }) };

      const now = new Date(), cy = now.getFullYear();
      const ly = now.getMonth() >= 3 ? cy - 1 : cy - 2;

      const annYears = Array.from({ length: 5 }, (_, i) => String(ly - i));
      const annRaw = await Promise.all(annYears.map(y => fetchFin(KEY, code, y, "11011")));
      const annual = annYears.map((y,i) => annRaw[i] ? { year:y, ...annRaw[i] } : null).filter(Boolean).reverse();

      const qYears = [ly, ly-1, ly-2].map(String);
      const CODES = ["11011","11014","11012","11013"];
      const fetches = qYears.flatMap(y => CODES.map(c => ({y,c})));
      const rawAll = await Promise.all(fetches.map(f => fetchFin(KEY, code, f.y, f.c)));

      const cumMap = {};
      fetches.forEach(({y,c},i) => { if (!cumMap[y]) cumMap[y]={}; cumMap[y][c]=rawAll[i]; });

      const quarterly = [];
      for (const yr of qYears) {
        const cm = cumMap[yr] || {}, yy = yr.slice(2);
        const q1=cm["11013"], q2=diff(cm["11012"],cm["11013"]), q3=diff(cm["11014"],cm["11012"]), q4=diff(cm["11011"],cm["11014"]);
        if (q1?.revenue!=null) quarterly.push({ quarter:yy+"Q1", ...q1 });
        if (q2?.revenue!=null) quarterly.push({ quarter:yy+"Q2", ...q2 });
        if (q3?.revenue!=null) quarterly.push({ quarter:yy+"Q3", ...q3 });
        if (q4?.revenue!=null) quarterly.push({ quarter:yy+"Q4", ...q4 });
      }
      quarterly.sort((a,b) => a.quarter.localeCompare(b.quarter));
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ annual, quarterly: quarterly.slice(-8) }) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "알 수 없는 action" }) };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
