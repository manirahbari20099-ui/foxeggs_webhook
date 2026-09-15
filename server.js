// ============================================
//  🦊 Fox Eggs Webhook Server
//  - Persistent storage (Volume)
//  - Auto cleanup (72h) on every startup
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
//  💾 مسیر ذخیره‌سازی
// ============================================
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const DB_FILE = path.join(DATA_DIR, 'referrals.json');

// ⏰ حداکثر عمر Referral (۷۲ ساعت)
const MAX_AGE_MS = 72 * 60 * 60 * 1000;

console.log(`📁 DB File: ${DB_FILE}`);

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
        if (!fs.existsSync(DB_FILE)) return {};
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
//  🧹 پاک‌سازی Referral های قدیمی
// ============================================
function cleanupOldReferrals() {
    console.log('🧹 Auto-cleanup started...');

    const db = readDB();
    const now = Date.now();
    let removed = 0;
    let kept = 0;

    for (const code in db) {
        const list = db[code];

        if (!Array.isArray(list)) {
            db[code] = [];
            continue;
        }

        const filtered = list.filter(entry => {
            // فرمت قدیمی (string): نگه دار
            if (typeof entry === 'string') return true;

            // فرمت جدید (object): بر اساس timestamp
            const ts = entry.timestamp || 0;
            const age = now - ts;
            return age < MAX_AGE_MS;
        });

        removed += list.length - filtered.length;
        kept += filtered.length;
        db[code] = filtered;
    }

    // پاک کردن کدهای خالی
    for (const code in db) {
        if (db[code].length === 0) {
            delete db[code];
        }
    }

    if (removed > 0) {
        writeDB(db);
        console.log(`✅ Cleanup done: removed=${removed}, kept=${kept}`);
    } else {
        console.log(`✅ Cleanup done: nothing to remove (kept=${kept})`);
    }
}

// ============================================
//  📝 ثبت Referral
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
        console.log(`⚠️ Duplicate: ${userId}`);
        res.json({ success: true, message: 'Already registered' });
    }
});

// ============================================
//  📊 گرفتن Referrals
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
        console.error('❌ Error:', e.message);
        res.json({ success: false, referrals: [] });
    }
});

// ============================================
//  📊 آمار
// ============================================
app.get('/api/stats', (req, res) => {
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
});

// ============================================
//  🩺 Health Check
// ============================================
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Benula Webhook',
        version: '3.0.0',
        storage: 'file',
        dbFile: DB_FILE,
        cleanup: 'auto (on startup)',
        maxAge: '72 hours'
    });
});

// ============================================
//  🚀 شروع سرور
// ============================================
app.listen(PORT, () => {
    console.log(`🚀 Server on port ${PORT}`);
    console.log(`📁 Data: ${DATA_DIR}`);

    ensureDir();

    // 🧹 پاک‌سازی خودکار در شروع
    cleanupOldReferrals();

    // 🧹 پاک‌سازی هر ۱ ساعت یه بار (وقتی سرور روشنه)
    setInterval(() => {
        cleanupOldReferrals();
    }, 60 * 60 * 1000);  // هر ۱ ساعت

    console.log(`⏰ Auto-cleanup scheduled every 1 hour`);
});
