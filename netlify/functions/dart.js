const https = require("https");
const zlib  = require("zlib");

// ── HTTP GET → Buffer ────────────────────────────────────────────
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // 리다이렉트 처리
      if (res.statusCode === 302 || res.statusCode === 301) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

// ── HTTP GET → JSON ──────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error("JSON parse: " + raw.slice(0, 100))); }
      });
    }).on("error", reject);
  });
}

// ── ZIP 파일에서 첫 번째 텍스트 파일 추출 ───────────────────────
function extractZip(buf) {
  try {
    // End of Central Directory 시그니처 탐색
    const EOCD = 0x06054b50;
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
      if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
    }
    if (eocd === -1) throw new Error("EOCD not found");

    const cdCount  = buf.readUInt16LE(eocd + 10);
    const cdOffset = buf.readUInt32LE(eocd + 16);

    let pos = cdOffset;
    for (let i = 0; i < cdCount; i++) {
      if (buf.readUInt32LE(pos) !== 0x02014b50) break;
      const method       = buf.readUInt16LE(pos + 10);
      const compSz       = buf.readUInt32LE(pos + 20);
      const fnLen        = buf.readUInt16LE(pos + 28);
      const exLen        = buf.readUInt16LE(pos + 30);
      const cmLen        = buf.readUInt16LE(pos + 32);
      const localOff     = buf.readUInt32LE(pos + 42);

      // Local file header
      const lfh      = localOff;
      const lfnLen   = buf.readUInt16LE(lfh + 26);
      const lexLen   = buf.readUInt16LE(lfh + 28);
      const dataStart = lfh + 30 + lfnLen + lexLen;
      const compData  = buf.slice(dataStart, dataStart + compSz);

      let text;
      if (method === 0) text = compData.toString("utf8");
      else if (method === 8) text = zlib.inflateRawSync(compData).toString("utf8");
      else { pos += 46 + fnLen + exLen + cmLen; continue; }

      return text; // 첫 번째 파일 반환
    }
    throw new Error("No extractable file found");
  } catch (e) {
    throw new Error("ZIP 파싱 실패: " + e.message);
  }
}

// ── CORPCODE.xml에서 기업명으로 검색 ────────────────────────────
function searchCorpXml(xml, query) {
  const results = [];
  const q = query.trim();
  // <list> ... </list> 블록 탐색
  let start = 0;
  while (true) {
    const s = xml.indexOf("<list>", start);
    if (s === -1) break;
    const e = xml.indexOf("</list>", s);
    if (e === -1) break;
    const block = xml.slice(s + 6, e);

    const corp_code  = (block.match(/<corp_code>(\d+)<\/corp_code>/)   || [])[1];
    const corp_name  = (block.match(/<corp_name>([^<]+)<\/corp_name>/) || [])[1] || "";
    const stock_code = (block.match(/<stock_code>([^<]+)<\/stock_code>/) || [])[1] || "";

    // 검색어 포함 여부 (대소문자 무관)
    if (corp_code && corp_name.includes(q)) {
      // 상장사 우선 정렬: stock_code 있으면 앞으로
      results.push({ corp_code, corp_name, stock_code: stock_code.trim() });
      if (results.length >= 10) break;
    }
    start = e + 7;
  }
  // 상장사 먼저, 그 다음 비상장
  results.sort((a, b) => (b.stock_code ? 1 : 0) - (a.stock_code ? 1 : 0));
  return results.slice(0, 5);
}

// ── 금액 문자열 → 억원 ──────────────────────────────────────────
function toUk(str) {
  if (!str || str === "-" || str.trim() === "") return null;
  const s = str.replace(/,/g, "").trim();
  let n = s.startsWith("(") && s.endsWith(")")
    ? -parseInt(s.slice(1, -1), 10)
    : parseInt(s, 10);
  if (isNaN(n)) return null;
  return Math.round(n / 100_000_000);
}

// ── DART 재무제표에서 주요 계정 추출 ────────────────────────────
function extract(d) {
  if (!d || d.status !== "000" || !d.list) return null;
  let revenue = null, opProfit = null, netProfit = null;
  for (const item of d.list) {
    const nm  = (item.account_nm || "").trim();
    const val = toUk(item.thstrm_amount);
    if (val === null) continue;
    if (revenue   === null && /^(매출액|수익\(매출액\)|영업수익)$/.test(nm))           revenue   = val;
    if (opProfit  === null && /영업이익/.test(nm))                                       opProfit  = val;
    if (netProfit === null && /^(당기순이익|당기순이익\(손실\)|분기순이익|분기순이익\(손실\))$/.test(nm)) netProfit = val;
  }
  if (revenue === null && opProfit === null) return null;
  return { revenue, opProfit, netProfit };
}

// ── 재무제표 1건 fetch (CFS → OFS 폴백) ─────────────────────────
async function fetchFin(key, code, year, reprt) {
  const base = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${key}&corp_code=${code}&bsns_year=${year}&reprt_code=${reprt}`;
  try {
    const r1 = extract(await fetchJson(base + "&fs_div=CFS"));
    if (r1) return r1;
    return extract(await fetchJson(base + "&fs_div=OFS"));
  } catch { return null; }
}

// ── 두 기간 차이 (Standalone 분기) ──────────────────────────────
function diff(a, b) {
  if (!a || !b) return null;
  const sub = (x, y) => (x !== null && y !== null) ? x - y : null;
  return { revenue: sub(a.revenue,b.revenue), opProfit: sub(a.opProfit,b.opProfit), netProfit: sub(a.netProfit,b.netProfit) };
}

// ════════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  const KEY  = process.env.DART_API_KEY;
  if (!KEY) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "DART_API_KEY 환경변수가 설정되지 않았습니다." }) };

  const p      = event.queryStringParameters || {};
  const action = p.action;

  try {
    // ── 1. 기업 검색 ─────────────────────────────────────────────
    if (action === "search_corp") {
      const query = (p.corp_name || "").trim();
      if (!query) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "corp_name 필요" }) };

      // DART 전체 기업코드 ZIP 다운로드 후 XML에서 검색
      const zipBuf = await fetchBuffer(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${KEY}`);
      const xml    = extractZip(zipBuf);
      const corps  = searchCorpXml(xml, query);

      if (!corps.length)
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false, message: `"${query}"에 해당하는 기업을 찾을 수 없습니다.` }) };

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: true, corps }) };
    }

    // ── 2. 재무 데이터 로드 ──────────────────────────────────────
    if (action === "get_financials") {
      const corpCode = p.corp_code;
      if (!corpCode) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "corp_code 필요" }) };

      const now  = new Date();
      const curY = now.getFullYear();
      const latestAnnual = now.getMonth() >= 3 ? curY - 1 : curY - 2;

      // 연간 5개년 (병렬)
      const annYears = Array.from({ length: 5 }, (_, i) => String(latestAnnual - i));
      const annRaw   = await Promise.all(annYears.map(y => fetchFin(KEY, corpCode, y, "11011")));
      const annual   = annYears
        .map((year, i) => annRaw[i] ? { year, ...annRaw[i] } : null)
        .filter(Boolean).reverse();

      // 분기 8개 (최근 3개년 누적치 병렬 수집)
      const qYears  = [String(latestAnnual), String(latestAnnual - 1), String(latestAnnual - 2)];
      const QCODES  = ["11011", "11014", "11012", "11013"];
      const fetches = qYears.flatMap(y => QCODES.map(c => ({ y, c })));
      const rawAll  = await Promise.all(fetches.map(f => fetchFin(KEY, corpCode, f.y, f.c)));

      const cumMap = {};
      fetches.forEach(({ y, c }, i) => {
        if (!cumMap[y]) cumMap[y] = {};
        cumMap[y][c] = rawAll[i];
      });

      const quarterly = [];
      for (const yr of qYears) {
        const cm = cumMap[yr] || {};
        const q1 = cm["11013"];
        const q2 = diff(cm["11012"], cm["11013"]);
        const q3 = diff(cm["11014"], cm["11012"]);
        const q4 = diff(cm["11011"], cm["11014"]);
        const yy = yr.slice(2);
        if (q1 && q1.revenue !== null) quarterly.push({ quarter: yy + "Q1", ...q1 });
        if (q2 && q2.revenue !== null) quarterly.push({ quarter: yy + "Q2", ...q2 });
        if (q3 && q3.revenue !== null) quarterly.push({ quarter: yy + "Q3", ...q3 });
        if (q4 && q4.revenue !== null) quarterly.push({ quarter: yy + "Q4", ...q4 });
      }
      quarterly.sort((a, b) => a.quarter.localeCompare(b.quarter));

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ annual, quarterly: quarterly.slice(-8) }) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "알 수 없는 action" }) };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
