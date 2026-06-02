const cloud = require('wx-server-sdk')
// cloud.init({
//   env: cloud.DYNAMIC_CURRENT_ENV
// })
cloud.init()
const db = cloud.database()
const DEFAULT_PAGE_SIZE = 100
const DEFAULT_MAX_RECORDS = 10000

async function fetchAll(collection, query, field, order, size, maxRecords) {
  let allData = []
  let skip = 0
  let hasMore = true
  const pageSize = Math.min(size, DEFAULT_PAGE_SIZE)

  while (hasMore && allData.length < maxRecords) {
    const limit = Math.min(pageSize, maxRecords - allData.length)
    const res = await collection
      .where(query)
      .orderBy(field, order)
      .skip(skip)
      .limit(limit)
      .get()

    const batch = res.data || []
    allData = allData.concat(batch)
    skip += batch.length
    hasMore = batch.length === limit
  }

  return {
    data: allData,
    total: allData.length,
    hasMore,
    limit: maxRecords
  }
}

// 根据表名和query对象查询数据
exports.main = async (event, context) => {
  let openId = event.userInfo.openId;
  let tbName = event.tbName; // 要查询的表名
  let query = event.query || {};  // 要查询的query条件
  let page = Number(event.page || 1);
  let size = Number(event.size || DEFAULT_PAGE_SIZE);
  let field = event.field;
  let order = event.order;
  const fetchAllFlag = event.fetchAll === true || event.all === true;
  const maxRecords = Math.max(1, Number(event.maxRecords || DEFAULT_MAX_RECORDS));

  if (!field){
    field = "_id"
  } 
  if (!order) {
    order = "desc"
  }
  if (!Number.isFinite(page) || page < 1) {
    page = 1
  }
  if (!Number.isFinite(size) || size < 1) {
    size = DEFAULT_PAGE_SIZE
  }

  // 如果openId为ture, 则把openId添加到查询条件
  if (query.openId === true) {
    query.openId = openId
  }
  console.log(event.query)
  try {
    const collection = db.collection(tbName)
    if (fetchAllFlag) {
      return await fetchAll(collection, query, field, order, size, maxRecords)
    }
    return await collection.where(query).orderBy(field, order).skip((page - 1) * size).limit(size).get()
  } catch (e) {
    console.error(e)
    return {
      errCode: -1,
      errMsg: e.message || 'list query failed'
    }
  }
}
