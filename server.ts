import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Airtable from 'airtable';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Airtable Setup
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const airtableBaseId = process.env.AIRTABLE_BASE;
const airtableTableName = process.env.AIRTABLE_TABLE || 'jnt';

if (!airtableApiKey || !airtableBaseId) {
  console.warn('Airtable credentials not fully configured in environment variables.');
}

const base = airtableApiKey && airtableBaseId ? new Airtable({ apiKey: airtableApiKey }).base(airtableBaseId) : null;

app.use(express.json());

// API Route for tracking
app.get('/api/tracking/:resi', async (req, res) => {
  const { resi } = req.params;

  if (!base) {
    return res.status(500).json({ error: 'Airtable is not configured' });
  }

  try {
    const records = await base(airtableTableName)
      .select({
        filterByFormula: `{nomorResi} = '${resi}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return res.status(404).json({ error: 'No tracking data found for this resi number' });
    }

    const record = records[0];
    res.json(record.fields);
  } catch (error) {
    console.error('Airtable Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch data from Airtable' });
  }
});

// API Route to update refund info
app.patch('/api/tracking/:resi', async (req, res) => {
  const { resi } = req.params;
  const { refund_bank, refund_account_number, refund_account_holder } = req.body;

  if (!base) {
    return res.status(500).json({ error: 'Airtable is not configured' });
  }

  try {
    // 1. Find the record ID first
    const records = await base(airtableTableName)
      .select({
        filterByFormula: `{nomorResi} = '${resi}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return res.status(404).json({ error: 'No tracking data found for this resi number' });
    }

    const recordId = records[0].id;

    // 2. Prepare fields for update
    const fields: any = {
      refund_bank,
      refund_account_holder
    };

    // Safely handle the number conversion
    if (refund_account_number !== undefined && refund_account_number !== '') {
      const numValue = Number(refund_account_number);
      if (!isNaN(numValue)) {
        fields.refund_account_number = numValue;
      }
    }

    // 3. Update the record
    const updatedRecord = await base(airtableTableName).update(recordId, fields);

    res.json(updatedRecord.fields);
  } catch (error: any) {
    console.error('Airtable Update Error Detailed:', {
      message: error.message,
      error: error.error, // Airtable puts specific error code here
      statusCode: error.statusCode
    });
    res.status(500).json({ 
      error: 'Failed to update data in Airtable',
      details: error.message
    });
  }
});

// API Route to fetch payment methods
app.get('/api/payment-methods', async (req, res) => {
  if (!base) {
    return res.status(500).json({ error: 'Airtable is not configured' });
  }

  try {
    const records = await base('metode_pembayaran')
      .select({
        filterByFormula: '{status} = 1',
      })
      .all();

    const paymentMethods = records.map(record => ({
      id: record.id,
      vaName: record.get('vaName'),
      vaNumber: record.get('vaNumber'),
      img: record.get('img'),
      status: record.get('status')
    }));

    res.json(paymentMethods);
  } catch (error) {
    console.error('Airtable Payment Methods Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// API Route to proxy OSRM requests (bypasses CORS issues)
app.get('/api/route', async (req, res) => {
  const { lng1, lat1, lng2, lat2 } = req.query;

  if (!lng1 || !lat1 || !lng2 || !lat2) {
    return res.status(400).json({ error: 'Missing coordinates' });
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
    
    // Using simple fetch (Node 18+)
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OSRM responded with ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('OSRM Proxy Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch route from OSRM demo server' });
  }
});

async function startServer() {
  // Vite middleware for development (only when not in Vercel)
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Basic static serving for other environments
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only listen if not running in Vercel
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

// Automatically start if we are in dev/preview
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startServer();
}

export default app;
