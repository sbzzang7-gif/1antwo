// Netlify Edge Function — DART API proxy
// Deno runtime, Cloudflare edge network

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  return res.json();
}

function toUk(str) {
  if (!str || str === "-" || str.trim() === "") return null;
  const s = str.replace(/,/g, "").trim();
  const n = s.startsWith("(") && s.endsWith(")")
    ? -parseInt(s.slice(1, -1), 10)
    : parseInt(s, 10);
  if (isNaN(n)) return null;
  return Math.round(n / 100000000);
}

function extract(d) {
  if (!d || d.status !== "000" || !d.list) return null;
  let revenue = null, opProfit = null, netProfit = null;
  for (const item of d.list) {
    const nm = (item.account_nm || "").trim();
    const val = toUk(item.thstrm_amount);
    if (val === null) continue;
    if (revenue === null && /^(매출액|수익\(매출액\)|영업수익)$/.test(nm)) revenue = val;
    if (opProfit === null && /영업이익/.test(nm)) opProfit = val;
    if (netProfit === null && /^(당기순이익|당기순이익\(손실\)|분기순이익|분기순이익\(손실\))$/.test(nm)) netProfit = val;
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

export default async (request, context) => {
  if (request.method === "OPTIONS") {
    return new Response("", { status: 200, headers: { ...CORS, "Access-Control-Allow-Methods": "GET", "Access-Control-Allow-Headers": "Content-Type" } });
  }

  const KEY = Deno.env.get("DART_API_KEY");
  if (!KEY) return json({ error: "DART_API_KEY 환경변수 없음" }, 500);

  const url = new URL(request.url);
  const p = Object.fromEntries(url.searchParams);
  const action = p.action;

  try {
    if (action === "search_corp") {
      const query = (p.corp_name || "").trim();
      if (!query) return json({ error: "corp_name 필요" }, 400);

      const name = encodeURIComponent(query);
      const base = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${KEY}&corp_name=${name}&page_count=10`;
      const [dA, dB, dI] = await Promise.all([
        fetchJson(base + "&pblntf_ty=A").catch(() => null),
        fetchJson(base + "&pblntf_ty=B").catch(() => null),
        fetchJson(base + "&pblntf_ty=I").catch(() => null),
      ]);

      if (dA === null && dB === null && dI === null) {
        return json({ found: false, message: "DART 서버 연결 실패. 잠시 후 다시 시도해주세요." });
      }

      const data = dA || dB || dI || { status: "999" };
      if (["010","011","012","020"].includes(data.status)) {
        const msgs = { "010":"등록되지 않은 API 키입니다.", "011":"사용할 수 없는 API 키입니다.", "012":"접근 IP가 차단되었습니다.", "020":"요청 한도 초과." };
        return json({ found: false, message: msgs[data.status] });
      }

      const merged = [dA, dB, dI]
        .filter(d => d && d.status === "000" && Array.isArray(d.list))
        .flatMap(d => d.list);

      if (!merged.length) {
        const statuses = [dA,dB,dI].filter(Boolean).map(d=>d.status).join(",");
        return json({ found: false, message: `"${query}" 검색 결과 없음 (status: ${statuses})` });
      }

      const seen = new Set();
      const corps = merged
        .filter(i => { if (seen.has(i.corp_code)) return false; seen.add(i.corp_code); return true; })
        .slice(0, 5)
        .map(i => ({ corp_code: i.corp_code, corp_name: i.corp_name, stock_code: i.stock_code || "" }));

      return json({ found: true, corps });
    }

    if (action === "get_financials") {
      const corpCode = p.corp_code;
      if (!corpCode) return json({ error: "corp_code 필요" }, 400);

      const now = new Date();
      const curY = now.getFullYear();
      const latestAnnual = now.getMonth() >= 3 ? curY - 1 : curY - 2;

      const annYears = Array.from({ length: 5 }, (_, i) => String(latestAnnual - i));
      const annRaw = await Promise.all(annYears.map(y => fetchFin(KEY, corpCode, y, "11011")));
      const annual = annYears.map((y, i) => annRaw[i] ? { year: y, ...annRaw[i] } : null).filter(Boolean).reverse();

      const qYears = [String(latestAnnual), String(latestAnnual - 1), String(latestAnnual - 2)];
      const QCODES = ["11011", "11014", "11012", "11013"];
      const fetches = qYears.flatMap(y => QCODES.map(c => ({ y, c })));
      const rawAll = await Promise.all(fetches.map(f => fetchFin(KEY, corpCode, f.y, f.c)));

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

      return json({ annual, quarterly: quarterly.slice(-8) });
    }

    return json({ error: "알 수 없는 action" }, 400);

  } catch (err) {
    return json({ error: err.message }, 500);
  }
};

export const config = { path: "/.netlify/functions/dart" };
