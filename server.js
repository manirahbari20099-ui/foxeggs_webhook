// ============================================
//  🦊 Fox Eggs Webhook Server
//  Storage: File-based (persistent on Volume)
// ============================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================
//  💾 مسیر ذخیره‌سازی (روی Volume)
// ============================================
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const DB_FILE = path.join(DATA_DIR, 'referrals.json');

console.log(`📁 DB File Path: ${DB_FILE}`);

// ============================================
//  💾 توابع مدیریت فایل
// ============================================
function ensureDir() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            console.log(`📁 Created dir: ${DATA_DIR}`);
        }
    } catch (e) {
        console.error('❌ Cannot create data dir:', e.message);
    }
}

function readDB() {
    try {
        ensureDir();
        if (!fs.existsSync(DB_FILE)) {
            return {};
        }
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw || '{}');
    } catch (e) {
        console.error('❌ Read DB error:', e.message);
        return {};
    }
}

function writeDB(data) {
    try {
        ensureDir();
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('❌ Write DB error:', e.message);
        return false;
    }
}

// ============================================
//  📝 ثبت‌نام Referral
// ============================================
app.post('/api/register', (req, res) => {
    const { userId, refCode, timestamp } = req.body;

    console.log(`📝 Registration: ${userId} | Ref: ${refCode}`);

    if (!userId || !refCode) {
        return res.json({ success: false, error: 'missing_params' });
    }

    const code = String(refCode).trim().toUpperCase();

    if (!/^[A-Z0-9]{4,10}$/.test(code)) {
        return res.json({ success: false, error: 'invalid_code' });
    }

    const db = readDB();

    if (!db[code]) {
        db[code] = [];
    }

    const exists = db[code].some(entry => {
        if (typeof entry === 'string') return entry === userId;
        return entry.userId === userId;
    });

    if (!exists) {
        db[code].push({
            userId: userId,
            timestamp: timestamp || Date.now()
        });

        if (writeDB(db)) {
            console.log(`✅ Saved: ${userId} → ${code} (total: ${db[code].length})`);
            res.json({ success: true, message: 'Registration saved' });
        } else {
            res.json({ success: false, error: 'write_failed' });
        }
    } else {
        console.log(`⚠️ Duplicate ignored: ${userId}`);
        res.json({ success: true, message: 'Already registered' });
    }
});

// ============================================
//  📊 گرفتن لیست Referral ها
// ============================================
app.get('/api/referrals/:refCode', (req, res) => {
    try {
        const code = req.params.refCode.toUpperCase();
        const db = readDB();
        const list = db[code] || [];

        const userIds = list.map(entry => {
            if (typeof entry === 'string') return entry;
            return entry.userId;
        });

        res.json({
            success: true,
            count: userIds.length,
            referrals: userIds
        });
    } catch (e) {
        console.error('❌ Error in /api/referrals:', e.message);
        res.json({ success: false, error: 'server_error' });
    }
});

// ============================================
//  📊 آمار کلی
// ============================================
app.get('/api/stats', (req, res) => {
    try {
        const db = readDB();
        let total = 0;
        for (const key in db) {
            total += db[key].length;
        }
        res.json({
            success: true,
            totalRegistrations: total,
            totalReferrers: Object.keys(db).length
        });
    } catch (e) {
        res.json({ success: false, error: 'server_error' });
    }
});

// ============================================
//  🩺 Health Check
// ============================================
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Benula Webhook',
        version: '2.0.0',
        storage: 'file',
        dbFile: DB_FILE
    });
});

// ============================================
//  🚀 شروع سرور
// ============================================
app.listen(PORT, () => {
    console.log(`🚀 Webhook server running on port ${PORT}`);
    console.log(`📁 Data directory: ${DATA_DIR}`);
    ensureDir();
});
