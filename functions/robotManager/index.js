/*
 * @Author: YuWenqiang
 * @Date: 2025-01-20
 * @Description: 机器人管理云函数 - 处理绑定/解绑、查询、配置更新
 */

const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

/**
 * 云函数主入口
 * @param {object} event - 事件对象
 * @param {object} context - 上下文对象
 * @returns {Promise<object>} 响应对象
 */
exports.main = async (event, context) => {
  try {
    const { action, userInfo } = event;
    const openId = userInfo?.openId;
    
    if (!openId) {
      return {
        errCode: -1,
        errMsg: '未获取到用户信息'
      };
    }
    
    switch (action) {
      case 'getBindings':
        return await getBindings(openId);
      
      case 'getConfig':
        return await getConfig(event.type, event.targetId, openId);
      
      case 'updateConfig':
        return await updateConfig(event.configId, event.config, openId);
      
      case 'updateSpeechStyle':
        return await updateSpeechStyle(event.configId, event.speechStyle, openId);
      
      case 'unbind':
        return await unbind(event.type, event.targetId, openId);
      
      default:
        return {
          errCode: -1,
          errMsg: '未知操作'
        };
    }
  } catch (error) {
    console.error('robotManager执行失败:', error);
    return {
      errCode: -1,
      errMsg: error.message || '操作失败'
    };
  }
};

/**
 * 获取绑定列表
 * @param {string} openId - 用户openId
 * @returns {Promise<object>} 绑定列表
 */
async function getBindings(openId) {
  try {
    // 查询个人绑定
    const userRes = await db.collection('users').where({
      openId: openId
    }).get();
    
    let personalBinding = null;
    if (userRes.data.length > 0 && userRes.data[0].mid) {
      const configRes = await db.collection('robotConfigs').where({
        targetId: userRes.data[0].mid,
        type: 'friend',
        status: 'active'
      }).get();
      
      if (configRes.data.length > 0) {
        personalBinding = {
          type: 'friend',
          targetId: userRes.data[0].mid,
          configId: configRes.data[0]._id,
          config: configRes.data[0]
        };
      }
    }
    
    // 查询PK群绑定（用户创建的PK）
    const pkRes = await db.collection('pk').where({
      openId: openId,
      gid: db.command.exists(true)
    }).get();
    
    const groupBindings = [];
    for (const pk of pkRes.data) {
      if (pk.gid) {
        const configRes = await db.collection('robotConfigs').where({
          targetId: pk.gid,
          type: 'group',
          status: 'active'
        }).get();
        
        if (configRes.data.length > 0) {
          groupBindings.push({
            type: 'group',
            targetId: pk.gid,
            pkId: pk._id,
            pkName: pk.name || '未命名PK',
            configId: configRes.data[0]._id,
            config: configRes.data[0]
          });
        }
      }
    }
    
    return {
      errCode: 0,
      data: {
        personal: personalBinding,
        groups: groupBindings
      }
    };
  } catch (error) {
    console.error('获取绑定列表失败:', error);
    throw error;
  }
}

/**
 * 获取配置信息
 * @param {string} type - 类型（'friend'或'group'）
 * @param {string} targetId - 目标ID
 * @param {string} openId - 用户openId
 * @returns {Promise<object>} 配置信息
 */
async function getConfig(type, targetId, openId) {
  try {
    // 验证权限
    if (type === 'friend') {
      const userRes = await db.collection('users').where({
        openId: openId,
        mid: targetId
      }).get();
      if (userRes.data.length === 0) {
        return {
          errCode: -1,
          errMsg: '无权限访问此配置'
        };
      }
    } else {
      // 检查用户是否是PK成员（不限制为发起人）
      const pkRes = await db.collection('pk').where({
        gid: targetId,
        'members.openId': openId
      }).get();
      if (pkRes.data.length === 0) {
        return {
          errCode: -1,
          errMsg: '无权限访问此配置'
        };
      }
    }
    
    const configRes = await db.collection('robotConfigs').where({
      targetId: targetId,
      type: type,
      status: 'active'
    }).get();
    
    if (configRes.data.length === 0) {
      return {
        errCode: -1,
        errMsg: '未找到配置信息'
      };
    }
    
    return {
      errCode: 0,
      data: configRes.data[0]
    };
  } catch (error) {
    console.error('获取配置失败:', error);
    throw error;
  }
}

/**
 * 更新配置
 * @param {string} configId - 配置ID
 * @param {object} config - 配置对象
 * @param {string} openId - 用户openId
 * @returns {Promise<object>} 更新结果
 */
async function updateConfig(configId, config, openId) {
  try {
    // 验证权限
    const configRes = await db.collection('robotConfigs').where({
      _id: configId
    }).get();
    
    if (configRes.data.length === 0) {
      return {
        errCode: -1,
        errMsg: '配置不存在'
      };
    }
    
    const configData = configRes.data[0];
    
    // 验证权限
    if (configData.type === 'friend') {
      const userRes = await db.collection('users').where({
        openId: openId,
        mid: configData.targetId
      }).get();
      if (userRes.data.length === 0) {
        return {
          errCode: -1,
          errMsg: '无权限修改此配置'
        };
      }
    } else {
      // 检查用户是否是PK成员（不限制为发起人）
      const pkRes = await db.collection('pk').where({
        gid: configData.targetId,
        'members.openId': openId
      }).get();
      if (pkRes.data.length === 0) {
        return {
          errCode: -1,
          errMsg: '无权限修改此配置'
        };
      }
    }
    
    // 更新配置（排除系统字段和只读字段）
    const { 
      _id, 
      createdAt, 
      updatedAt,  // 使用服务器时间，排除客户端传递的时间
      lastCheckInCheck,  // 打卡检查记录由系统自动维护，不应手动更新
      ...updateData 
    } = config;
    
    // 确保 updatedAt 使用服务器时间
    updateData.updatedAt = db.serverDate();
    
    const updateResult = await db.collection('robotConfigs').where({
      _id: configId
    }).update({
      data: updateData
    });
    
    console.log('更新配置结果:', updateResult);
    
    if (updateResult.stats.updated === 0) {
      return {
        errCode: -1,
        errMsg: '更新失败，未找到匹配的记录'
      };
    }
    
    return {
      errCode: 0,
      errMsg: '更新成功'
    };
  } catch (error) {
    console.error('更新配置失败:', error);
    return {
      errCode: -1,
      errMsg: error.message || '更新配置失败'
    };
  }
}

/**
 * 更新话术类型
 * @param {string} configId - 配置ID
 * @param {string} speechStyle - 话术类型
 * @param {string} openId - 用户openId
 * @returns {Promise<object>} 更新结果
 */
async function updateSpeechStyle(configId, speechStyle, openId) {
  try {
    // 验证权限（复用updateConfig的权限验证逻辑）
    const configRes = await db.collection('robotConfigs').where({
      _id: configId
    }).get();
    
    if (configRes.data.length === 0) {
      return {
        errCode: -1,
        errMsg: '配置不存在'
      };
    }
    
    const configData = configRes.data[0];
    
    // 验证权限
    if (configData.type === 'friend') {
      const userRes = await db.collection('users').where({
        openId: openId,
        mid: configData.targetId
      }).get();
      if (userRes.data.length === 0) {
        return {
          errCode: -1,
          errMsg: '无权限修改此配置'
        };
      }
    } else {
      // 检查用户是否是PK成员（不限制为发起人）
      const pkRes = await db.collection('pk').where({
        gid: configData.targetId,
        'members.openId': openId
      }).get();
      if (pkRes.data.length === 0) {
        return {
          errCode: -1,
          errMsg: '无权限修改此配置'
        };
      }
    }
    
    // 更新话术类型
    await db.collection('robotConfigs').where({
      _id: configId
    }).update({
      data: {
        speechStyle: speechStyle,
        updatedAt: db.serverDate()
      }
    });
    
    return {
      errCode: 0,
      errMsg: '更新成功'
    };
  } catch (error) {
    console.error('更新话术类型失败:', error);
    throw error;
  }
}

/**
 * 解绑
 * @param {string} type - 类型（'friend'或'group'）
 * @param {string} targetId - 目标ID
 * @param {string} openId - 用户openId
 * @returns {Promise<object>} 解绑结果
 */
async function unbind(type, targetId, openId) {
  try {
    if (type === 'friend') {
      // 验证权限
      const userRes = await db.collection('users').where({
        openId: openId,
        mid: targetId
      }).get();
      if (userRes.data.length === 0) {
        return {
          errCode: -1,
          errMsg: '无权限解绑'
        };
      }
      
      // 清空mid字段
      await db.collection('users').where({
        openId: openId
      }).update({
        data: {
          mid: null,
          updatedAt: db.serverDate()
        }
      });
      
      // 更新配置状态为inactive
      await db.collection('robotConfigs').where({
        targetId: targetId,
        type: 'friend'
      }).update({
        data: {
          status: 'inactive',
          updatedAt: db.serverDate()
        }
      });
    } else {
      // 群聊解绑
      const pkRes = await db.collection('pk').where({
        openId: openId,
        gid: targetId
      }).get();
      if (pkRes.data.length === 0) {
        return {
          errCode: -1,
          errMsg: '无权限解绑'
        };
      }
      
      // 清空gid字段
      await db.collection('pk').where({
        _id: pkRes.data[0]._id
      }).update({
        data: {
          gid: null,
          updatedAt: db.serverDate()
        }
      });
      
      // 更新配置状态为inactive
      await db.collection('robotConfigs').where({
        targetId: targetId,
        type: 'group'
      }).update({
        data: {
          status: 'inactive',
          updatedAt: db.serverDate()
        }
      });
    }
    
    return {
      errCode: 0,
      errMsg: '解绑成功'
    };
  } catch (error) {
    console.error('解绑失败:', error);
    throw error;
  }
}
