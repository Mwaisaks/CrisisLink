import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("crisislink.db");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    description TEXT,
    latitude REAL,
    longitude REAL,
    severity TEXT,
    status TEXT DEFAULT 'active',
    verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS dispatches (
    id TEXT PRIMARY KEY,
    alert_id TEXT,
    organisation_id TEXT,
    dispatched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at DATETIME,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(alert_id) REFERENCES alerts(id)
  );
`);

// Migration: Add missing columns if they don't exist
const addColumn = (table: string, column: string, type: string) => {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
    console.log(`Added column ${column} to ${table}`);
  } catch (e: any) {
    if (!e.message.includes("duplicate column name")) {
      console.error(`Error adding column ${column} to ${table}:`, e.message);
    }
  }
};

addColumn("alerts", "reporter_name", "TEXT");
addColumn("alerts", "reporter_phone", "TEXT");
addColumn("alerts", "additional_notes", "TEXT");
addColumn("alerts", "vulnerable_detected", "INTEGER DEFAULT 0");
addColumn("organisations", "rejection_reason", "TEXT");
addColumn("organisations", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");
addColumn("organisations", "contact_phone", "TEXT");
addColumn("organisations", "description", "TEXT");
addColumn("organisations", "needs_money", "INTEGER DEFAULT 0");
addColumn("organisations", "needs_food", "INTEGER DEFAULT 0");
addColumn("organisations", "needs_clothing", "INTEGER DEFAULT 0");
addColumn("organisations", "needs_medical", "INTEGER DEFAULT 0");
addColumn("organisations", "drop_off_location", "TEXT");
addColumn("organisations", "website_url", "TEXT");
addColumn("alerts", "ai_summary", "TEXT");
addColumn("alerts", "address_full", "TEXT");
addColumn("alerts", "address_area", "TEXT");
addColumn("alerts", "address_city", "TEXT");
addColumn("alerts", "location_method", "TEXT");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get all active alerts for the map
  app.get("/api/alerts", (req, res) => {
    const alerts = db.prepare("SELECT * FROM alerts WHERE status = 'active' ORDER BY created_at DESC").all();
    res.json(alerts);
  });

  // Submit a new alert
  app.post("/api/alerts", (req, res) => {
    const { id, type, description, latitude, longitude, severity, ai_guidance, ai_summary, reference_id, photo_url, vulnerable_detected } = req.body;
    try {
      const db_transaction = db.transaction(() => {
        const stmt = db.prepare(`
          INSERT INTO alerts (id, type, description, latitude, longitude, severity, ai_guidance, ai_summary, reference_id, photo_url, vulnerable_detected)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(id, type, description, latitude, longitude, severity, ai_guidance, ai_summary, reference_id, photo_url, vulnerable_detected ? 1 : 0);

        // Proximity Dispatch Logic
        // Find organisations within 50km (approx 0.45 degrees) that are active
        const nearbyOrgs = db.prepare(`
          SELECT id, contact_email FROM organisations 
          WHERE status = 'active' 
          AND (ABS(latitude - ?) < 0.45) 
          AND (ABS(longitude - ?) < 0.45)
        `).all(latitude, longitude);

        for (const org of nearbyOrgs as any[]) {
          const dispatchId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO dispatches (id, alert_id, organisation_id)
            VALUES (?, ?, ?)
          `).run(dispatchId, id, org.id);
          
          console.log(`[DISPATCH] Alert ${reference_id} sent to ${org.contact_email}`);
        }
      });

      db_transaction();
      res.status(201).json({ success: true, id });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update reporter details for an alert
  app.post("/api/alerts/:id/reporter-details", (req, res) => {
    const { name, phone, notes } = req.body;
    try {
      db.prepare(`
        UPDATE alerts 
        SET reporter_name = ?, reporter_phone = ?, additional_notes = ?
        WHERE id = ?
      `).run(name, phone, notes, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get dispatched organisations for a specific alert
  app.get("/api/alerts/:id/dispatched-orgs", (req, res) => {
    const alert = db.prepare("SELECT latitude, longitude FROM alerts WHERE id = ?").get(req.params.id) as any;
    if (!alert) return res.status(404).json({ error: "Alert not found" });

    const orgs = db.prepare(`
      SELECT 
        o.name, 
        o.type, 
        o.latitude, 
        o.longitude, 
        o.contact_email,
        (ABS(o.latitude - ?) + ABS(o.longitude - ?)) * 111 as distance_km
      FROM dispatches d
      JOIN organisations o ON d.organisation_id = o.id
      WHERE d.alert_id = ?
    `).all(alert.latitude, alert.longitude, req.params.id);
    
    res.json(orgs);
  });

  // Admin: Get all organisations for approval
  app.get("/api/admin/organisations", (req, res) => {
    const orgs = db.prepare("SELECT * FROM organisations ORDER BY status DESC").all();
    res.json(orgs);
  });

  // Organisation Registration
  app.post("/api/organisations/register", (req, res) => {
    const { id, name, type, latitude, longitude, service_radius, contact_email, contact_phone, donation_url, description, needs_money, needs_food, needs_clothing, needs_medical, drop_off_location, website_url } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO organisations (id, name, type, latitude, longitude, service_radius, contact_email, contact_phone, donation_url, description, needs_money, needs_food, needs_clothing, needs_medical, drop_off_location, website_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, name, type, latitude, longitude, service_radius, contact_email, contact_phone, donation_url, description, needs_money ? 1 : 0, needs_food ? 1 : 0, needs_clothing ? 1 : 0, needs_medical ? 1 : 0, drop_off_location, website_url);
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get dashboard stats
  app.get("/api/admin/stats", (req, res) => {
    const activeAlerts = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'active'").get() as any;
    const tier1Count = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'active' AND severity = 'Tier 1 — Critical'").get() as any;
    const pendingVerification = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE verified = 0 AND severity IN ('Tier 2 — High', 'Tier 3 — Moderate')").get() as any;
    const activeOrgs = db.prepare("SELECT COUNT(*) as count FROM organisations WHERE status = 'active'").get() as any;
    const pendingOrgs = db.prepare("SELECT COUNT(*) as count FROM organisations WHERE status = 'pending'").get() as any;

    res.json({
      activeAlerts: activeAlerts.count,
      hasTier1: tier1Count.count > 0,
      pendingVerification: pendingVerification.count,
      activeOrgs: activeOrgs.count,
      pendingOrgs: pendingOrgs.count
    });
  });

  // Admin: Get dispatch logs
  app.get("/api/admin/dispatch-logs", (req, res) => {
    const logs = db.prepare(`
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
    `).all();
    res.json(logs);
  });

  // Admin: Get alert details with dispatch log
  app.get("/api/admin/alerts/:id/details", (req, res) => {
    const alert = db.prepare("SELECT * FROM alerts WHERE id = ?").get(req.params.id);
    const dispatches = db.prepare(`
      SELECT o.name, d.dispatched_at, d.acknowledged_at
      FROM dispatches d
      JOIN organisations o ON d.organisation_id = o.id
      WHERE d.alert_id = ?
    `).all(req.params.id);
    res.json({ ...alert, dispatches });
  });

  // Admin: Approve/Reject organisation
  app.post("/api/admin/organisations/:id/status", (req, res) => {
    const { status, rejection_reason } = req.body;
    db.prepare("UPDATE organisations SET status = ?, rejection_reason = ? WHERE id = ?").run(status, rejection_reason || null, req.params.id);
    res.json({ success: true });
  });

  // Admin: Verify/Reject alert
  app.post("/api/admin/alerts/:id/verify", (req, res) => {
    const { verified } = req.body;
    db.prepare("UPDATE alerts SET verified = ? WHERE id = ?").run(verified ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  // Organisation: Get dispatched alerts
  app.get("/api/organisations/:id/alerts", (req, res) => {
    const alerts = db.prepare(`
      SELECT a.*, d.dispatched_at, d.acknowledged_at 
      FROM alerts a
      JOIN dispatches d ON a.id = d.alert_id
      WHERE d.organisation_id = ?
      ORDER BY d.dispatched_at DESC
    `).all(req.params.id);
    res.json(alerts);
  });

  // Organisation: Acknowledge alert
  app.post("/api/organisations/:orgId/alerts/:alertId/acknowledge", (req, res) => {
    db.prepare(`
      UPDATE dispatches 
      SET acknowledged_at = CURRENT_TIMESTAMP 
      WHERE organisation_id = ? AND alert_id = ?
    `).run(req.params.orgId, req.params.alertId);
    res.json({ success: true });
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
  app.get("/api/alerts/:id/comments", (req, res) => {
    try {
      const stmt = db.prepare("SELECT * FROM comments WHERE alert_id = ? ORDER BY created_at DESC");
      const comments = stmt.all(req.params.id);
      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/alerts/:id/comments", (req, res) => {
    const { id, text, author_name } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO comments (id, alert_id, text, author_name) VALUES (?, ?, ?, ?)");
      stmt.run(id, req.params.id, text, author_name || 'Community Member');
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/comments/:id/flag", (req, res) => {
    try {
      const stmt = db.prepare("UPDATE comments SET flagged = 1 WHERE id = ?");
      stmt.run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/comments/:id", (req, res) => {
    try {
      const stmt = db.prepare("DELETE FROM comments WHERE id = ?");
      stmt.run(req.params.id);
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
