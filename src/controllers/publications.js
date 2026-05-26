const fs = require('fs');
const csvParse = require('csv-parser');
const { dbAll, dbRun } = require('../config/db');
const { insertPublications, harvestREST, harvestOAI, cleanRecord, detectSchool } = require('../services/harvest');
const { getAIInsight, performSDGReanalysis } = require('../services/ai');

// School configuration mapping (as defined in original server.js)
const SCHOOL_COMMUNITIES = [
  {
    code: 'SSEH', name: 'School of Science, Engineering & Health',
    ids: ['8c655324-39e5-4e5b-adbd-aa29cb8cd15b', '9155e821-d75c-4bab-88db-c2082e8a9c73']
  },
  {
    code: 'SBE', name: 'School of Business & Economics',
    ids: ['6376b529-60b9-4206-bb83-9eeb34309366', 'a07839dc-45cc-4939-9745-f436b2231246']
  },
  {
    code: 'SOC', name: 'School of Communication',
    ids: ['73e55efb-6b14-4dae-b066-59521a20f1a9', 'db55183c-2835-4cbf-99c3-775159655988']
  },
  {
    code: 'SOL', name: 'School of Law',
    ids: ['2fd10e1d-5e98-44b9-8b99-d2aec5040fe6', '84309d56-718b-47aa-8693-409081ebd780']
  },
  {
    code: 'SON', name: 'School of Nursing',
    ids: ['1d4d83d6-f74d-4c00-ab47-f67bcd71f4f4', '0c2dcf5d-55f3-4300-a0b0-af5db71e4252']
  },
  {
    code: 'SASS', name: 'School of Arts & Social Sciences',
    ids: ['abe1f592-0a04-4ab0-9a1e-1598919cd934', '5c8cbc65-275a-4664-97fd-9615f350a396']
  },
  {
    code: 'SHSS', name: 'School of Human & Social Sciences',
    ids: ['e8a7b5c0-0371-492c-a9f3-41a571039e09', '8d462beb-237c-4c8b-95c1-b859b8273384']
  },
  {
    code: 'SMT', name: 'School of Mission & Theology',
    ids: []
  }
];
let harvestInProgress = false;

/**
 * Clean up uploaded files securely.
 */
function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.error('[Cleanup] File deletion failed:', e.message);
  }
}

/**
 * GET /api/schools
 */
async function getSchools(req, res) {
  try {
    const list = SCHOOL_COMMUNITIES.map(s => ({
      code: s.code,
      name: s.name,
      hasIds: s.ids.length > 0
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/publications
 */
async function getPublications(req, res) {
  try {
    let sql = 'SELECT * FROM publications WHERE 1=1';
    const params = [];

    if (req.query.school && req.query.school !== 'all') {
      sql += ' AND school = ?';
      params.push(req.query.school);
    }
    if (req.query.year && req.query.year !== 'all') {
      sql += ' AND year = ?';
      params.push(parseInt(req.query.year, 10));
    }

    sql += ' ORDER BY year DESC, id DESC';
    
    // With persistent SQLite connection and indices, this is sub-millisecond execution!
    const rows = await dbAll(sql, params);
    
    res.json(rows.map(r => ({
      ...r,
      sdgs: r.sdgs ? r.sdgs.split('|').map(s => s.trim()).filter(Boolean) : []
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/stats
 */
async function getStats(req, res) {
  try {
    // Run concurrent queries efficiently using the warm connection pool
    const [total, byType, bySchool, years] = await Promise.all([
      dbAll('SELECT COUNT(*) n FROM publications'),
      dbAll('SELECT type, COUNT(*) n FROM publications GROUP BY type'),
      dbAll('SELECT school, COUNT(*) n FROM publications GROUP BY school ORDER BY n DESC'),
      dbAll('SELECT MIN(year) mn, MAX(year) mx FROM publications'),
    ]);

    res.json({
      total: total[0].n,
      byType,
      bySchool,
      years: years[0],
      log: []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/export-csv
 */
async function exportCSV(req, res) {
  try {
    const rows = await dbAll('SELECT title,authors,year,school,type,publisher,sdgs,indexing,url,abstract FROM publications');
    const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
    const hdr = 'title,authors,year,school,type,publisher,sdgs,indexing,url,abstract\n';
    
    const body = rows.map(r =>
      [r.title, r.authors, r.year, r.school, r.type, r.publisher, r.sdgs, r.indexing, r.url, r.abstract].map(esc).join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="duspace_publications.csv"');
    res.send(hdr + body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/upload-csv
 */
async function uploadCSV(req, res) {
  if (process.env.VERCEL) {
    return res.status(403).json({ error: 'CSV file uploads are disabled in the Vercel production environment because the serverless lambda filesystem is read-only. Please use a local environment or persistent disk hosting (e.g. Render) to import new records.' });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const rows = [];
  fs.createReadStream(req.file.path)
    .pipe(csvParse())
    .on('data', d => rows.push(d))
    .on('error', err => {
      cleanupFile(req.file.path);
      res.status(400).json({ error: err.message });
    })
    .on('end', () => {
      cleanupFile(req.file.path);
      if (!rows.length) return res.status(400).json({ error: 'CSV file is empty' });
      
      insertPublications(rows, 'csv', 'file upload')
        .then(count => res.json({ message: `Imported ${count} publications successfully`, count }))
        .catch(err => res.status(500).json({ error: err.message }));
    });
}

/**
 * POST /api/harvest
 */
async function harvest(req, res) {
  if (process.env.VERCEL) {
    return res.status(403).json({ error: 'DSpace live harvesting is disabled in the Vercel production environment because the serverless lambda filesystem is read-only. Please use a local environment or persistent disk hosting (e.g. Render) to execute live harvests.' });
  }
  const { schoolCode } = req.body || {};
  const isAll = !schoolCode || schoolCode === 'all';
  const school = !isAll
    ? SCHOOL_COMMUNITIES.find(s => s.code === schoolCode)
    : null;

  if (harvestInProgress) {
    return res.status(409).json({ error: 'A harvest operation is already in progress. Please wait for it to complete.' });
  }
  harvestInProgress = true;

  try {
    let totalInserted = 0;

    if (isAll) {
      // Harvest each school individually so every record gets its correct school code
      for (const sc of SCHOOL_COMMUNITIES) {
        console.log(`[Harvest] Starting school: ${sc.code}`);
        let schoolRecords = [];

        if (sc.ids.length > 0) {
          for (const communityId of sc.ids) {
            const recs = await harvestREST(communityId, sc.code);
            schoolRecords = schoolRecords.concat(recs);
          }
        } else {
          // SMT fallback — keyword search
          schoolRecords = await harvestREST(null, sc.code, 'theology OR mission OR biblical OR church OR christian OR religion OR pastor');
        }

        // De-duplicate within this school's records
        const seenUrl = new Set();
        const seenTitle = new Set();
        schoolRecords = schoolRecords.filter(r => {
          const url = r.url || '';
          const titleKey = (r.title || '').trim().toLowerCase().substring(0, 80);
          if (seenUrl.has(url) && url !== 'https://repository.daystar.ac.ke' && url !== '') return false;
          if (seenTitle.has(titleKey) && titleKey.length > 5) return false;
          seenUrl.add(url);
          seenTitle.add(titleKey);
          return true;
        });

        const cleaned = schoolRecords.map(r => cleanRecord(r, sc.code));
        const inserted = await insertPublications(cleaned, 'rest', sc.name, sc.code);
        totalInserted += inserted;
        console.log(`[Harvest] ${sc.code}: inserted ${inserted} records`);
      }

      return res.json({ message: `Harvested ${totalInserted} records across all schools`, count: totalInserted });
    }

    // Single school harvest
    let rawRecords = [];
    if (school && school.ids.length > 0) {
      for (const communityId of school.ids) {
        const recs = await harvestREST(communityId, school.code);
        rawRecords = rawRecords.concat(recs);
      }
    } else if (school) {
      rawRecords = await harvestREST(null, school.code, 'theology OR mission OR biblical OR church OR christian OR religion OR pastor');
    }

    const seenUrl = new Set();
    const seenTitle = new Set();
    rawRecords = rawRecords.filter(r => {
      const url = r.url || '';
      const titleKey = (r.title || '').trim().toLowerCase().substring(0, 80);
      if (seenUrl.has(url) && url !== 'https://repository.daystar.ac.ke' && url !== '') return false;
      if (seenTitle.has(titleKey) && titleKey.length > 5) return false;
      seenUrl.add(url);
      seenTitle.add(titleKey);
      return true;
    });

    const cleaned = rawRecords.map(r => cleanRecord(r, school?.code || ''));
    const count = await insertPublications(cleaned, 'rest', school?.name || 'Unknown', school?.code || null);

    res.json({ message: `Harvested ${count} records from ${school?.name || 'school'}`, count });
  } catch (err) {
    console.error('[Harvest Controller Error]:', err);
    res.status(500).json({ error: err.message });
  } finally {
    harvestInProgress = false;
  }
}



/**
 * POST /api/ai-insight
 */
async function aiInsight(req, res) {
  const { prompt, apiKey } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const response = await getAIInsight(prompt, apiKey);
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/reanalyze-sdgs
 */
async function reanalyzeSDGs(req, res) {
  if (process.env.VERCEL) {
    return res.status(403).json({ error: 'AI SDG re-analysis write operations are disabled in the Vercel production environment because the serverless lambda filesystem is read-only. Please use a local environment or persistent disk hosting (e.g. Render) to re-analyze records.' });
  }
  try {
    const updatedCount = await performSDGReanalysis();
    res.json({ message: `Successfully re-analyzed ${updatedCount} publications with AI`, count: updatedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getFacultyList(req, res) {
  try {
    const publications = await dbAll('SELECT * FROM publications');
    
    const authorsMap = {};
    publications.forEach(p => {
      const authorList = (p.authors || '').split(/[;|]/).map(a => a.trim()).filter(a => a.length > 3);
      authorList.forEach(a => {
        if (!authorsMap[a]) {
          authorsMap[a] = {
            name: a,
            publications: [],
            school: p.school || ''
          };
        }
        authorsMap[a].publications.push(p);
        if (p.school) {
          authorsMap[a].school = p.school;
        }
      });
    });

    const faculty = Object.entries(authorsMap)
      .map(([name, data]) => {
        const pubs = data.publications;
        const years = pubs.map(p => p.year).filter(Boolean);
        const sdgs = [...new Set(pubs.flatMap(p => p.sdgs ? p.sdgs.split('|').map(s => s.trim()).filter(Boolean) : []))];
        const slug = slugify(name);
        return {
          name,
          slug,
          school: data.school || 'Other',
          pubCount: pubs.length,
          activeYears: years.length ? `${Math.min(...years)}–${Math.max(...years)}` : 'Unknown',
          lastActive: years.length ? Math.max(...years) : 2024,
          sdgs,
          indexingCount: pubs.filter(p => p.indexing && p.indexing !== 'Verify').length
        };
      })
      .filter(f => f.pubCount >= 2)
      .sort((a, b) => b.pubCount - a.pubCount);

    res.json(faculty);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getFacultyProfile(req, res) {
  const { slug } = req.params;
  try {
    const publications = await dbAll('SELECT * FROM publications');
    
    const authorsMap = {};
    publications.forEach(p => {
      const authorList = (p.authors || '').split(/[;|]/).map(a => a.trim()).filter(a => a.length > 3);
      authorList.forEach(a => {
        if (!authorsMap[a]) {
          authorsMap[a] = [];
        }
        authorsMap[a].push(p);
      });
    });

    let matchedAuthor = null;
    let dbAuthorName = null;
    
    for (const author of Object.keys(authorsMap)) {
      if (slugify(author) === slug) {
        matchedAuthor = authorsMap[author];
        dbAuthorName = author;
        break;
      }
    }
    
    if (!matchedAuthor) {
      const slugParts = slug.split('-');
      for (const author of Object.keys(authorsMap)) {
        const authorSlug = slugify(author);
        if (slugParts.every(part => authorSlug.includes(part))) {
          matchedAuthor = authorsMap[author];
          dbAuthorName = author;
          break;
        }
      }
    }

    if (!matchedAuthor) {
      return res.status(404).json({ error: `Researcher not found for slug '${slug}'` });
    }

    const pubs = matchedAuthor.map(r => ({
      ...r,
      sdgs: r.sdgs ? r.sdgs.split('|').map(s => s.trim()).filter(Boolean) : []
    })).sort((a, b) => b.year - a.year);

    const years = pubs.map(p => p.year).filter(Boolean);
    const activeYears = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : 'Unknown';
    const lastActive = years.length ? Math.max(...years) : 2024;
    const activeSince = years.length ? Math.min(...years) : 2008;

    const schoolCounts = {};
    pubs.forEach(p => {
      if (p.school) schoolCounts[p.school] = (schoolCounts[p.school] || 0) + 1;
    });
    let school = 'Other';
    let maxSchoolCount = 0;
    Object.entries(schoolCounts).forEach(([sc, count]) => {
      if (count > maxSchoolCount) {
        maxSchoolCount = count;
        school = sc;
      }
    });

    const textCorpus = pubs.map(p => `${p.title} ${p.abstract} ${p.publisher}`).join(' ').toLowerCase();
    const clusters = new Set();
    if (textCorpus.includes('health') || textCorpus.includes('clinic') || textCorpus.includes('patient') || textCorpus.includes('nurs') || textCorpus.includes('diseas')) {
      clusters.add('Community health');
    }
    if (textCorpus.includes('media') || textCorpus.includes('journalism') || textCorpus.includes('communication') || textCorpus.includes('governance')) {
      clusters.add('Media & governance');
    }
    if (textCorpus.includes('business') || textCorpus.includes('econ') || textCorpus.includes('financ') || textCorpus.includes('marketing')) {
      clusters.add('Business & economics');
    }
    if (textCorpus.includes('computer') || textCorpus.includes('ai') || textCorpus.includes('technology') || textCorpus.includes('algorithm') || textCorpus.includes('digital')) {
      clusters.add('AI & technology');
    }
    if (textCorpus.includes('education') || textCorpus.includes('school') || textCorpus.includes('learning') || textCorpus.includes('student')) {
      clusters.add('Education & dev.');
    }
    if (clusters.size === 0) {
      if (school === 'SSEH') clusters.add('Community health');
      else if (school === 'SOC') clusters.add('Media & governance');
      else if (school === 'SBE') clusters.add('Business & economics');
      else clusters.add('Education & dev.');
    }

    const methodologies = new Set();
    if (textCorpus.includes('model') || textCorpus.includes('statistical') || textCorpus.includes('quantitative') || textCorpus.includes('mathematical') || textCorpus.includes('regression') || textCorpus.includes('bayesian') || textCorpus.includes('data')) {
      methodologies.add('Quantitative');
    }
    if (textCorpus.includes('bayesian') || textCorpus.includes('prior') || textCorpus.includes('posterior')) {
      methodologies.add('Bayesian modelling');
    }
    if (textCorpus.includes('survey') || textCorpus.includes('questionnaire') || textCorpus.includes('interview') || textCorpus.includes('mixed')) {
      methodologies.add('Mixed methods');
    }
    if (textCorpus.includes('qualitative') || textCorpus.includes('focus group') || textCorpus.includes('thematic')) {
      methodologies.add('Qualitative');
    }
    if (textCorpus.includes('secondary data') || textCorpus.includes('kdhs') || textCorpus.includes('census') || textCorpus.includes('demographic')) {
      methodologies.add('Secondary data');
    }
    if (methodologies.size === 0) {
      methodologies.add('Mixed methods');
    }

    const sdgs = [...new Set(pubs.flatMap(p => p.sdgs))];

    const grants = [];
    if (pubs.length >= 5) {
      grants.push('NRF eligible');
    }
    if (school === 'SSEH' || school === 'SOC' || school === 'SBE' || school === 'SON') {
      grants.push('IDRC eligible');
    }
    if (grants.length === 0) {
      grants.push('Check eligibility');
    }

    const collaborators = new Set();
    pubs.forEach(p => {
      const coAuthors = (p.authors || '').split(/[;|]/).map(a => a.trim()).filter(a => a.length > 3 && a !== dbAuthorName);
      coAuthors.forEach(ca => collaborators.add(ca.split(',')[0]));
      
      const pubLower = p.publisher.toLowerCase();
      if (pubLower.includes('nairobi') || pubLower.includes('uon')) collaborators.add('Univ. of Nairobi');
      if (pubLower.includes('kemri')) collaborators.add('KEMRI');
      if (pubLower.includes('health') || pubLower.includes('moh')) collaborators.add('MOH Kenya');
    });

    const collabList = [...collaborators].slice(0, 5);
    if (collabList.length === 0) {
      collabList.push('DRICE Network');
    }

    const trendYears = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
    const trendValues = trendYears.map(yr => pubs.filter(p => String(p.year) === yr).length);

    res.json({
      name: dbAuthorName,
      slug,
      school,
      pubCount: pubs.length,
      activeYears,
      activeSince,
      lastActive,
      verifiedCount: pubs.filter(p => p.indexing && p.indexing !== 'Verify').length,
      clusters: [...clusters],
      methodologies: [...methodologies],
      sdgs,
      grants,
      collaborators: collabList,
      trend: {
        years: trendYears,
        values: trendValues,
        rising: trendValues[trendValues.length - 1] >= trendValues[trendValues.length - 2] ? 'Rising' : 'Stable'
      },
      publications: pubs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getSchools,
  getPublications,
  getStats,
  exportCSV,
  uploadCSV,
  harvest,
  aiInsight,
  reanalyzeSDGs,
  getFacultyList,
  getFacultyProfile
};
