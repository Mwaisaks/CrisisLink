import express from "express";
import { createServer as createViteServer } from "vite";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Handle pool errors to prevent process crashes
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Initialize Database Schema
async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.error('CRITICAL: DATABASE_URL environment variable is missing.');
    console.error('Please provide a valid PostgreSQL connection string in the Secrets panel.');
    return false;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS alerts (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          description TEXT,
          latitude REAL,
          longitude REAL,
          severity TEXT,
          status TEXT DEFAULT 'active',
          verified INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          photo_url TEXT,
          ai_guidance TEXT,
          reference_id TEXT UNIQUE,
          reporter_name TEXT,
          reporter_phone TEXT,
          additional_notes TEXT,
          vulnerable_detected INTEGER DEFAULT 0,
          ai_summary TEXT,
          address_full TEXT,
          address_area TEXT,
          address_city TEXT,
          location_method TEXT
        );

        CREATE TABLE IF NOT EXISTS organisations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          service_radius REAL,
          contact_email TEXT UNIQUE,
          contact_phone TEXT,
          status TEXT DEFAULT 'pending',
          donation_url TEXT,
          rejection_reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          description TEXT,
          needs_money INTEGER DEFAULT 0,
          needs_food INTEGER DEFAULT 0,
          needs_clothing INTEGER DEFAULT 0,
          needs_medical INTEGER DEFAULT 0,
          drop_off_location TEXT,
          website_url TEXT
        );

        CREATE TABLE IF NOT EXISTS dispatches (
          id TEXT PRIMARY KEY,
          alert_id TEXT,
          organisation_id TEXT,
          dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          acknowledged_at TIMESTAMP,
          FOREIGN KEY(alert_id) REFERENCES alerts(id),
          FOREIGN KEY(organisation_id) REFERENCES organisations(id)
        );

        CREATE TABLE IF NOT EXISTS admins (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          password_hash TEXT
        );

        CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY,
          alert_id TEXT,
          text TEXT,
          author_name TEXT,
          flagged INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(alert_id) REFERENCES alerts(id)
        );
      `);

      // Migration: Add missing columns if they don't exist
      const addColumn = async (table: string, column: string, type: string) => {
        try {
          await client.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
          console.log(`Added column ${column} to ${table}`);
        } catch (e: any) {
          if (!e.message.includes("already exists") && !e.message.includes("duplicate column name")) {
            console.error(`Error adding column ${column} to ${table}:`, e.message);
          }
        }
      };

      await addColumn("alerts", "reporter_name", "TEXT");
      await addColumn("alerts", "reporter_phone", "TEXT");
      await addColumn("alerts", "additional_notes", "TEXT");
      await addColumn("alerts", "vulnerable_detected", "INTEGER DEFAULT 0");
      await addColumn("organisations", "rejection_reason", "TEXT");
      await addColumn("organisations", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
      await addColumn("organisations", "contact_phone", "TEXT");
      await addColumn("organisations", "description", "TEXT");
      await addColumn("organisations", "needs_money", "INTEGER DEFAULT 0");
      await addColumn("organisations", "needs_food", "INTEGER DEFAULT 0");
      await addColumn("organisations", "needs_clothing", "INTEGER DEFAULT 0");
      await addColumn("organisations", "needs_medical", "INTEGER DEFAULT 0");
      await addColumn("organisations", "drop_off_location", "TEXT");
      await addColumn("organisations", "website_url", "TEXT");
      await addColumn("alerts", "ai_summary", "TEXT");
      await addColumn("alerts", "address_full", "TEXT");
      await addColumn("alerts", "address_area", "TEXT");
      await addColumn("alerts", "address_city", "TEXT");
      await addColumn("alerts", "location_method", "TEXT");
      
      return true;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('FAILED to connect to PostgreSQL database.');
    console.error('Error details:', error.message);
    console.error('Please check your DATABASE_URL and ensure the database is accessible.');
    return false;
  }
}

async function startServer() {
  const dbInitialized = await initDb();
  if (!dbInitialized) {
    console.warn('Server starting WITHOUT database connectivity. API routes will fail.');
  }
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get all active alerts for the map
  app.get("/api/alerts", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM alerts WHERE status = 'active' ORDER BY created_at DESC");
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Submit a new alert
  app.post("/api/alerts", async (req, res) => {
    const { id, type, description, latitude, longitude, severity, ai_guidance, ai_summary, reference_id, photo_url, vulnerable_detected } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO alerts (id, type, description, latitude, longitude, severity, ai_guidance, ai_summary, reference_id, photo_url, vulnerable_detected)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [id, type, description, latitude, longitude, severity, ai_guidance, ai_summary, reference_id, photo_url, vulnerable_detected ? 1 : 0]);

      // Proximity Dispatch Logic
      // Find organisations within 50km (approx 0.45 degrees) that are active
      const nearbyOrgsResult = await client.query(`
        SELECT id, contact_email FROM organisations 
        WHERE status = 'active' 
        AND (ABS(latitude - $1) < 0.45) 
        AND (ABS(longitude - $2) < 0.45)
      `, [latitude, longitude]);

      for (const org of nearbyOrgsResult.rows) {
        const dispatchId = crypto.randomUUID();
        await client.query(`
          INSERT INTO dispatches (id, alert_id, organisation_id)
          VALUES ($1, $2, $3)
        `, [dispatchId, id, org.id]);
        
        console.log(`[DISPATCH] Alert ${reference_id} sent to ${org.contact_email}`);
      }
      await client.query('COMMIT');
      res.status(201).json({ success: true, id });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error(error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  // Update reporter details for an alert
  app.post("/api/alerts/:id/reporter-details", async (req, res) => {
    const { name, phone, notes } = req.body;
    try {
      await pool.query(`
        UPDATE alerts 
        SET reporter_name = $1, reporter_phone = $2, additional_notes = $3
        WHERE id = $4
      `, [name, phone, notes, req.params.id]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get dispatched organisations for a specific alert
  app.get("/api/alerts/:id/dispatched-orgs", async (req, res) => {
    try {
      const alertResult = await pool.query("SELECT latitude, longitude FROM alerts WHERE id = $1", [req.params.id]);
      const alert = alertResult.rows[0];
      if (!alert) return res.status(404).json({ error: "Alert not found" });

      const orgsResult = await pool.query(`
        SELECT 
          o.name, 
          o.type, 
          o.latitude, 
          o.longitude, 
          o.contact_email,
          (ABS(o.latitude - $1) + ABS(o.longitude - $2)) * 111 as distance_km
        FROM dispatches d
        JOIN organisations o ON d.organisation_id = o.id
        WHERE d.alert_id = $3
      `, [alert.latitude, alert.longitude, req.params.id]);
      
      res.json(orgsResult.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get all organisations for approval
  app.get("/api/admin/organisations", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM organisations ORDER BY status DESC");
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Organisation Registration
  app.post("/api/organisations/register", async (req, res) => {
    const { id, name, type, latitude, longitude, service_radius, contact_email, contact_phone, donation_url, description, needs_money, needs_food, needs_clothing, needs_medical, drop_off_location, website_url } = req.body;
    try {
      await pool.query(`
        INSERT INTO organisations (id, name, type, latitude, longitude, service_radius, contact_email, contact_phone, donation_url, description, needs_money, needs_food, needs_clothing, needs_medical, drop_off_location, website_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [id, name, type, latitude, longitude, service_radius, contact_email, contact_phone, donation_url, description, needs_money ? 1 : 0, needs_food ? 1 : 0, needs_clothing ? 1 : 0, needs_medical ? 1 : 0, drop_off_location, website_url]);
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get dashboard stats
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const activeAlerts = await pool.query("SELECT COUNT(*) as count FROM alerts WHERE status = 'active'");
      const tier1Count = await pool.query("SELECT COUNT(*) as count FROM alerts WHERE status = 'active' AND severity = 'Tier 1 — Critical'");
      const pendingVerification = await pool.query("SELECT COUNT(*) as count FROM alerts WHERE verified = 0 AND severity IN ('Tier 2 — High', 'Tier 3 — Moderate')");
      const activeOrgs = await pool.query("SELECT COUNT(*) as count FROM organisations WHERE status = 'active'");
      const pendingOrgs = await pool.query("SELECT COUNT(*) as count FROM organisations WHERE status = 'pending'");

      res.json({
        activeAlerts: parseInt(activeAlerts.rows[0].count),
        hasTier1: parseInt(tier1Count.rows[0].count) > 0,
        pendingVerification: parseInt(pendingVerification.rows[0].count),
        activeOrgs: parseInt(activeOrgs.rows[0].count),
        pendingOrgs: parseInt(pendingOrgs.rows[0].count)
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get dispatch logs
  app.get("/api/admin/dispatch-logs", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          d.id, 
          d.alert_id, 
          a.type as crisis_type, 
          o.name as organisation_name, 
          d.dispatched_at, 
          d.acknowledged_at,
          a.reference_id
        FROM dispatches d
        JOIN alerts a ON d.alert_id = a.id
        JOIN organisations o ON d.organisation_id = o.id
        ORDER BY d.dispatched_at DESC
      `);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get alert details with dispatch log
  app.get("/api/admin/alerts/:id/details", async (req, res) => {
    try {
      const alertResult = await pool.query("SELECT * FROM alerts WHERE id = $1", [req.params.id]);
      const dispatchesResult = await pool.query(`
        SELECT o.name, d.dispatched_at, d.acknowledged_at
        FROM dispatches d
        JOIN organisations o ON d.organisation_id = o.id
        WHERE d.alert_id = $1
      `, [req.params.id]);
      res.json({ ...alertResult.rows[0], dispatches: dispatchesResult.rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Approve/Reject organisation
  app.post("/api/admin/organisations/:id/status", async (req, res) => {
    const { status, rejection_reason } = req.body;
    try {
      await pool.query("UPDATE organisations SET status = $1, rejection_reason = $2 WHERE id = $3", [status, rejection_reason || null, req.params.id]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Verify/Reject alert
  app.post("/api/admin/alerts/:id/verify", async (req, res) => {
    const { verified } = req.body;
    try {
      await pool.query("UPDATE alerts SET verified = $1 WHERE id = $2", [verified ? 1 : 0, req.params.id]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Organisation: Get dispatched alerts
  app.get("/api/organisations/:id/alerts", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT a.*, d.dispatched_at, d.acknowledged_at 
        FROM alerts a
        JOIN dispatches d ON a.id = d.alert_id
        WHERE d.organisation_id = $1
        ORDER BY d.dispatched_at DESC
      `, [req.params.id]);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Organisation: Acknowledge alert
  app.post("/api/organisations/:orgId/alerts/:alertId/acknowledge", async (req, res) => {
    try {
      await pool.query(`
        UPDATE dispatches 
        SET acknowledged_at = CURRENT_TIMESTAMP 
        WHERE organisation_id = $1 AND alert_id = $2
      `, [req.params.orgId, req.params.alertId]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // Comments
  app.get("/api/alerts/:id/comments", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM comments WHERE alert_id = $1 ORDER BY created_at DESC", [req.params.id]);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/alerts/:id/comments", async (req, res) => {
    const { id, text, author_name } = req.body;
    try {
      await pool.query("INSERT INTO comments (id, alert_id, text, author_name) VALUES ($1, $2, $3, $4)", [id, req.params.id, text, author_name || 'Community Member']);
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/comments/:id/flag", async (req, res) => {
    try {
      await pool.query("UPDATE comments SET flagged = 1 WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/comments/:id", async (req, res) => {
    try {
      await pool.query("DELETE FROM comments WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CrisisLink Africa server running on http://localhost:${PORT}`);
  });
}

startServer();
