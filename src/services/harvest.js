const axios = require('axios');
const xml2js = require('xml2js');
const { getDB, dbRun } = require('../config/db');

const OAI_URL = 'https://repository.daystar.ac.ke/oai/request';
const BASE_REST = 'https://repository.daystar.ac.ke/server/api';

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
  return new Promise((resolve, reject) => {
    conn.serialize(async () => {
      try {
        // Start Transaction
        await dbRun('BEGIN TRANSACTION;');

        // School-specific live harvests clear only their respective school's records.
        // Full CSV uploads reset the database.
        if (schoolCode) {
          console.log(`[DB] Transaction: Clearing existing records for school: ${schoolCode}`);
          await dbRun('DELETE FROM publications WHERE school = ?', [schoolCode]);
        } else {
          console.log('[DB] Transaction: Clearing ALL publications (Full Reset)');
          await dbRun('DELETE FROM publications');
        }

        const stmt = conn.prepare(
          'INSERT INTO publications (title,authors,year,school,type,publisher,sdgs,indexing,url,abstract) VALUES (?,?,?,?,?,?,?,?,?,?)'
        );

        let count = 0;
        for (const row of rows) {
          const r = normaliseRow(row);
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
            console.log(`[DB] Transaction committed successfully: ${count} records inserted`);

            // Add an audit log entry
            await dbRun('INSERT INTO harvest_log (source,community,count,status) VALUES (?,?,?,?)', [
              source, community, count, 'success'
            ]);

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
async function harvestREST(communityId, schoolCode) {
  const records = [];
  let page = 0;
  console.log(`[Harvest] Starting REST harvest: community=${communityId}, school=${schoolCode}`);

  while (true) {
    try {
      const { data } = await axios.get(`${BASE_REST}/discover/search/objects`, {
        params: { scope: communityId, dsoType: 'item', size: 50, page, embed: 'item' }, // default size increased to 50 for speed
        headers: { Accept: 'application/json' },
        timeout: 30000,
      });
      const objects = data?._embedded?.searchResult?._embedded?.objects || [];
      if (!objects.length) break;

      for (const obj of objects) {
        const meta = obj?._embedded?.indexableObject?.metadata || {};
        const mv = k => (meta[k] || []).map(v => v.value).join(' | ');
        records.push({
          title: mv('dc.title'),
          authors: mv('dc.contributor.author'),
          year: mv('dc.date.issued').substring(0, 4),
          school: schoolCode,
          type_raw: mv('dc.type'),
          publisher: mv('dc.publisher'),
          subject: mv('dc.subject'),
          abstract: mv('dc.description.abstract').substring(0, 600),
          url: mv('dc.identifier.uri') || 'https://repository.daystar.ac.ke',
        });
      }
      console.log(`[Harvest] REST page ${page} fetched ${records.length} records so far`);
      page++;
      if (records.length >= 3000) break;
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

  while (records.length < 5000) {
    try {
      const params = token
        ? { verb: 'ListRecords', resumptionToken: token }
        : { verb: 'ListRecords', metadataPrefix: 'oai_dc' };
      
      const { data: xml } = await axios.get(OAI_URL, { params, timeout: 30000 });
      const result = await new xml2js.Parser().parseStringPromise(xml);
      const root = result['OAI-PMH'];
      if (!root || root.error) break;

      const listRec = root.ListRecords?.[0];
      if (!listRec) break;

      for (const rec of listRec.record || []) {
        if (rec.header?.[0]?.$?.status === 'deleted') continue;
        const dc = rec.metadata?.[0]?.['oai_dc:dc']?.[0];
        if (!dc) continue;
        const g = tag => (dc[tag] || []).join(' | ');
        let url = g('dc:identifier');
        if (!url.startsWith('http')) url = `https://repository.daystar.ac.ke/handle/${url}`;
        
        records.push({
          title: g('dc:title'),
          authors: g('dc:contributor'),
          year: g('dc:date').substring(0, 4),
          school: '',
          type_raw: g('dc:type'),
          publisher: g('dc:publisher'),
          subject: g('dc:subject'),
          abstract: g('dc:description').substring(0, 600),
          url,
        });
      }

      token = listRec.resumptionToken?.[0]?._ || null;
      console.log(`[Harvest] OAI page ${++page}: collected ${records.length} records`);
      if (!token) break;
    } catch (e) {
      console.error('[Harvest] OAI page error:', e.message);
      break;
    }
  }
  return records;
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
    school: schoolCode || rec.school || '',
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
  normaliseRow
};
