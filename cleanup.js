// ============================================
//  🧹 Cleanup Script
//  Referral های قدیمی‌تر از ۷۲ ساعت رو پاک می‌کنه
//  توسط Cron Job اجرا می‌شه
// ============================================

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const DB_FILE = path.join(DATA_DIR, 'referrals.json');

// ⏰ حداکثر عمر (۷۲ ساعت)
const MAX_AGE_MS = 72 * 60 * 60 * 1000;

console.log('🧹 Cleanup started...');
console.log(`📁 File: ${DB_FILE}`);
console.log(`⏰ Max age: 72 hours`);

function cleanup() {
    if (!fs.existsSync(DB_FILE)) {
        console.log('⚠️ DB file not found. Nothing to do.');
        return;
    }

    let db;
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error('❌ Cannot read DB:', e.message);
        return;
    }

    const now = Date.now();
    let totalRemoved = 0;
    let totalKept = 0;

    for (const code in db) {
        const list = db[code];

        if (!Array.isArray(list)) {
            db[code] = [];
            continue;
        }

        const filtered = list.filter(entry => {
            if (typeof entry === 'string') return true;

            const ts = entry.timestamp || 0;
            const age = now - ts;
            return age < MAX_AGE_MS;
        });

        totalRemoved += list.length - filtered.length;
        totalKept += filtered.length;
        db[code] = filtered;
    }

    // پاک کردن کدهای خالی
    for (const code in db) {
        if (db[code].length === 0) {
            delete db[code];
        }
    }

    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
        console.log(`✅ Cleanup finished!`);
        console.log(`   🗑️ Removed: ${totalRemoved}`);
        console.log(`   ✅ Kept: ${totalKept}`);
    } catch (e) {
        console.error('❌ Write error:', e.message);
    }
}

cleanup();
