/*
 * @Author: YuWenqiang
 * @Date: 2025-02-24 18:31:34
 * @Description: 微信机器人云函数 - 处理绑定、打卡触发、定时推送
 */

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV || 'release-ba24f3'
})
const db = cloud.database()

// 初始化云开发AI（用于生成话术）
let aiInstance = null;
try {
  const tcb = require('@cloudbase/node-sdk');
  const app = tcb.init({
    env: cloud.DYNAMIC_CURRENT_ENV || 'release-ba24f3'
  });
  aiInstance = app.ai();
} catch (error) {
  console.warn('AI初始化失败，将使用模板话术:', error.message);
}

/**
 * 云函数主入口：仅 4 种请求类型，函数式分发
 * @param {object} event - 事件对象
 * @param {object} context - 上下文对象
 * @returns {Promise<string>} JSON 字符串
 */
exports.main = async (event, context) => {
  try {
    const params = parseParams(event);
    console.log('解析后的参数：', params);

    const { gid, skw, content } = params;
    const hasContent = content && String(content).trim();

    if (!skw) {
      console.log('缺少 skw，返回空消息');
      return createEmptyMessage();
    }

    // 4 种情况，互斥且完备
    if (gid && hasContent) return await handleGroupKeyword(params);
    if (gid && !hasContent) return await handleGroupScheduled(params);
    if (!gid && hasContent) return await handleFriendKeyword(params);
    if (!gid && !hasContent) return await handleFriendScheduled(params);

    return createEmptyMessage();
  } catch (error) {
    console.error('执行过程中发生错误：', error);
    return createMessage(`错误：${error.message}`);
  }
};

// --------------- 4 类处理器（与平台 4 种消息类型一一对应） ---------------

/** [友] 定时消息：参数仅 skw，个人打卡后私聊评价（一次一条） */
async function handleFriendScheduled(params) {
  const { skw } = params;
  console.log('[友]定时：仅 skw，轮询好友绑定，找到第一条要发的内容');
  return await handleSkwOnlyRequest(skw);
}

/** 个人支持的关键词列表（用于【关键词】回复） */
const FRIEND_KEYWORDS = [
  '绑定：用户ID',
  '评价 / 今日评价',
  '激励',
  '今日总结',
  '关键词 / 【关键词】'
];

function getKeywordListReply() {
  const lines = FRIEND_KEYWORDS.map((kw, i) => `${i + 1}. ${kw}`).join('\n');
  return createMessage(`当前支持的关键词：\n\n${lines}\n\n发送对应内容即可获得回复。`);
}

/** [友] 关键词触发：绑定、评价、激励、今日总结、关键词列表。关键词回复永不因「今日已推送」等限制被过滤，一律用 triggerType='keyword' 落库。 */
async function handleFriendKeyword(params) {
  const { gid, mid, wxuin, skw, content } = params;
  const targetId = wxuin || mid;
  const text = (content || '').replace(/【|】/g, '').trim();
  if (content.includes('绑定') && content.startsWith('绑定')) {
    return await handleBindKeyword(content, gid, mid, wxuin, skw, params.type);
  }
  if (text === '评价' || text === '今日评价') {
    if (!targetId) return createMessage('缺少必要参数，无法获取评价');
    return await handleEvaluationKeyword(targetId, skw);
  }
  if (text === '关键词') {
    return getKeywordListReply();
  }
  if (text === '激励') {
    if (!targetId) return createMessage('缺少必要参数，无法获取激励');
    return await handleMotivationKeyword(targetId, skw);
  }
  if (text === '今日总结') {
    if (!targetId) return createMessage('缺少必要参数，无法获取今日总结');
    return await handleDailySummaryKeyword(targetId, skw);
  }
  return createEmptyMessage();
}

/** [群] 定时消息：打卡后群内评价 + 群定时提醒/战报 */
async function handleGroupScheduled(params) {
  const { gid } = params;
  const binding = await getBinding(gid, 'group');
  if (!binding) {
    console.log('[群]定时：未找到绑定', { gid });
    return createEmptyMessage();
  }
  console.log('[群]定时：打卡/定时检查', { gid, pkId: binding.pkId });
  const checkInMsg = await checkCheckInTrigger(binding, 'group');
  if (checkInMsg) return checkInMsg;
  const scheduledMsg = await handleScheduledMessage(binding, 'group');
  return scheduledMsg || createEmptyMessage();
}

/** [群] 关键词触发：绑定 PK 与群、后续扩展 */
async function handleGroupKeyword(params) {
  const { content, gid, mid, wxuin, skw } = params;
  if (content.includes('绑定') && content.startsWith('绑定')) {
    return await handleBindKeyword(content, gid, mid, wxuin, skw, params.type);
  }
  return createEmptyMessage();
}

/**
 * 解析参数
 * @param {object} event - 事件对象
 * @returns {object} 解析后的参数对象
 */
function parseParams(event) {
  const params = {};
  
  // 如果event.body存在，解析body参数（POST请求）
  if (event.body) {
    const bodyParams = parseBodyParams(event.body);
    Object.assign(params, bodyParams);
  }
  
  // 合并event中的直接参数
  if (event.gid) params.gid = event.gid;
  if (event.mid) params.mid = event.mid;
  if (event.wxuin) params.wxuin = event.wxuin;
  if (event.skw) params.skw = event.skw;
  if (event.content) params.content = event.content;
  
  // 确定类型
  if (params.gid) {
    params.type = 'group';
  } else if (params.wxuin || params.mid) {
    params.type = 'friend';
  }
  
  // 解码Unicode内容
  if (params.content) {
    params.content = decodeUnicode(params.content);
  }
  
  return params;
}

/**
 * 解析body参数（支持 form: a=1&b=2 或 JSON: {"gid":"xx","skw":"yy"}）
 * @param {string} body - 请求体字符串
 * @returns {object} 解析后的参数对象
 */
function parseBodyParams(body) {
  const bodyParams = {};
  if (!body) return bodyParams;
  const str = typeof body === 'string' ? body : String(body);
  const t = str.trim();
  if (t.startsWith('{')) {
    try {
      Object.assign(bodyParams, JSON.parse(t));
    } catch (_) {}
  } else {
    t.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key) {
        try {
          bodyParams[key] = value != null ? decodeURIComponent(value) : '';
        } catch (_) {
          bodyParams[key] = value || '';
        }
      }
    });
  }
  return bodyParams;
}

/**
 * 解码Unicode字符串
 * @param {string} str - 待解码的字符串
 * @returns {string} 解码后的字符串
 */
function decodeUnicode(str) {
  if (!str) return '';
  try {
    return str.replace(/\\u([\dA-Fa-f]{4})/g, (_, grp) => 
      String.fromCharCode(parseInt(grp, 16))
    );
  } catch (error) {
    console.error('Unicode解码失败:', error);
    return str;
  }
}

/**
 * 获取绑定关系和配置
 * @param {string} targetId - 目标ID（gid或mid）
 * @param {string} type - 类型（'group'或'friend'）
 * @returns {Promise<object|null>} 绑定关系对象
 */
async function getBinding(targetId, type) {
  try {
    if (type === 'group') {
      // 群聊：通过gid查询pk集合和robotConfigs集合
      const pkRes = await db.collection('pk').where({
        gid: targetId
      }).get();
      
      if (pkRes.data.length === 0) {
        return null;
      }
      
      const pkInfo = pkRes.data[0];
      const configRes = await db.collection('robotConfigs').where({
        targetId: targetId,
        type: 'group',
        status: 'active'
      }).get();
      
      if (configRes.data.length === 0) {
        return null;
      }
      
      const config = configRes.data[0];
      return {
        gid: pkInfo.gid,
        pkId: pkInfo._id,
        openId: pkInfo.openId,
        ...config
      };
    } else {
      // 好友：通过mid查询users集合和robotConfigs集合
      const userRes = await db.collection('users').where({
        mid: targetId
      }).get();
      
      if (userRes.data.length === 0) {
        return null;
      }
      
      const userInfo = userRes.data[0];
      const configRes = await db.collection('robotConfigs').where({
        targetId: targetId,
        type: 'friend',
        status: 'active'
      }).get();
      
      if (configRes.data.length === 0) {
        return null;
      }
      
      const config = configRes.data[0];
      const binding = {
        mid: userInfo.mid,
        openId: userInfo.openId,
        ...config
      };
      console.log('[getBinding] friend', { targetId, openId: binding.openId, userId: config.userId });
      return binding;
    }
  } catch (error) {
    console.error('查询绑定关系失败:', error);
    return null;
  }
}

/**
 * 处理绑定关键词
 * @param {string} content - 消息内容
 * @param {string} gid - 群ID（群聊时）
 * @param {string} mid - 微信用户ID
 * @param {string} wxuin - 微信用户ID（好友时）
 * @param {string} skw - 应用ID
 * @param {string} type - 类型（'group'或'friend'）
 * @returns {Promise<string>} JSON字符串格式的响应
 */
async function handleBindKeyword(content, gid, mid, wxuin, skw, type) {
  try {
    // 解析"绑定：PK ID"或"绑定：用户ID"格式
    const match = content.match(/绑定[：:]\s*(\w+)/);
    if (!match) {
      return createMessage("绑定格式错误，请发送：绑定：PK ID（群聊）或绑定：用户ID（好友）");
    }
    
    const bindId = match[1]; // 提取ID（群聊是PK ID，好友是用户ID）
    const wechatMid = mid || wxuin; // 微信用户ID
    
    if (type === 'group' || gid) {
      // 群聊绑定 - 使用PK ID
      const pkRes = await db.collection('pk').where({ _id: bindId }).get();
      if (pkRes.data.length === 0) {
        return createMessage("未找到PK赛信息，请检查PK ID是否正确");
      }
      
      const pkInfo = pkRes.data[0];
      
      // 更新PK集合的gid字段（直接存到pk表顶层）
      await db.collection('pk').where({ _id: bindId }).update({
        data: {
          gid: gid
        }
      });
      
      // 创建或更新robotConfigs配置记录
      const configRes = await db.collection('robotConfigs').where({
        targetId: gid,
        type: 'group'
      }).get();
      
      const configData = {
        type: 'group',
        targetId: gid,
        pkId: bindId, // 冗余保存pkId
        openId: pkInfo.openId,
        status: 'active',
        speechStyle: 'encourage',
        customSpeechTemplates: [],
        config: {
          checkInTrigger: {
            enabled: true,
            delayMinutes: 0,
            pkCheckIn: { enabled: true, atUser: true }
          },
          scheduledMessages: {
            morningPush: { enabled: true, timeRange: '07:30-08:30' },
            lunchReminder: { enabled: true, timeRange: '11:00-13:00' },
            eveningReminder: { enabled: true, timeRange: '19:00-20:00' },
            dailyReport: { enabled: true, timeRange: '21:00-22:00' }
          },
          keywords: {}
        },
        lastCheckInCheck: {
          date: '',
          checkedUsers: [],
          lastCheckTime: null
        },
        updatedAt: db.serverDate()
      };
      
      if (configRes.data.length > 0) {
        // 已绑定，检查是否绑定到同一个PK
        const existingConfig = configRes.data[0];
        if (existingConfig.pkId === bindId) {
          // 绑定到同一个PK，只更新绑定关系，保留现有配置
          await db.collection('robotConfigs').where({
            _id: existingConfig._id
          }).update({
            data: {
              targetId: gid,
              pkId: bindId,
              status: 'active',
              updatedAt: db.serverDate()
            }
          });
          return createMessage("已绑定！绑定关系已更新。");
        } else {
          // 绑定到不同的PK，提示用户
          return createMessage("该群聊已绑定到其他PK赛，如需重新绑定请先解绑。");
        }
      } else {
        // 创建新配置
        await db.collection('robotConfigs').add({
          data: {
            ...configData,
            createdAt: db.serverDate()
          }
        });
        return createMessage(`绑定成功！\n\n现在我会：\n- 在成员打卡后立即@并评价\n- 定时推送激励消息（早上、中午、晚上）\n- 每日发送PK战报\n\n快去小程序打卡试试吧`);
      }
    } else {
      // 好友绑定 - 使用用户ID（openId）
      const userRes = await db.collection('users').where({
        _id: bindId
      }).get();
      
      if (userRes.data.length === 0) {
        return createMessage("未找到用户信息，请检查用户ID是否正确");
      }
      
      const userInfo = userRes.data[0];
      
      // 更新用户集合的mid字段
      await db.collection('users').where({
        _id: userInfo._id
      }).update({
        data: {
          mid: wechatMid,
          updatedAt: db.serverDate()
        }
      });
      
      // 创建或更新robotConfigs配置记录
      const configRes = await db.collection('robotConfigs').where({
        targetId: wechatMid,
        type: 'friend'
      }).get();
      
      const configData = {
        type: 'friend',
        targetId: wechatMid,
        userId: bindId, // 冗余保存userId（users._id）
        openId: userInfo.openId,
        status: 'active',
        speechStyle: 'encourage',
        customSpeechTemplates: [],
        config: {
          checkInTrigger: {
            enabled: true,
            delayMinutes: 0,
            personalCheckIn: { enabled: true }
          },
          scheduledMessages: {
            morningPush: { enabled: true, timeRange: '07:30-08:30' },
            lunchReminder: { enabled: true, timeRange: '11:00-13:00' },
            eveningReminder: { enabled: true, timeRange: '19:00-20:00' },
            dailySummary: { enabled: true, timeRange: '21:00-22:00' }
          },
          keywords: {}
        },
        lastCheckInCheck: {
          date: '',
          checked: false,
          lastCheckTime: null
        },
        updatedAt: db.serverDate()
      };
      
      if (configRes.data.length > 0) {
        // 已绑定，检查是否绑定到同一个用户
        const existingConfig = configRes.data[0];
        if (existingConfig.openId === userInfo.openId) {
          // 绑定到同一个用户，只更新绑定关系，保留现有配置
          await db.collection('robotConfigs').where({
            _id: existingConfig._id
          }).update({
            data: {
              targetId: wechatMid,
              userId: bindId, // 冗余保存userId
              openId: userInfo.openId,
              status: 'active',
              updatedAt: db.serverDate()
            }
          });
          return createMessage("已绑定！绑定关系已更新。\n\n当前语气：鼓励型，可在小程序「我的-微信机器人」里进入配置切换（毒嘴/可爱/鼓励/专业）。\n试试发「关键词」查看支持的功能～");
        } else {
          // 绑定到不同的用户，提示用户
          return createMessage("该微信账号已绑定到其他用户，如需重新绑定请先解绑。");
        }
      } else {
        // 创建新配置（默认语气 encourage = 鼓励型）
        await db.collection('robotConfigs').add({
          data: {
            ...configData,
            createdAt: db.serverDate()
          }
        });
        return createMessage("绑定成功！\n\n当前默认语气：鼓励型。可在小程序「我的-微信机器人」里进入配置切换语气（毒嘴/可爱/鼓励/专业）。\n\n现在我会：\n- 在你打卡后立即给你评价反馈\n- 定时推送激励消息（早上、中午、晚上）\n- 每日总结你的打卡情况\n\n试试发「关键词」查看支持的功能～\n快去小程序打卡吧");
      }
    }
  } catch (error) {
    console.error('绑定处理失败:', error);
    return createMessage(`绑定失败：${error.message}`);
  }
}

/**
 * [友/群] 主动消息（任意）仅传 skw 时：轮询所有好友绑定，返回第一条要发的消息并带 wxid
 * @param {string} skw - 应用ID
 * @returns {Promise<string>} JSON 字符串，格式 {"rs":1,"wxid":"...","tip":"...","end":1} 或空消息
 */
async function handleSkwOnlyRequest(skw) {
  try {
    const configRes = await db.collection('robotConfigs').where({
      type: 'friend',
      status: 'active'
    }).get();
    if (!configRes.data || configRes.data.length === 0) {
      console.log('仅 skw：无好友绑定，返回空');
      return createEmptyMessage();
    }

    // 轮询所有已绑定（有 targetId）的好友：先尝试打卡触发，再尝试定时推送。
    // 不定义「今日已打卡」「今天未推送」过滤，否则未打卡用户收不到早上/午餐/晚上提醒，
    // 且同一天无法收到多种定时（早/午/晚/每日总结）。去重由 checkCheckInTrigger / handleScheduledMessage 内部保证。
    for (const row of configRes.data) {
      if (!row.targetId) {
        continue;
      }

      const binding = {
        _id: row._id,
        type: 'friend',
        targetId: row.targetId,
        openId: row.openId,
        config: row.config,
        speechStyle: row.speechStyle,
        lastCheckInCheck: row.lastCheckInCheck || { date: '', checked: false, lastCheckTime: null }
      };
      
      // 先检查打卡触发
      const checkInMsg = await checkCheckInTrigger(binding, 'friend');
      if (checkInMsg) {
        const obj = JSON.parse(checkInMsg);
        console.log('仅 skw：命中好友打卡，wxid=', binding.targetId);
        return createMessageWithWxid(obj.tip || '', binding.targetId);
      }
      
      // 再检查定时推送
      const scheduledMsg = await handleScheduledMessage(binding, 'friend');
      if (scheduledMsg) {
        const obj = JSON.parse(scheduledMsg);
        console.log('仅 skw：命中好友定时，wxid=', binding.targetId);
        return createMessageWithWxid(obj.tip || '', binding.targetId);
      }
    }
    
    return createEmptyMessage();
  } catch (e) {
    console.error('仅 skw 轮询失败:', e);
    return createEmptyMessage();
  }
}

/**
 * 处理"评价"关键词（仅在个人私聊中）
 * @param {string} targetId - 目标ID（微信用户ID）
 * @param {string} skw - 应用ID
 * @returns {Promise<string>} JSON字符串格式的响应
 */
async function handleEvaluationKeyword(targetId, skw) {
  try {
    // 查询绑定关系（个人绑定）
    const binding = await getBinding(targetId, 'friend');
    
    if (!binding) {
      return createMessage('未找到绑定关系，请先发送"绑定：用户ID"进行绑定');
    }
    
    // 查询今日打卡记录
    const now = new Date();
    const today = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const recordsRes = await db.collection('records').where({
      openId: binding.openId,
      date: today
    }).get();
    
    if (recordsRes.data.length === 0) {
      return createMessage("今日还未打卡，请先在小程序中打卡后再查看评价");
    }
    
    const record = recordsRes.data[0];
    
    // 生成评价话术（使用打卡评价的生成逻辑）
    const speech = await generateCheckInSpeech(
      binding.speechStyle, 
      record, 
      'friend', 
      null, 
      binding.openId
    );
    
    return createMessage(speech);
  } catch (error) {
    console.error('处理评价关键词失败:', error);
    return createMessage(`获取评价失败：${error.message}`);
  }
}

/**
 * 处理「激励」关键词：对应早上 7-9 点的激励话术，与定时推送的 morning 一致，不受今日发送次数限制
 */
async function handleMotivationKeyword(targetId, skw) {
  try {
    const binding = await getBinding(targetId, 'friend');
    if (!binding) {
      return createMessage('未找到绑定关系，请先发送"绑定：用户ID"进行绑定');
    }
    const messageType = 'morning';
    const message = await generateScheduledMessage(messageType, binding, 'friend');
    const content = message || '【早上好】新的一天开始了！记得记录体重，坚持就是胜利！';
    await saveMessageRecord(binding, messageType, 'keyword', null, content); // triggerType='keyword'，不参与定时「今日已推送」统计
    return createMessage(content);
  } catch (error) {
    console.error('处理激励关键词失败:', error);
    return createMessage(`获取激励失败：${error.message}`);
  }
}

/**
 * 处理「今日总结」关键词：与定时推送的每日总结逻辑一致，不受今日发送次数限制
 */
async function handleDailySummaryKeyword(targetId, skw) {
  try {
    const binding = await getBinding(targetId, 'friend');
    if (!binding) {
      return createMessage('未找到绑定关系，请先发送"绑定：用户ID"进行绑定');
    }
    console.log('[今日总结] 关键词触发', { targetId, openId: binding.openId, userId: binding.userId });
    const message = await generateScheduledMessage('daily_summary', binding, 'friend', { fromKeyword: true });
    if (!message) {
      console.log('[今日总结] generateScheduledMessage 返回空，openId=', binding.openId);
      return createMessage('今日还未打卡，暂无总结。请先在小程序中打卡后再试。');
    }
    await saveMessageRecord(binding, 'daily_summary', 'keyword', null, message); // triggerType='keyword'，不参与定时「今日已推送」统计
    return createMessage(message);
  } catch (error) {
    console.error('处理今日总结关键词失败:', error);
    return createMessage(`获取今日总结失败：${error.message}`);
  }
}

/**
 * 检查打卡触发
 * @param {object} binding - 绑定关系对象
 * @param {string} type - 类型（'group'或'friend'）
 * @returns {Promise<string|null>} 消息内容或null
 */
async function checkCheckInTrigger(binding, type) {
  try {
    // 检查打卡触发是否启用
    if (!binding.config || !binding.config.checkInTrigger || !binding.config.checkInTrigger.enabled) {
      return null;
    }
    
    const checkInConfig = binding.config.checkInTrigger;
    const now = new Date();
    const today = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // 检查今日是否已发送
    if (binding.lastCheckInCheck && binding.lastCheckInCheck.date === today) {
      if (type === 'friend') {
        if (binding.lastCheckInCheck.checked) {
          return null; // 今日已发送
        }
      } else {
        // 群聊需要检查具体用户
        // 这里先简单处理，后续优化
      }
    }
    
    if (type === 'friend') {
      // 个人打卡触发
      if (!checkInConfig.personalCheckIn || !checkInConfig.personalCheckIn.enabled) {
        return null;
      }
      
      // 查询今日打卡记录
      const recordsRes = await db.collection('records').where({
        openId: binding.openId,
        date: today
      }).get();
      
      if (recordsRes.data.length === 0) {
        return null; // 今日未打卡
      }
      
      const record = recordsRes.data[0];
      
      // 检查延迟时间
      const checkInTime = new Date(record.createdAt);
      const delayMs = checkInConfig.delayMinutes * 60 * 1000;
      if (now.getTime() - checkInTime.getTime() < delayMs) {
        return null; // 未到延迟时间
      }
      
      // 生成话术
      const speech = await generateCheckInSpeech(binding.speechStyle, record, type, null, binding.openId);
      
      // 更新检查记录
      await db.collection('robotConfigs').where({
        _id: binding._id
      }).update({
        data: {
          'lastCheckInCheck': {
            date: today,
            checked: true,
            lastCheckTime: db.serverDate()
          },
          updatedAt: db.serverDate()
        }
      });
      
      // 保存消息记录：打卡评价（定时来查发现新打卡后发），属于 scheduled，messageType 为 'check_in' 以区分早上/午餐/晚上/每日总结
      await saveMessageRecord(binding, 'check_in', 'scheduled', binding.openId, speech);
      
      return createMessage(speech);
    } else {
      // PK打卡触发
      if (!checkInConfig.pkCheckIn || !checkInConfig.pkCheckIn.enabled) {
        return null;
      }
      
      // 查询PK成员
      const pkRes = await db.collection('pk').where({
        _id: binding.pkId
      }).get();
      
      if (pkRes.data.length === 0) {
        console.log('PK打卡检查: 未找到 pk 记录', { pkId: binding.pkId });
        return null;
      }
      
      const pkInfo = pkRes.data[0];
      const members = pkInfo.members || [];
      const openIds = members.map(m => m.openId).filter(Boolean);
      
      if (openIds.length === 0) {
        console.log('PK打卡检查: 群内无成员或成员无 openId', { pkId: binding.pkId, membersCount: members.length });
        return null;
      }
      
      // 查询今日打卡记录
      const recordsRes = await db.collection('records').where({
        openId: db.command.in(openIds),
        date: today
      }).get();
      
      // 找出新打卡的用户（未在今日 checkedUsers 中的）
      // 注意：checkedUsers 是“按天”的，只有 lastCheckInCheck.date===today 时才生效
      const lastCheckInfo = binding.lastCheckInCheck || {};
      const lastChecked = lastCheckInfo.date === today
        ? (lastCheckInfo.checkedUsers || [])
        : [];
      const newCheckIns = recordsRes.data.filter(r => !lastChecked.includes(r.openId));
      
      console.log('PK打卡检查', {
        targetId: binding.targetId,
        pkId: binding.pkId,
        membersCount: members.length,
        openIdsSample: openIds.slice(0, 3),
        todayRecordsCount: recordsRes.data.length,
        lastCheckedCount: lastChecked.length,
        newCheckInsCount: newCheckIns.length,
        newCheckInsOpenIds: newCheckIns.map(r => r.openId)
      });
      
      if (newCheckIns.length === 0) {
        return null; // 没有新打卡
      }
      
      // 为每个新打卡用户生成消息
      const messages = [];
      for (const record of newCheckIns) {
        const member = members.find(m => m.openId === record.openId);
        if (!member) continue;
        
        const speech = await generateCheckInSpeech(binding.speechStyle, record, type, member, record.openId);
        const atUser = checkInConfig.pkCheckIn.atUser ? `@${member.nickName || member.openId}` : '';
        messages.push(`${atUser} ${speech}`);
      }
      
      if (messages.length === 0) {
        return null;
      }
      
      // 更新检查记录
      await db.collection('robotConfigs').where({
        _id: binding._id
      }).update({
        data: {
          'lastCheckInCheck': {
            date: today,
            checkedUsers: [...lastChecked, ...newCheckIns.map(r => r.openId)],
            lastCheckTime: db.serverDate()
          },
          updatedAt: db.serverDate()
        }
      });
      
      // 保存消息记录：打卡评价（定时来查发现群内新打卡后发），属于 scheduled，messageType 为 'check_in'
      const messageContent = messages.join('\n');
      await saveMessageRecord(binding, 'check_in', 'scheduled', newCheckIns[0].openId, messageContent);
      
      return createMessage(messageContent);
    }
  } catch (error) {
    console.error('打卡触发检查失败:', error);
    return null;
  }
}

/**
 * 处理定时推送
 * @param {object} binding - 绑定关系对象
 * @param {string} type - 类型（'group'或'friend'）
 * @returns {Promise<string|null>} 消息内容或null
 */
async function handleScheduledMessage(binding, type) {
  try {
    if (!binding.config || !binding.config.scheduledMessages) {
      console.log('定时推送: 无 scheduledMessages 配置', { type, targetId: binding.targetId });
      return null;
    }
    
    const scheduledConfig = binding.config.scheduledMessages;
    const now = new Date();
    const currentHour = (now.getUTCHours() + 8) % 24;
    const today = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // 根据时间段确定消息类型
    let messageType = null;
    let config = null;
    
    if (currentHour >= 7 && currentHour < 9 && scheduledConfig.morningPush?.enabled) {
      messageType = 'morning';
      config = scheduledConfig.morningPush;
    } else if (currentHour >= 11 && currentHour < 13 && scheduledConfig.lunchReminder?.enabled) {
      messageType = 'lunch';
      config = scheduledConfig.lunchReminder;
    } else if (currentHour >= 19 && currentHour < 21 && scheduledConfig.eveningReminder?.enabled) {
      messageType = 'evening';
      config = scheduledConfig.eveningReminder;
    } else if (currentHour >= 21 && currentHour < 23) {
      if (type === 'friend' && scheduledConfig.dailySummary?.enabled) {
        messageType = 'daily_summary';
        config = scheduledConfig.dailySummary;
      } else if (type === 'group' && scheduledConfig.dailyReport?.enabled) {
        messageType = 'daily_report';
        config = scheduledConfig.dailyReport;
      }
    }
    
    console.log('定时推送检查', {
      type,
      targetId: binding.targetId,
      currentHour,
      messageType,
      enabled: {
        morningPush: scheduledConfig.morningPush?.enabled,
        lunchReminder: scheduledConfig.lunchReminder?.enabled,
        eveningReminder: scheduledConfig.eveningReminder?.enabled,
        dailySummary: scheduledConfig.dailySummary?.enabled,
        dailyReport: scheduledConfig.dailyReport?.enabled
      }
    });
    
    if (!messageType || !config) {
      return null;
    }
    
    // 注意：个人定时（仅 skw 轮询）时，未打卡的用户已在 handleSkwOnlyRequest 中过滤，这里不需要再检查
    
    // 定时推送「今日已推送」仅统计 triggerType='scheduled'；关键词触发的记录为 triggerType='keyword'，永不参与此处统计，定时与关键词互不影响
    const todayStartUTC = new Date(today + 'T00:00:00+08:00');
    const messageRes = await db.collection('robotMessages').where({
      type: type,
      targetId: binding.targetId,
      messageType: messageType,
      triggerType: 'scheduled',
      createdAt: db.command.gte(todayStartUTC)
    }).get();
    
    if (messageRes.data.length > 0) {
      console.log('定时推送: 今日已推送，跳过', { type, targetId: binding.targetId, messageType });
      return null; // 今日已推送
    }
    
    // 生成消息
    const message = await generateScheduledMessage(messageType, binding, type);
    
    if (!message) {
      console.log('定时推送: 生成消息为空', { type, targetId: binding.targetId, messageType });
      return null;
    }
    
    // 保存消息记录（仅定时推送使用 triggerType='scheduled'，与关键词的 'keyword' 严格区分）
    await saveMessageRecord(binding, messageType, 'scheduled', null, message);
    
    console.log('定时推送: 已生成并返回', { type, targetId: binding.targetId, messageType, messageLen: message.length });
    return createMessage(message, type === 'group' ? 1 : 1);
  } catch (error) {
    console.error('定时推送处理失败:', error);
    return null;
  }
}

/**
 * 生成打卡话术（使用AI或模板）
 * @param {string} speechStyle - 话术类型
 * @param {object} record - 打卡记录
 * @param {string} type - 类型（'group'或'friend'）
 * @param {object} member - PK成员信息（群聊时）
 * @param {string} openId - 用户openId
 * @returns {Promise<string>} 话术内容
 */
async function generateCheckInSpeech(speechStyle, record, type, member = null, openId = null) {
  const weight = record.weight || 0;
  const today = record.date || new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
  const context = await getFriendCheckInContext(openId || '', today, { todayRecord: record });
  // 无 weightChange 字段，用今日体重与昨日体重差值计算
  const weightChange = context.yesterdayRecord != null ? (weight - context.yesterdayRecord.weight) : 0;
  const weightChangeText = weightChange > 0 ? `+${weightChange}` : weightChange.toString();

  if (aiInstance) {
    try {
      const prompt = buildCheckInPrompt(speechStyle, context, member);

      const aiParams = {
        model: 'hunyuan-turbos-latest',
        temperature: 0.8,
        max_tokens: 150,
        promptLength: prompt.length,
        promptPreview: prompt.slice(0, 200) + (prompt.length > 200 ? '...' : ''),
        speechStyle,
        type,
        today
      };
      console.log('AI打卡评价调用参数', aiParams);

      const model = aiInstance.createModel('hunyuan-exp');
      const result = await model.generateText({
        model: aiParams.model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: aiParams.temperature,
        max_tokens: aiParams.max_tokens
      });
      
      if (result && result.text && result.text.trim()) {
        // 清理AI返回的文本，去除引号、说明文字等
        let cleanedText = result.text.trim();
        
        // 去除首尾的引号（单引号或双引号）
        cleanedText = cleanedText.replace(/^["']+|["']+$/g, '');
        
        // 查找最后一个引号后的内容，如果包含说明文字（如"（48字..."），则截取到引号前
        const lastQuoteIndex = Math.max(
          cleanedText.lastIndexOf('"'),
          cleanedText.lastIndexOf("'")
        );
        if (lastQuoteIndex > 0) {
          const afterQuote = cleanedText.substring(lastQuoteIndex + 1);
          // 如果引号后是说明文字（包含"（"、"字"、"用"等关键词），则只取引号前的内容
          if (afterQuote.includes('（') && (afterQuote.includes('字') || afterQuote.includes('用'))) {
            cleanedText = cleanedText.substring(0, lastQuoteIndex).replace(/["']+$/, '');
          }
        }
        
        // 去除包含说明文字的括号部分（如"（48字，用..."）
        cleanedText = cleanedText.replace(/\n\s*（[^）]*[字用][^）]*）.*$/g, '');
        cleanedText = cleanedText.replace(/\s+（[^）]*[字用][^）]*）.*$/g, '');
        
        // 如果文本以引号结尾，去除引号
        cleanedText = cleanedText.replace(/["']+$/g, '');
        
        // 去除多余的换行，保留单个空格
        cleanedText = cleanedText.replace(/\n+/g, ' ').trim();
        cleanedText = cleanedText.replace(/\s+/g, ' ');
        
        // 为避免机器人端对引号/反斜杠转义不当导致截断，去掉内部的 " 和 \
        cleanedText = cleanedText.replace(/["\\]/g, '');
        
        // 如果清理后为空或太短，使用原始文本（去除首尾引号）
        if (!cleanedText || cleanedText.length < 5) {
          cleanedText = result.text.trim().replace(/^["']+|["']+$/g, '');
        }
        
        console.log('AI打卡评价成功', {
          textLength: cleanedText.length,
          textPreview: cleanedText,
          usage: result?.usage || null,
          result: result
        });
        return cleanedText;
      }
    } catch (error) {
      console.error('AI生成话术失败，使用模板:', error.message);
      // AI失败时继续使用模板
    }
  }
  
  // 使用模板话术（AI不可用或失败时的回退方案）
  // 注意：weight字段存储的是"斤"，不是kg
  const templates = {
    sarcastic: [
      weightChange === 0 
        ? `今天体重${weight}斤，保持稳定，继续加油！`
        : `今天体重${weight}斤，${weightChange >= 0 ? '又' : ''}${weightChange >= 0 ? '胖' : '瘦'}了${Math.abs(weightChange)}斤，${weightChange >= 0 ? '继续加油' : '不错'}！`,
      weightChange === 0
        ? `体重${weight}斤，保持稳定，看来很自律！`
        : `体重${weight}斤，${weightChange >= 0 ? '看来' : '终于'}${weightChange >= 0 ? '没少吃' : '有进步'}了${Math.abs(weightChange)}斤！`,
    ],
    cute: [
      weightChange === 0
        ? `今天体重${weight}斤，保持稳定哦～要继续努力呢！`
        : `今天体重${weight}斤，${weightChange < 0 ? '好棒' : '要加油'}哦～${weightChange < 0 ? '瘦了' : '胖了'}${Math.abs(weightChange)}斤呢！`,
      weightChange === 0
        ? `体重${weight}斤，小可爱保持得很好，要继续努力哦～`
        : `体重${weight}斤，${weightChange < 0 ? '小可爱' : '小宝贝'}${weightChange < 0 ? '真厉害' : '要继续努力'}，${weightChange < 0 ? '瘦了' : '胖了'}${Math.abs(weightChange)}斤～`,
    ],
    encourage: [
      weightChange === 0
        ? `今天体重${weight}斤，保持稳定，继续加油！明天会更好！`
        : `今天体重${weight}斤，${weightChange < 0 ? '太棒了' : '继续加油'}！${weightChange < 0 ? '成功减重' : '增加了'}${Math.abs(weightChange)}斤，${weightChange < 0 ? '坚持下去' : '明天会更好'}！`,
      weightChange === 0
        ? `体重${weight}斤，保持稳定，加油！明天继续努力！`
        : `体重${weight}斤，${weightChange < 0 ? '很棒' : '加油'}！${weightChange < 0 ? '减了' : '增加了'}${Math.abs(weightChange)}斤，${weightChange < 0 ? '离目标更近了' : '明天继续努力'}！`,
    ],
    professional: [
      weightChange === 0
        ? `今日体重：${weight}斤，与昨日持平。请继续保持。`
        : `今日体重：${weight}斤，较昨日${weightChange > 0 ? '增加' : '减少'}${Math.abs(weightChange)}斤。${weightChange < 0 ? '减重趋势良好' : '建议调整饮食和运动计划'}。`,
      weightChange === 0
        ? `体重记录：${weight}斤，无变化。保持当前状态。`
        : `体重记录：${weight}斤，变化${weightChangeText}斤。${weightChange < 0 ? '减重进度正常' : '建议加强运动和控制饮食'}。`,
    ]
  };
  
  const styleTemplates = templates[speechStyle] || templates.encourage;
  const template = styleTemplates[Math.floor(Math.random() * styleTemplates.length)];
  
  return template;
}

/** 话术类型对应的描述（打卡评价、定时推送共用） */
function getSpeechStyleDesc(speechStyle) {
  return {
    sarcastic: '毒嘴调侃、幽默刻薄',
    cute: '可爱萌系、语气词哦～呀',
    encourage: '鼓励正能量',
    professional: '专业减肥专家、客观、给建议'
  }[speechStyle] || '鼓励正能量';
}

/**
 * 获取个人打卡相关上下文（用户信息、今日/昨日/本月记录），供提示词使用
 * @param {string} openId - 用户 openId
 * @param {string} today - 东八区今日日期 YYYY-MM-DD
 * @param {object} options - 可选，{ todayRecord } 若已存在今日记录可传入避免重复查询
 * @returns {Promise<{userInfo, todayRecord, yesterdayRecord, monthlyRecords, today}>}
 */
async function getFriendCheckInContext(openId, today, options = {}) {
  let userInfo = null;
  let todayRecord = options.todayRecord;
  let yesterdayRecord = null;
  let monthlyRecords = [];
  const yesterday = new Date(new Date(today).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const currentMonth = today.substring(0, 7);
  const monthStart = currentMonth + '-01';
  const monthEnd = currentMonth + '-31';

  try {
    const [userRes, todayRes, yesterdayRes, monthlyRes] = await Promise.all([
      db.collection('users').where({ openId }).get(),
      options.todayRecord === undefined ? db.collection('records').where({ openId, date: today }).get() : Promise.resolve({ data: [] }),
      db.collection('records').where({ openId, date: yesterday }).get(),
      db.collection('records').where({
        openId,
        date: db.command.gte(monthStart).and(db.command.lte(monthEnd))
      }).orderBy('date', 'asc').get()
    ]);
    if (userRes.data.length > 0) userInfo = userRes.data[0];
    if (options.todayRecord === undefined && todayRes.data.length > 0) todayRecord = todayRes.data[0];
    if (yesterdayRes.data.length > 0) yesterdayRecord = yesterdayRes.data[0];
    monthlyRecords = monthlyRes.data || [];
    if (options.todayRecord === undefined && todayRes.data.length === 0 && openId) {
      console.log('[getFriendCheckInContext] 今日无打卡记录', { openId, today, yesterday, todayCount: todayRes.data.length, monthCount: monthlyRes.data?.length });
    }
  } catch (error) {
    console.error('getFriendCheckInContext 查询失败:', error);
  }
  return { userInfo, todayRecord, yesterdayRecord, monthlyRecords, today };
}

/**
 * 根据打卡上下文生成一句「用户情况」数据描述，用于注入到各类 AI 提示词
 * @param {object} context - getFriendCheckInContext 的返回值
 * @param {object} member - 可选，PK 成员信息（群场景 @ 用）
 * @returns {string}
 */
function buildCheckInDataLine(context, member = null) {
  const { userInfo, todayRecord, yesterdayRecord, monthlyRecords, today } = context;
  const who = member ? (member.nickName || '用户') : '用户';

  let weight, weightChange;
  let hasYesterday = false;
  if (todayRecord && todayRecord.weight != null) {
    weight = todayRecord.weight;
    hasYesterday = yesterdayRecord != null;
    weightChange = hasYesterday ? (weight - yesterdayRecord.weight) : 0;
  } else if (yesterdayRecord && yesterdayRecord.weight != null) {
    weight = yesterdayRecord.weight;
    weightChange = 0;
  } else if (monthlyRecords.length > 0) {
    const last = monthlyRecords[monthlyRecords.length - 1];
    weight = last.weight;
    weightChange = 0;
  } else {
    return `${who}暂无近期体重记录，可提醒坚持打卡。`;
  }

  let dataLine;
  if (todayRecord && todayRecord.weight != null) {
    if (hasYesterday) {
      const yesterday = yesterdayRecord.weight;
      const changeStr = weightChange < 0 ? `较昨日减${Math.abs(weightChange)}斤` : weightChange > 0 ? `较昨日涨${weightChange}斤` : '较昨日持平';
      dataLine = `${today}，${who}当前${weight}斤，${changeStr}（昨日${yesterday}斤）。`;
    } else {
      dataLine = `${today}，${who}今日${weight}斤（昨日未打卡，无昨日记录）。`;
    }
  } else {
    dataLine = `${who}最近体重${weight}斤。`;
  }

  if (userInfo?.aimWeight) {
    const remain = (weight - userInfo.aimWeight).toFixed(1);
    dataLine += ` 目标${userInfo.aimWeight}斤，还差${remain}斤。`;
  }
  if (userInfo?.height) {
    const bmi = ((weight / 2) / (userInfo.height * userInfo.height / 10000)).toFixed(1);
    dataLine += ` BMI${bmi}。`;
  }
  if (monthlyRecords.length > 0) {
    const w0 = monthlyRecords[0].weight;
    const delta = (w0 - weight).toFixed(1);
    const dir = delta > 0 ? '减' : delta < 0 ? '增' : '平';
    dataLine += ` 本月从${w0}斤到${weight}斤，${dir}${Math.abs(delta)}斤。`;
    const monthList = monthlyRecords.map(r => `${r.date.slice(5)} ${r.weight}斤`);
    if (monthList.length > 0) dataLine += ` 本月记录：${monthList.join('、')}。`;
  }
  return dataLine;
}

/**
 * 构建打卡评价的完整 AI 提示词（内部使用 buildCheckInDataLine）
 * @param {string} speechStyle - 话术类型
 * @param {object} context - getFriendCheckInContext 的返回值
 * @param {object} member - PK 成员信息（群场景可选）
 * @returns {string} AI 提示词
 */
function buildCheckInPrompt(speechStyle, context, member = null) {
  const dataLine = buildCheckInDataLine(context, member);
  const styleDesc = getSpeechStyleDesc(speechStyle);
  return `根据体重打卡数据生成一条50~100字的评价，直接对用户说，不要引号、不要字数说明、不要"评价如下"等前缀。

语气要求：${styleDesc}。

数据：${dataLine}

只输出一句评价正文100字以内，其它都不要。`;
}

/**
 * 生成定时推送消息
 * @param {string} messageType - 消息类型
 * @param {object} binding - 绑定关系对象
 * @param {string} type - 类型（'group'或'friend'）
 * @param {object} options - 可选，{ fromKeyword: true } 表示关键词触发，daily_summary 不因「今日已发过打卡评价」而跳过
 * @returns {Promise<string>} 消息内容
 */
async function generateScheduledMessage(messageType, binding, type, options = {}) {
  const now = new Date();
  const today = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
  if (messageType === 'daily_summary') {
    console.log('[generateScheduledMessage] daily_summary 入参', { today, openId: binding?.openId, targetId: binding?.targetId, nowISO: now.toISOString(), fromKeyword: options.fromKeyword });
  }
  switch (messageType) {
    case 'morning': {
      // 早上激励：结合个人打卡数据与话术类型生成
      const morningCtx = await getFriendCheckInContext(binding.openId, today);
      const morningDataLine = buildCheckInDataLine(morningCtx, null);
      const styleDesc = getSpeechStyleDesc(binding.speechStyle);
      const prompt = `你是一名减脂教练，请根据用户情况生成一条 40~80 字的早晨激励文案。
用户情况：${morningDataLine}
语气要求：${styleDesc}。可以提到坚持记录体重、早睡早起、健康饮食和运动。
要求：1）用中文；2）不要包含任何引号、括号里的字数说明或“如下”等提示词；3）只输出一段完整的激励正文，不能有标题。`;
      const body = await generateScheduledAiBody(prompt);
      if (body) {
        return `【早上好】${body}`;
      }
      return `【早上好】新的一天开始了！记得记录体重，坚持就是胜利！`;
    }
      
    case 'lunch': {
      // 午餐提醒：结合个人打卡数据与话术类型生成
      const lunchCtx = await getFriendCheckInContext(binding.openId, today);
      const lunchDataLine = buildCheckInDataLine(lunchCtx, null);
      const styleDesc = getSpeechStyleDesc(binding.speechStyle);
      const prompt = `你是一名营养师，请根据用户情况生成一条 40~80 字的午餐饮食提醒文案。
用户情况：${lunchDataLine}
语气要求：${styleDesc}。可以提醒控制油脂、糖分和主食量，鼓励多吃蔬菜和优质蛋白。
要求：1）用中文；2）不要包含任何引号、括号里的字数说明或“如下”等提示词；3）只输出一段完整的提醒正文，不能有标题。`;
      const body = await generateScheduledAiBody(prompt);
      if (body) {
        return `【午餐提醒】${body}`;
      }
      return `【午餐提醒】午餐时间到！记得控制食量，八分饱更健康哦`;
    }
      
    case 'evening':
      if (type === 'friend') {
        return `【晚上提醒】今天还没记录体重呢，记得打卡哦！`;
      } else {
        // 查询今日打卡情况
        const pkRes = await db.collection('pk').where({ _id: binding.pkId }).get();
        if (pkRes.data.length > 0) {
          const pkInfo = pkRes.data[0];
          const members = pkInfo.members || [];
          const openIds = members.map(m => m.openId);
          const recordsRes = await db.collection('records').where({
            openId: db.command.in(openIds),
            date: today
          }).get();
          const completed = recordsRes.data.length;
          const total = members.length;
          return `【打卡提醒】今日还剩1小时记录体重！当前${completed}/${total}人已完成，完成率${((completed/total)*100).toFixed(1)}%！`;
        }
        return `【打卡提醒】记得记录体重哦！`;
      }
      
    case 'daily_summary': {
      // 个人每日总结
      const dailySummaryQuery = { openId: binding.openId, date: today };
      const userRecordsRes = await db.collection('records').where(dailySummaryQuery).get();
      console.log('[daily_summary] 查询今日打卡', {
        today,
        openId: binding.openId,
        targetId: binding.targetId,
        query: dailySummaryQuery,
        recordsCount: userRecordsRes.data.length,
        sampleDates: userRecordsRes.data.slice(0, 2).map(r => ({ date: r.date, openId: r.openId }))
      });
      if (userRecordsRes.data.length > 0) {
        const record = userRecordsRes.data[0];
        // 定时推送时：若今日已发过「打卡评价」（定时来查发现新打卡发的那条，同属 scheduled）则不再发总结，避免内容重复；关键词触发时仍返回总结
        if (!options.fromKeyword) {
          const todayStartUTC = new Date(today + 'T00:00:00+08:00');
          const checkInMsgRes = await db.collection('robotMessages').where({
            type: 'friend',
            targetId: binding.targetId,
            messageType: 'check_in',
            triggerType: 'scheduled',
            createdAt: db.command.gte(todayStartUTC)
          }).get();
          if (checkInMsgRes.data.length > 0) {
            console.log('[daily_summary] 定时推送：今日已发过打卡评价，跳过总结', { targetId: binding.targetId });
            return null;
          }
        }
        const speech = await generateCheckInSpeech(binding.speechStyle, record, type, null, binding.openId);
        return `【今日总结】${speech}`;
      }
      console.log('[daily_summary] 未查到今日打卡记录', { today, openId: binding.openId });
      return null;
    }
      
    case 'daily_report':
      // PK每日战报
      const pkRes2 = await db.collection('pk').where({ _id: binding.pkId }).get();
      if (pkRes2.data.length > 0) {
        const pkInfo = pkRes2.data[0];
        const members = pkInfo.members || [];
        const openIds = members.map(m => m.openId).filter(Boolean);
        const recordsRes = await db.collection('records').where({
          openId: db.command.in(openIds),
          date: today
        }).get();
        const completed = recordsRes.data.length;
        const total = members.length;
        const rate = total > 0 ? ((completed/total)*100).toFixed(1) : 0;
        
        // 检查今日是否已发过「打卡评价」（定时来查发现新打卡发的那条，同属 scheduled），避免战报与评价重复
        const todayStartUTC = new Date(today + 'T00:00:00+08:00');
        const checkInMsgRes = await db.collection('robotMessages').where({
          type: 'group',
          targetId: binding.targetId,
          messageType: 'check_in',
          triggerType: 'scheduled',
          createdAt: db.command.gte(todayStartUTC)
        }).get();
        if (checkInMsgRes.data.length > 0) {
          return null;
        }
        
        // 如果有成员打卡，生成评价
        if (recordsRes.data.length > 0) {
          // 为已打卡的成员生成评价（只评价第一个，避免消息过长）
          const firstRecord = recordsRes.data[0];
          const member = members.find(m => m.openId === firstRecord.openId);
          if (member) {
            const speech = await generateCheckInSpeech(binding.speechStyle, firstRecord, type, member, firstRecord.openId);
            const atUser = `@${member.nickName || member.openId}`;
            let reportContent = `【今日战报】\n今日打卡率${rate}%(${completed}/${total})\n\n${atUser} ${speech}`;
            
            // 如果还有其他人打卡，简单提及
            if (recordsRes.data.length > 1) {
              reportContent += `\n\n还有${recordsRes.data.length - 1}位成员也完成了打卡，继续加油！`;
            }
            
            return reportContent;
          }
        }
        
        // 无人打卡，只显示统计
        const details = members.map(member => {
          const hasRecord = recordsRes.data.find(r => r.openId === member.openId);
          return `${member.nickName || member.openId}: ${hasRecord ? '已打卡' : '未打卡'}`;
        }).join('\n');
        return `【今日战报】\n今日打卡率${rate}%(${completed}/${total})\n\n${details}`;
      }
      return `【今日战报】暂无数据`;
      
    default:
      return null;
  }
}

/**
 * 使用 AI 生成定时推送文案（如早上激励、午餐提醒）
 * @param {string} prompt - 提示词
 * @returns {Promise<string>} 清洗后的文案内容（可能为空字符串）
 */
async function generateScheduledAiBody(prompt) {
  if (!aiInstance) {
    return '';
  }
  try {
    const model = aiInstance.createModel('hunyuan-exp');
    const result = await model.generateText({
      model: 'hunyuan-turbos-latest',
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 150
    });
    
    if (!result || !result.text || !result.text.trim()) {
      return '';
    }
    
    let cleanedText = result.text.trim();
    
    // 去掉首尾引号
    cleanedText = cleanedText.replace(/^["']+|["']+$/g, '');
    
    // 去掉末尾可能带有的“（xx字...）”说明
    const lastQuoteIndex = Math.max(
      cleanedText.lastIndexOf('"'),
      cleanedText.lastIndexOf("'")
    );
    if (lastQuoteIndex > 0) {
      const afterQuote = cleanedText.substring(lastQuoteIndex + 1);
      if (afterQuote.includes('（') && (afterQuote.includes('字') || afterQuote.includes('用'))) {
        cleanedText = cleanedText.substring(0, lastQuoteIndex).replace(/["']+$/, '');
      }
    }
    cleanedText = cleanedText.replace(/\n\s*（[^）]*[字用][^）]*）.*$/g, '');
    cleanedText = cleanedText.replace(/\s+（[^）]*[字用][^）]*）.*$/g, '');
    
    // 去除多余换行与空白
    cleanedText = cleanedText.replace(/\n+/g, ' ').trim();
    cleanedText = cleanedText.replace(/\s+/g, ' ');
    
    // 避免机器人端对引号/反斜杠转义不当导致截断，去掉内部的 " 和 \
    cleanedText = cleanedText.replace(/["\\]/g, '');
    
    return cleanedText;
  } catch (error) {
    console.error('AI生成定时文案失败，将使用模板:', error.message);
    return '';
  }
}

/**
 * robotMessages 中 triggerType 约定：
 * - 'scheduled'：定时来查才发，包括（1）定时推送（早上/午餐/晚上/每日总结等）、（2）打卡评价（定时来查时发现新打卡后发）；均参与「今日已推送」等按类型的统计；messageType 区分 morning/lunch/evening/daily_summary/check_in 等。
 * - 'keyword'：关键词触发（激励、今日总结、评价等），用户发关键词才发，不参与定时统计。
 *
 * 保存消息记录
 * @param {object} binding - 绑定关系对象
 * @param {string} messageType - 消息类型
 * @param {string} triggerType - 触发类型
 * @param {string} triggerUserId - 触发用户openId
 * @param {string} content - 消息内容
 */
async function saveMessageRecord(binding, messageType, triggerType, triggerUserId, content) {
  try {
    await db.collection('robotMessages').add({
      data: {
        type: binding.type,
        targetId: binding.targetId,
        pkId: binding.pkId || null,
        openId: binding.openId || null,
        messageType: messageType,
        triggerType: triggerType,
        triggerUserId: triggerUserId || null,
        content: content,
        speechStyle: binding.speechStyle,
        createdAt: db.serverDate()
      }
    });
  } catch (error) {
    console.error('保存消息记录失败:', error);
  }
}

/**
 * 创建空消息
 * @returns {string} JSON字符串
 */
function createEmptyMessage() {
  return JSON.stringify({
    rs: 1,
    tip: "",
    end: 0
  });
}

/**
 * 创建消息
 * @param {string} tip - 消息内容
 * @param {number} end - 结束标志（0或1）
 * @returns {string} JSON字符串
 */
function createMessage(tip, end = 0) {
  return JSON.stringify({
    rs: 1,
    tip: tip,
    end: end
  });
}

/**
 * [友/群] 主动消息（任意）专用：带 wxid 的单条消息
 * @param {string} tip - 消息内容
 * @param {string} wxid - 发送对象（好友为 wxid/mid，群为 gid@chatroom）
 * @returns {string} JSON 字符串
 */
function createMessageWithWxid(tip, wxid) {
  return JSON.stringify({
    rs: 1,
    wxid: wxid || '',
    tip: tip || '',
    end: 1
  });
}

