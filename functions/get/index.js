/*
 * @Author: YuWenqiang
 * @Date: 2021-06-16 18:36:43
 * @Description: 通用查询云函数
 */
const cloud = require('wx-server-sdk');

cloud.init();
const db = cloud.database();

/**
 * 云函数主入口
 * @param {object} event - 事件对象
 * @param {object} context - 上下文对象
 * @returns {Promise<object>} 查询结果
 */
exports.main = async (event, context) => {
  try {
    const { userInfo = {}, tbName, query = {} } = event;
    const openId = userInfo.openId;

    // 参数校验
    if (!tbName) {
      throw new Error('表名不能为空');
    }

    // 如果openId为true，则把本人openId添加到查询条件
    if (query.openId === true) {
      query.openId = openId;
    }

    // 执行查询
    const res = await db.collection(tbName).where(query).get();

    // 如果是用户表且无数据，自动创建默认用户
    if (tbName === 'users' && res.data.length === 0 && openId) {
      return await createDefaultUser(openId);
    }

    // 如果是查询pk，合并members信息从user表获取
    if (tbName === 'pk' && query._id && res.data[0] && res.data[0].members) {
      const members = res.data[0].members;
      const openIds = members.map(member => member.openId).filter(Boolean);
      
      if (openIds.length > 0) {
        // 批量查询用户信息
        const userResults = await db.collection('users').where({
          openId: db.command.in(openIds)
        }).get();
        
        // 将用户信息与成员信息合并
        res.data[0].members = userResults.data;
      }
    }

    return res;
  } catch (error) {
    console.error('get云函数执行失败:', error);
    return {
      errMsg: error.message || '查询失败',
      errCode: -1,
      data: []
    };
  }
};

/**
 * 创建默认用户
 * @param {string} openId - 用户openId
 * @returns {Promise<object>} 用户数据
 */
async function createDefaultUser(openId) {
  try {
    const defaultUser = {
      openId,
      nickName: '微信用户(默认昵称)',
      avatarUrl: 'http://cdnjson.com/images/2025/02/19/132.jpg',
      createdate: new Date()
    };

    await db.collection('users').add({ data: defaultUser });

    return {
      data: [defaultUser]
    };
  } catch (error) {
    console.error('创建默认用户失败:', error);
    throw error;
  }
}