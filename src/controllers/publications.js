const fs = require('fs');
const csvParse = require('csv-parser');
const { dbAll, dbRun } = require('../config/db');
const { insertPublications, harvestREST, harvestOAI, cleanRecord } = require('../services/harvest');
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
    const [total, byType, bySchool, years, log] = await Promise.all([
      dbAll('SELECT COUNT(*) n FROM publications'),
      dbAll('SELECT type, COUNT(*) n FROM publications GROUP BY type'),
      dbAll('SELECT school, COUNT(*) n FROM publications GROUP BY school ORDER BY n DESC'),
      dbAll('SELECT MIN(year) mn, MAX(year) mx FROM publications'),
      dbAll('SELECT * FROM harvest_log ORDER BY ts DESC LIMIT 10'),
    ]);

    res.json({
      total: total[0].n,
      byType,
      bySchool,
      years: years[0],
      log
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
  const { schoolCode } = req.body || {};
  const school = schoolCode && schoolCode !== 'all'
    ? SCHOOL_COMMUNITIES.find(s => s.code === schoolCode)
    : null;

  try {
    let rawRecords = [];

    if (school && school.ids.length > 0) {
      // DSpace REST Harvesting per school communities
      for (const communityId of school.ids) {
        const recs = await harvestREST(communityId, school.code);
        rawRecords = rawRecords.concat(recs);
      }
      
      // Strict senior-developer level de-duplication routines
      const seenUrl = new Set();
      const seenTitle = new Set();
      rawRecords = rawRecords.filter(r => {
        const url = r.url || '';
        const titleKey = (r.title || '').trim().toLowerCase().substring(0, 80);
        if (seenUrl.has(url) && url !== 'https://repository.daystar.ac.ke') return false;
        if (seenTitle.has(titleKey) && titleKey.length > 5) return false;
        seenUrl.add(url);
        seenTitle.add(titleKey);
        return true;
      });
    } else if (school) {
      // School has no UUID configurations - fallback to OAI and filter by code
      rawRecords = await harvestOAI();
      rawRecords = rawRecords.filter(r => r.school === schoolCode);
    } else {
      // All schools - full OAI-PMH harvest
      rawRecords = await harvestOAI();
    }

    const cleaned = rawRecords.map(r => cleanRecord(r, school?.code || ''));
    const count = await insertPublications(cleaned, school ? 'rest' : 'oai', school?.name || 'All', school?.code || null);
    
    res.json({ message: `Harvested ${count} records from ${school?.name || 'all communities'}`, count });
  } catch (err) {
    console.error('[Harvest Controller Error]:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/publications
 */
async function clearDatabase(req, res) {
  try {
    await dbRun('DELETE FROM publications');
    res.json({ message: 'Database publications cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
  try {
    const updatedCount = await performSDGReanalysis();
    res.json({ message: `Successfully re-analyzed ${updatedCount} publications with AI`, count: updatedCount });
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
  clearDatabase,
  aiInsight,
  reanalyzeSDGs
};
