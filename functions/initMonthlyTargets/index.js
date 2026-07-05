const cloud = require('wx-server-sdk');

cloud.init();

const db = cloud.database();
const _ = db.command;

function toWeight(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function isDuplicateError(err) {
  const message = String((err && (err.message || err.errMsg)) || err || '');
  return message.indexOf('duplicate') >= 0 || message.indexOf('E11000') >= 0;
}

async function addMissingTargets(targets, docs) {
  if (!docs.length) {
    return { inserted: 0, skippedExisting: 0, failed: 0 };
  }

  try {
    const res = await targets.add({ data: docs });
    const ids = res.ids || (res._id ? [res._id] : []);
    return { inserted: ids.length || docs.length, skippedExisting: 0, failed: 0 };
  } catch (err) {
    let inserted = 0;
    let skippedExisting = 0;
    let failed = 0;

    for (const doc of docs) {
      try {
        await targets.add({ data: doc });
        inserted += 1;
      } catch (itemErr) {
        if (isDuplicateError(itemErr)) {
          skippedExisting += 1;
        } else {
          failed += 1;
          console.error('monthly target insert failed:', itemErr, doc.openId);
        }
      }
    }

    return { inserted, skippedExisting, failed };
  }
}

exports.main = async (event = {}) => {
  const month = String(event.month || '').trim();
  const confirm = String(event.confirm || '');
  const pageSize = Math.min(100, Math.max(10, Number(event.pageSize || 100)));

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { ok: false, errMsg: 'month must be YYYY-MM' };
  }
  if (confirm !== `INIT_MONTHLY_TARGETS_${month}`) {
    return { ok: false, errMsg: 'confirm mismatch' };
  }

  const users = db.collection('users');
  const targets = db.collection('monthlyTargets');
  const now = new Date();
  let skip = 0;
  let scanned = 0;
  let valid = 0;
  let inserted = 0;
  let skippedExisting = 0;
  let skippedInvalid = 0;
  let failed = 0;

  while (true) {
    const userRes = await users
      .where({
        openId: _.exists(true),
        aimWeight: _.gt(0)
      })
      .field({
        openId: true,
        aimWeight: true,
        aimWeightKg: true
      })
      .skip(skip)
      .limit(pageSize)
      .get();

    const rows = userRes.data || [];
    if (!rows.length) break;

    scanned += rows.length;
    const openIds = rows.map((item) => item.openId).filter(Boolean);
    const existingRes = openIds.length
      ? await targets
        .where({
          month,
          openId: _.in(openIds)
        })
        .field({ openId: true })
        .limit(pageSize)
        .get()
      : { data: [] };
    const existingOpenIds = new Set((existingRes.data || []).map((item) => item.openId));
    const docs = [];

    rows.forEach((user) => {
      const openId = typeof user.openId === 'string' ? user.openId : '';
      const aimWeight = toWeight(user.aimWeight);
      if (!openId || !aimWeight) {
        skippedInvalid += 1;
        return;
      }
      valid += 1;
      if (existingOpenIds.has(openId)) {
        skippedExisting += 1;
        return;
      }
      const aimWeightKg = toWeight(user.aimWeightKg) || Number((aimWeight / 2).toFixed(2));
      docs.push({
        openId,
        month,
        aimWeight,
        aimWeightKg,
        createdate: now,
        updatedAt: now,
        source: 'migration_users_aimWeight'
      });
    });

    const result = await addMissingTargets(targets, docs);
    inserted += result.inserted;
    skippedExisting += result.skippedExisting;
    failed += result.failed;

    if (rows.length < pageSize) break;
    skip += rows.length;
  }

  const countRes = await targets.where({ month }).count();

  return {
    ok: true,
    month,
    scanned,
    valid,
    inserted,
    skippedExisting,
    skippedInvalid,
    failed,
    total: countRes.total
  };
};
