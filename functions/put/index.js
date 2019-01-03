const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
exports.main = async (event, context) => {
  try {
    return await db.collection('datas').doc(event.id).update({
      data: event.data
    })
  } catch (e) {
    console.error(e)
  }
}