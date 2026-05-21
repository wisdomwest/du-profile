const axios = require('axios');
const xml2js = require('xml2js');
const { getDB, dbRun } = require('../config/db');

const OAI_URL = 'https://repository.daystar.ac.ke/server/oai/request';
const BASE_REST = 'https://repository.daystar.ac.ke/server/api';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Robust wrapper around axios requests that automatically retries on transient errors
 * (rate limiting 429, service unavailable 503, gateway timeout 504, or network timeout)
 * using exponential backoff up to 5 times.
 */
async function fetchWithRetry(url, config, attempt = 1) {
  try {
    const response = await axios.get(url, config);
    return response;
  } catch (err) {
    const status = err.response?.status;
    console.error(`[Harvest] Request failed (status=${status || 'network'}, attempt=${attempt}): ${err.message}`);
    
    // Retry on rate limit (429), server busy (503), timeout (504), or empty/network drops
    if (attempt < 5 && (status === 429 || status === 503 || status === 504 || !status)) {
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[Harvest] Rate limited or server busy. Retrying in ${delay}ms...`);
      await sleep(delay);
      return fetchWithRetry(url, config, attempt + 1);
    }
    throw err;
  }
}


/**
 * Helper to identify if a record represents an academic course, syllabus, outline, or exam paper.
 */
function isCourseRecord(r) {
  if (!r) return false;
  const title = (r.title || '').trim();
  const authors = (r.authors || '').trim();

  // 1. Matches course codes: 3-4 letters followed by optional spaces, then a digit (or O/o as fallback) and 2 digits (plus optional letters)
  // e.g. PEA 141A/T, ACS 213, CHD 651X, ICM O56T
  const courseCodeRegex = /^[A-Z]{3,4}\s*[0-9O]\d{2}/i;
  if (courseCodeRegex.test(title)) {
    return true;
  }

  // 2. Authors matches 'Daystar University' exactly (case-insensitive)
  if (authors.toLowerCase() === 'daystar university') {
    return true;
  }

  // 3. Authors contains 'Department of' and 'School of' in capitalized/any case (e.g. from department course outlines)
  const authorsUpper = authors.toUpperCase();
  if (authorsUpper.includes('DEPARTMENT OF') && authorsUpper.includes('SCHOOL OF')) {
    return true;
  }

  // 4. Matches standard course outline / syllabus / marking scheme titles
  const titleLower = title.toLowerCase();
  if (
    titleLower.includes('course outline') ||
    titleLower.includes('marking scheme') ||
    titleLower.includes('course syllabus') ||
    titleLower.includes('question paper') ||
    titleLower.includes('exam paper') ||
    titleLower.includes('examination paper')
  ) {
    return true;
  }

  return false;
}

/**
 * Normalizes individual row fields for standard DB insertions.
 * Compatible with CSV imports (string keys) and live harvest feeds.
 */
function normaliseRow(row) {
  const get = (...keys) => {
    for (const k of keys) {
      const match = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
      if (match && row[match] !== undefined && row[match] !== null && String(row[match]).trim() !== '')
        return String(row[match]).trim();
    }
    return '';
  };

  if (row._clean) return row;

  return {
    title: get('title') || 'Untitled',
    authors: get('authors', 'author', 'contributors', 'dc.contributor.author'),
    year: parseInt(get('year', 'date', 'dc.date.issued')) || 2024,
    school: get('school', 'school_code') || '',
    type: get('type', 'type_clean', 'pubtype') || 'Journal Article',
    publisher: get('publisher', 'journal', 'venue', 'dc.publisher'),
    sdgs: get('sdgs', 'sdg'),
    indexing: get('indexing', 'indexed') || 'Verify',
    url: get('url', 'handle', 'link', 'dc.identifier.uri') || 'https://repository.daystar.ac.ke',
    abstract: get('abstract', 'description', 'dc.description.abstract').substring(0, 600),
  };
}

/**
 * Inserts rows inside an ACID transaction to drastically improve SQLite write throughput.
 */
async function insertPublications(rows, source, community, schoolCode = null) {
  const conn = getDB();

  // Fetch existing URLs and titles to prevent duplication of default/empty URL records
  let existingUrls = new Set();
  let existingTitles = new Set();
  try {
    const existing = await new Promise((resolve, reject) => {
      conn.all("SELECT title, url FROM publications", (err, res) => {
        if (err) reject(err);
        else resolve(res || []);
      });
    });
    existingUrls = new Set(existing.map(e => e.url).filter(u => u && u !== 'https://repository.daystar.ac.ke'));
    existingTitles = new Set(existing.map(e => (e.title || '').trim().toLowerCase()));
  } catch (dbErr) {
    console.error('[DB] Failed to pre-fetch existing records for de-duplication:', dbErr.message);
  }

  return new Promise((resolve, reject) => {
    conn.serialize(async () => {
      try {
        // Start Transaction
        await dbRun('BEGIN TRANSACTION;');

        // UPSERT strategy: We completely avoid dropping database tables or deleting records by default.
        // This preserves manually uploaded publications and other schools' publications.
        console.log(`[DB] Transaction: Merging ${rows.length} records into database via UPSERT...`);

        const stmt = conn.prepare(`
          INSERT INTO publications (title, authors, year, school, type, publisher, sdgs, indexing, url, abstract)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(url) WHERE url != 'https://repository.daystar.ac.ke' AND url != ''
          DO UPDATE SET
            title = excluded.title,
            authors = excluded.authors,
            year = excluded.year,
            school = CASE
              WHEN publications.school IS NULL OR publications.school = ''
              THEN excluded.school
              ELSE publications.school
            END,
            type = excluded.type,
            publisher = excluded.publisher,
            sdgs = coalesce(nullif(excluded.sdgs, ''), publications.sdgs),
            indexing = excluded.indexing,
            abstract = coalesce(nullif(excluded.abstract, ''), publications.abstract)
        `);

        let count = 0;
        for (const row of rows) {
          const r = normaliseRow(row);
          if (isCourseRecord(r)) {
            continue;
          }

          // Strict de-duplication: If the URL is empty or the default Daystar repository URL,
          // check if a record with the same title already exists in the database.
          if (!r.url || r.url === 'https://repository.daystar.ac.ke') {
            if (existingTitles.has((r.title || '').trim().toLowerCase())) {
              continue;
            }
          }

          stmt.run(r.title, r.authors, r.year, r.school, r.type, r.publisher, r.sdgs, r.indexing, r.url, r.abstract);
          count++;
        }

        stmt.finalize(async (err) => {
          if (err) {
            console.error('[DB] Insert serialization error:', err);
            await dbRun('ROLLBACK;');
            return reject(err);
          }

          try {
            await dbRun('COMMIT;');
            console.log(`[DB] Transaction committed successfully: ${count} records inserted/merged`);

            resolve(count);
          } catch (commitErr) {
            console.error('[DB] Commit error:', commitErr);
            await dbRun('ROLLBACK;');
            reject(commitErr);
          }
        });
      } catch (transactionErr) {
        console.error('[DB] Transaction execution failed:', transactionErr);
        await dbRun('ROLLBACK;');
        reject(transactionErr);
      }
    });
  });
}

/**
 * Harvests publications from a specific DSpace community via the DSpace REST Search API.
 */
async function harvestREST(communityId, schoolCode, query = null) {
  const records = [];
  let page = 0;
  console.log(`[Harvest] Starting REST harvest: community=${communityId || 'Global'}, school=${schoolCode || 'All'}, query=${query || 'None'}`);

  while (true) {
    try {
      const params = { dsoType: 'item', size: 100, page, embed: 'item' };
      if (communityId) params.scope = communityId;
      if (query) params.query = query;

      const { data } = await fetchWithRetry(`${BASE_REST}/discover/search/objects`, {
        params,
        headers: { Accept: 'application/json' },
        timeout: 30000,
      });
      const objects = data?._embedded?.searchResult?._embedded?.objects || [];
      if (!objects.length) break;

      for (const obj of objects) {
        const meta = obj?._embedded?.indexableObject?.metadata || {};
        const mv = k => (meta[k] || []).map(v => v.value).join(' | ');
        const rec = {
          title: mv('dc.title'),
          authors: mv('dc.contributor.author'),
          year: mv('dc.date.issued').substring(0, 4),
          school: schoolCode || '',
          type_raw: mv('dc.type'),
          publisher: mv('dc.publisher'),
          subject: mv('dc.subject'),
          abstract: mv('dc.description.abstract').substring(0, 600),
          url: mv('dc.identifier.uri') || 'https://repository.daystar.ac.ke',
        };
        if (isCourseRecord(rec)) continue;
        records.push(rec);
      }
      console.log(`[Harvest] REST page ${page} fetched ${records.length} records so far`);
      page++;
      
      // Polite sleep delay of 300ms between consecutive REST page calls
      await sleep(300);

      if (records.length >= 10000) break;
    } catch (e) {
      console.error('[Harvest] REST page error:', e.message);
      break;
    }
  }
  return records;
}

/**
 * Harvests publications from DSpace OAI-PMH protocol (full repository harvest).
 */
async function harvestOAI() {
  const records = [];
  let token = null;
  let page = 0;
  console.log('[Harvest] Starting full OAI-PMH harvest...');

  while (records.length < 10000) { // Support up to 10k items
    try {
      const params = token
        ? { verb: 'ListRecords', resumptionToken: token }
        : { verb: 'ListRecords', metadataPrefix: 'oai_dc' };
      
      const { data: xml } = await fetchWithRetry(OAI_URL, { params, timeout: 30000 });
      const result = await new xml2js.Parser().parseStringPromise(xml);
      const root = result['OAI-PMH'];
      if (!root || root.error) {
        console.warn('[Harvest] OAI error in response or empty payload');
        break;
      }

      const listRec = root.ListRecords?.[0];
      if (!listRec) break;

      let pageCount = 0;
      for (const rec of listRec.record || []) {
        if (rec.header?.[0]?.$?.status === 'deleted') continue;
        const dc = rec.metadata?.[0]?.['oai_dc:dc']?.[0];
        if (!dc) continue;
        const g = tag => (dc[tag] || []).join(' | ');
        let url = g('dc:identifier');
        if (!url.startsWith('http')) url = `https://repository.daystar.ac.ke/handle/${url}`;
        
        const rawRec = {
          title: g('dc:title'),
          authors: g('dc:contributor'),
          year: g('dc:date').substring(0, 4),
          school: '',
          type_raw: g('dc:type'),
          publisher: g('dc:publisher'),
          subject: g('dc:subject'),
          abstract: g('dc:description').substring(0, 600),
          url,
        };
        if (isCourseRecord(rawRec)) continue;
        records.push(rawRec);
        pageCount++;
      }

      token = listRec.resumptionToken?.[0]?._ || null;
      console.log(`[Harvest] OAI page ${++page}: collected ${pageCount} records (total: ${records.length})`);
      if (!token) break;

      // Rate limiting: sleep 1.5 seconds between pagination requests to avoid DSpace blocks
      await sleep(1500);
    } catch (e) {
      console.error('[Harvest] OAI page error:', e.message);
      break;
    }
  }
  return records;
}

/**
 * Smart keyword-based classifier that maps a record to its respective Daystar school
 * based on metadata fields (title, subjects, publisher, abstract).
 */
function detectSchool(rec) {
  if (!rec) return '';
  const text = `${rec.title || ''} ${rec.subject || ''} ${rec.publisher || ''} ${rec.abstract || ''}`.toLowerCase();
  
  if (text.includes('theology') || text.includes('mission') || text.includes('biblical') || text.includes('pastor') || text.includes('church') || text.includes('religion') || text.includes('christian') || text.includes('ministry') || text.includes('scripture') || text.includes('theological') || text.includes('god ') || text.includes('faith')) {
    return 'SMT';
  }
  if (text.includes('nursing') || text.includes('midwifery') || text.includes('nurse')) {
    return 'SON';
  }
  if (text.includes('law') || text.includes('legal') || text.includes('court') || text.includes('constitution') || text.includes('judicial') || text.includes('justice') || text.includes('litigation') || text.includes('human rights')) {
    return 'SOL';
  }
  if (text.includes('communication') || text.includes('journalism') || text.includes('media') || text.includes('public relations') || text.includes('broadcast') || text.includes('television') || text.includes('radio') || text.includes('advertising') || text.includes('film') || text.includes('news')) {
    return 'SOC';
  }
  if (text.includes('business') || text.includes('economics') || text.includes('finance') || text.includes('accounting') || text.includes('marketing') || text.includes('microfinance') || text.includes('entrepreneurship') || text.includes('commerce') || text.includes('management') || text.includes('bank')) {
    return 'SBE';
  }
  if (text.includes('computer') || text.includes('science') || text.includes('engineering') || text.includes('health') || text.includes('medicine') || text.includes('biology') || text.includes('chemistry') || text.includes('mathematics') || text.includes('technology') || text.includes('network') || text.includes('software') || text.includes('database') || text.includes('clinical') || text.includes('patient') || text.includes('hospital') || text.includes('agriculture') || text.includes('environmental') || text.includes('groundwater') || text.includes('irrigation') || text.includes('climate')) {
    return 'SSEH';
  }
  if (text.includes('peace') || text.includes('conflict') || text.includes('counseling') || text.includes('psychology') || text.includes('social work') || text.includes('human sciences')) {
    return 'SHSS';
  }
  if (text.includes('arts') || text.includes('music') || text.includes('literature') || text.includes('kiswahili') || text.includes('english') || text.includes('sociology') || text.includes('history') || text.includes('philosophy') || text.includes('geography')) {
    return 'SASS';
  }
  return '';
}

/**
 * Categorizes and cleans harvested raw records into standard system shapes.
 */
function cleanRecord(rec, schoolCode) {
  const pub = (rec.publisher || '').toLowerCase();
  const title = (rec.title || '').toLowerCase();
  const type_raw = (rec.type_raw || '').toLowerCase();

  // 1. Classification type mapping
  let type = 'Other';
  if (type_raw.includes('article') || pub.includes('journal') || pub.includes('transactions')) type = 'Journal Article';
  else if (type_raw.includes('conference') || pub.includes('conference') || pub.includes('proceedings') || pub.includes('symposium')) type = 'Conference Paper';
  else if (type_raw.includes('book') || pub.includes('book') || pub.includes('press') || pub.includes('publishing') || pub.includes('chapter')) type = 'Book Chapter';
  else if (type_raw.includes('thesis') || title.includes('thesis') || title.includes('dissertation') || title.includes('phd') || title.includes('masters')) type = 'Thesis';
  else if (pub.includes('review') || pub.includes('studies') || pub.includes('research')) type = 'Journal Article';

  // 2. Indexing tier mapping
  let indexing = 'Verify';
  if (pub.includes('ieee')) indexing = 'IEEE Indexed';
  else if (pub.includes('scopus') || pub.includes('elsevier') || pub.includes('springer') || pub.includes('wiley') || pub.includes('taylor')) indexing = 'Indexed';
  else if (pub.includes('ajol')) indexing = 'AJOL';

  // 3. SDG keyword mappings
  const sub = (rec.subject || '').toLowerCase();
  const sdgs = new Set();
  if (sub.match(/health|medicine|nursing|disease|clinical/)) sdgs.add('SDG 3');
  if (sub.match(/education|learning|teaching|school|literacy/)) sdgs.add('SDG 4');
  if (sub.match(/gender|women|maternal|girl/)) sdgs.add('SDG 5');
  if (sub.match(/energy|renewable|electricity|solar/)) sdgs.add('SDG 7');
  if (sub.match(/econom|financ|business|employment|trade|microfinance/)) sdgs.add('SDG 8');
  if (sub.match(/technolog|innovation|infrastructure|digital|ai |artificial intelligence|internet/)) sdgs.add('SDG 9');
  if (sub.match(/inequalit|poverty|inclusion|marginali/)) sdgs.add('SDG 10');
  if (sub.match(/climate|environment|carbon|emission/)) sdgs.add('SDG 13');
  if (sub.match(/peace|justice|governance|law|rights|corruption/)) sdgs.add('SDG 16');
  if (sub.match(/partner|collaborat|international|bilateral/)) sdgs.add('SDG 17');

  return {
    _clean: true,
    title: rec.title || 'Untitled',
    authors: rec.authors || '',
    year: (() => {
      const raw = String(rec.year || '').trim();
      const match = raw.match(/(20\d{2}|19\d{2}|198\d|199\d)/);
      return match ? parseInt(match[1]) : 2024;
    })(),
    school: schoolCode || rec.school || detectSchool(rec),
    type,
    publisher: rec.publisher || '',
    sdgs: [...sdgs].join(' | '),
    indexing,
    url: rec.url || 'https://repository.daystar.ac.ke',
    abstract: rec.abstract || '',
  };
}

module.exports = {
  insertPublications,
  harvestREST,
  harvestOAI,
  cleanRecord,
  normaliseRow,
  isCourseRecord,
  detectSchool
};
