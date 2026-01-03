/*
 * @Author: YuWenqiang
 * @Date: 2025-02-24 18:31:34
 * @Description: 
 * 
 */

// 在 Node.js 项目的根目录下，使用 npm 或 yarn 安装所需的包：
// npm i @cloudbase/js-sdk@next
// npm i @cloudbase/adapter-node

// 引入 SDK，这里我们引入了完整的 clousebase-js-sdk，也支持分模块引入
const cloudbase = require("@cloudbase/js-sdk");
// 引入 node.js 端的适配器，详情请参考 https://docs.cloudbase.net/api-reference/webv3/adapter#%E4%B8%80%E5%A5%97%E4%BB%A3%E7%A0%81%E5%A4%9A%E7%AB%AF%E9%80%82%E9%85%8D
const adapter = require("@cloudbase/adapter-node");
const { sessionStorage } = adapter.genAdapter();
cloudbase.useAdapters(adapter);
const app = cloudbase.init({
  env: "release-ba24f3", // 需替换为实际使用环境 id
});
/**
 * auth 初始化的时候要传入storage 和 captchaOptions.openURIWithCallback
 * 否则会用默认的，依赖于平台，在 nodejs 环境报错
 */
const auth = app.auth({
  storage: sessionStorage,
  captchaOptions: {
    openURIWithCallback: () =>
      console.log("open uri with callback"),
  },
});

// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
const db = cloud.database()

/**
 * 云函数主入口
 * @param {object} event - 事件对象
 * @param {object} context - 上下文对象
 * @returns {Promise<string>} JSON字符串格式的响应
 */
exports.main = async (event, context) => {
  try {
    const { pkId = 'ef34384667c180d7001c7e9b0beb8475' } = event;
    
    // 解析 event.body
    const bodyParams = parseBodyParams(event.body);
    console.log('解析后的body参数：', bodyParams);
    // 获取当前日期和小时
    const now = new Date();
    const currentHour = (now.getUTCHours() + 8) % 24; // 调整为中国标准时间
    const today = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7);

    // 根据时间段确定消息类型
    let messageType = getMessageTypeByTime(currentHour);
    console.log('初始消息类型：', messageType);


    // 根据content内容判断消息类型（优先级高于时间段）
    if (bodyParams.content) {
      messageType = getMessageTypeByContent(bodyParams.content, messageType);
    }

    // 如果不在任何消息时间段内且没有特定内容，返回空消息
    if (!messageType && !bodyParams.content) {
      console.log('无有效消息类型，返回空消息');
      return createEmptyMessage();
    }

    // 检查今天该类型的消息是否已推送（仅当没有content参数时检查）
    if (!bodyParams.content) {
      const pushRecord = await db.collection('pushRecords').where({
        pkId: pkId,
        pushDate: today,
        messageType: messageType
      }).get();
      console.log('推送记录查询结果：', pushRecord);

      if (pushRecord.data.length > 0) {
        console.log('该类型消息今日已推送，返回空消息');
        return createEmptyMessage();
      }
    }

    // 查询PK集合
    const pkRes = await db.collection('pk').where({
      _id: pkId
    }).get();

    if (pkRes.data.length === 0) {
      console.error('未找到PK赛信息');
      return createMessage("未找到PK赛信息");
    }

    let members = pkRes.data[0].members;
    const openIds = members.map(member => member.openId);

    // 批量查询用户信息
    const userResults = await db.collection('users').where({
      openId: db.command.in(openIds)
    }).get();

    // 合并用户信息
    members = members.map(member => {
      const userInfo = userResults.data.find(user => user.openId === member.openId) || {};
      return { ...member, ...userInfo };
    });

    // 查询今日打卡记录
    const todayRecords = await db.collection('records').where({
      openId: db.command.in(openIds),
      date: today
    }).get();

    // 基础统计数据
    const totalMembers = members.length;
    const completedMembers = todayRecords.data.length;
    const completionRate = (completedMembers / totalMembers) * 100;

    // 生成消息内容
    const message = await generateMessage(
      messageType,
      bodyParams.content,
      members,
      todayRecords.data,
      totalMembers,
      completedMembers,
      completionRate,
      currentMonth,
      now
    );

    // 保存推送记录（仅当没有content参数时保存）
    if (!bodyParams.content && messageType) {
      const recordData = {
        pkId: pkId,
        pushDate: today,
        messageType: messageType,
        messageContent: message.tip,
        createdAt: db.serverDate()
      };
      console.log('准备保存推送记录：', recordData);
      await db.collection('pushRecords').add({ data: recordData });
    }

    console.log('生成的消息内容：', message);
    return JSON.stringify(message);
  } catch (error) {
    console.error('执行过程中发生错误：', error);
    return createMessage(`错误：${error.message}`);
  }
};

/**
 * 解析body参数
 * @param {string} body - 请求体字符串
 * @returns {object} 解析后的参数对象
 */
function parseBodyParams(body) {
  const bodyParams = {};
  if (body) {
    body.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key) {
        bodyParams[key] = decodeURIComponent(value || '');
      }
    });
  }
  return bodyParams;
}

/**
 * 根据时间段获取消息类型
 * @param {number} currentHour - 当前小时（0-23）
 * @returns {string} 消息类型
 */
function getMessageTypeByTime(currentHour) {
  if (currentHour >= 8 && currentHour < 9) {
    return 'morning';
  } else if (currentHour >= 11 && currentHour < 12) {
    return 'daytime';
  } else if (currentHour >= 20 && currentHour < 21) {
    return 'evening_reminder';
  } else if (currentHour >= 21) {
    return 'daily_report';
  }
  return '';
}

/**
 * 根据内容获取消息类型
 * @param {string} content - 消息内容
 * @param {string} defaultType - 默认消息类型
 * @returns {string} 消息类型
 */
function getMessageTypeByContent(content, defaultType = '') {
  const decodedContent = decodeUnicode(content);
  
  if (decodedContent.startsWith('统计')) {
    return 'total_report';
  } else if (decodedContent.startsWith('口号')) {
    return 'morning';
  } else if (decodedContent.startsWith('技巧')) {
    return 'daytime';
  } else if (decodedContent.startsWith('解答')) {
    return 'ai_answer';
  } else if (decodedContent.startsWith('日报')) {
    return 'daily_report';
  }
  
  return defaultType;
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
 * @returns {string} JSON字符串
 */
function createMessage(tip) {
  return JSON.stringify({
    rs: 1,
    tip: tip,
    end: 0
  });
}

/**
 * 生成消息内容
 * @param {string} messageType - 消息类型
 * @param {string} content - 用户输入内容
 * @param {array} members - 成员列表
 * @param {array} todayRecords - 今日打卡记录
 * @param {number} totalMembers - 总成员数
 * @param {number} completedMembers - 已完成成员数
 * @param {number} completionRate - 完成率
 * @param {string} currentMonth - 当前月份
 * @param {Date} now - 当前时间
 * @returns {Promise<object>} 消息对象
 */
async function generateMessage(messageType, content, members, todayRecords, totalMembers, completedMembers, completionRate, currentMonth, now) {
  switch (messageType) {
    case 'morning': {
      const aiMessage = await callAi('生成1条今日减肥口号，30字以内，亲切有活力，有号召力');
      return {
        rs: 1,
        tip: "\\UE04A【今日战队宣言】\n" + aiMessage,
        end: 0
      };
    }
    case 'daytime': {
      const aiMessage = await callAi('生成减肥小知识，50字左右即可');
      return {
        rs: 1,
        tip: "\\UE315【减肥技巧】\n" + aiMessage + "\n注意：午餐不要吃多哦~八分饱更健康。",
        end: 0
      };
    }
    case 'evening_reminder': {
      return {
        rs: 1,
        tip: `\\UE02D【数据录入倒计时】\n今日还剩1小时记录体重！\n \UE032 当前${completedMembers}/${totalMembers}人已完成，达${completionRate.toFixed(2)}%！`,
        end: 0
      };
    }
    case 'daily_report': {
      const simpleDetails = members.map(member => {
        const hasRecord = todayRecords.find(record => record.openId === member.openId);
        return `${member.nickName}: ${hasRecord ? '已打卡 \UE032' : '未打卡 \UE333'}`;
      }).join('\n');
      return {
        rs: 1,
        tip: `\\UE11D【今日战报】\n 今日打卡率${completionRate.toFixed(2)}%(${completedMembers}/${totalMembers})\n\n${simpleDetails}`,
        end: 0
      };
    }
    case 'total_report': {
      return await generateTotalReport(members, currentMonth, now, completionRate, completedMembers, totalMembers);
    }
    case 'ai_answer': {
      const aiAnswer = await callAi(content + '【60秒内回复完】【不要markdown格式】');
      return {
        rs: 1,
        tip: `\\UE11D【AI解答】\n${aiAnswer}`,
        end: 0
      };
    }
    default:
      return createEmptyMessage();
  }
}

/**
 * 生成总报告
 * @param {array} members - 成员列表
 * @param {string} currentMonth - 当前月份
 * @param {Date} now - 当前时间
 * @param {number} completionRate - 完成率
 * @param {number} completedMembers - 已完成成员数
 * @param {number} totalMembers - 总成员数
 * @returns {Promise<object>} 消息对象
 */
async function generateTotalReport(members, currentMonth, now, completionRate, completedMembers, totalMembers) {
  // 查询所有成员的体重记录
  const weightPromises = members.map(member => {
    return db.collection('records').where({
      openId: member.openId,
      date: db.RegExp({
        regexp: `^${currentMonth}`,
        options: 'i',
      })
    }).orderBy('date', 'asc').get();
  });

  const weightResults = await Promise.all(weightPromises);
  console.log('体重记录查询结果：', weightResults);

  // 生成 Markdown 格式的表格
  const markdownContent = buildMarkdownReport(members, weightResults, currentMonth, now, completionRate, completedMembers, totalMembers);
  console.log('生成的Markdown内容：', markdownContent);

  // 调用 Markdown 转图片接口
  const imageBuffer = await convertMarkdownToImage(markdownContent);
  console.log('Markdown转图片完成');

  // 上传图片到云存储
  const today = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
  const uploadResult = await cloud.uploadFile({
    cloudPath: `reports/${currentMonth}/${today}_report.png`,
    fileContent: imageBuffer,
  });
  console.log('图片上传结果：', uploadResult);

  // 获取图片访问链接
  const fileList = [uploadResult.fileID];
  const result = await cloud.getTempFileURL({
    fileList: fileList,
  });
  console.log('获取图片链接结果：', result);

  const imageUrl = result.fileList[0].tempFileURL;

  return {
    rs: 1,
    tip: `\\UE11D【战队战报】\n[img]${imageUrl}`,
    end: 0
  };
}

/**
 * 构建Markdown报告内容
 * @param {array} members - 成员列表
 * @param {array} weightResults - 体重记录结果
 * @param {string} currentMonth - 当前月份
 * @param {Date} now - 当前时间
 * @param {number} completionRate - 完成率
 * @param {number} completedMembers - 已完成成员数
 * @param {number} totalMembers - 总成员数
 * @returns {string} Markdown内容
 */
function buildMarkdownReport(members, weightResults, currentMonth, now, completionRate, completedMembers, totalMembers) {
  let markdownContent = `# 战队${currentMonth}月度报告\n\n`;
  markdownContent += `## 今日打卡率：${completionRate.toFixed(2)}%\n\n`;
  markdownContent += '| 姓名 | 当前体重 | 月初体重 | 目标体重 | 累计减重 | 目标完成率 | 进度 |\n';
  markdownContent += '|------|----------|-----------|-----------|-----------|------------|--------|\n';

  members.forEach((member, index) => {
    const records = weightResults[index].data;
    const currentWeight = records.length > 0 ? records[records.length - 1].weight : '未知';
    const targetWeight = member.aimWeight || '未知';

    if (currentWeight === '未知' || targetWeight === '未知' || records.length === 0) {
      markdownContent += `| ${member.nickName} | 未打卡 | - | - | - | - | - |\n`;
      return;
    }

    const initialWeight = records[0].weight;
    const totalWeightLoss = (initialWeight - currentWeight).toFixed(2);
    const totalWeightLossNeeded = initialWeight - targetWeight;
    const completionPercentage = ((initialWeight - currentWeight) / totalWeightLossNeeded * 100).toFixed(2);

    // 计算进度
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDayOfMonth = now.getDate();
    const progress = currentWeight <= (initialWeight - (totalWeightLossNeeded / daysInMonth) * currentDayOfMonth) ? '超越' : '滞后';

    markdownContent += `| ${member.nickName} | ${currentWeight} | ${initialWeight} | ${targetWeight} | ${totalWeightLoss} | ${completionPercentage}% | ${progress} |\n`;
  });

  return markdownContent;
}

/**
 * 保存推送记录
 * @param {string} pkId - PK赛ID
 * @param {string} today - 今天日期
 * @param {string} messageType - 消息类型
 * @param {string} messageContent - 消息内容
 */
async function savePushRecord(pkId, today, messageType, messageContent) {
  try {
    const recordData = {
      pkId: pkId,
      pushDate: today,
      messageType: messageType,
      messageContent: messageContent,
      createdAt: db.serverDate()
    };
    console.log('准备保存推送记录：', recordData);
    await db.collection('pushRecords').add({ data: recordData });
  } catch (error) {
    console.error('保存推送记录失败:', error);
  }
}

// AI调用函数
async function callAi(content) {
  console.log('开始调用AI，输入内容：', content);
  try {
    await auth.signInAnonymously();
    const ai = await app.ai();
    
    const res = await ai.bot.sendMessage({
        botId: "bot-8accb6d8",
        msg: content,
        history: [],
    });

    let aiResponse = '';
    for await (let x of res.textStream) {
      aiResponse += x;
    }
    console.log('AI回答完成：', aiResponse);
    return aiResponse;
  } catch (error) {
    console.error("AI调用失败：", error);
    throw new Error("AI服务暂时不可用，请稍后再试。");
  }
} 

/**
 * 解码Unicode字符串
 * @param {string} str - 待解码的字符串
 * @returns {string} 解码后的字符串
 */
function decodeUnicode(str) {
  if (!str) return '';
  
  try {
    // 通过 replace 正则转换
    return str.replace(/\\u([\dA-Fa-f]{4})/g, (_, grp) => 
      String.fromCharCode(parseInt(grp, 16))
    );
  } catch (error) {
    console.error('Unicode解码失败:', error);
    return str;
  }
}

/**
 * 将Markdown转换为图片
 * @param {string} markdown - Markdown内容
 * @returns {Promise<Buffer>} 图片Buffer
 */
async function convertMarkdownToImage(markdown) {
  console.log('开始转换Markdown为图片');
  
  if (!markdown) {
    throw new Error('Markdown内容不能为空');
  }

  try {
    // 使用微信云函数内置的 HTTP 请求能力
    // 微信云函数环境支持 axios，如果没有安装可以使用内置的 request
    let axios;
    try {
      axios = require('axios');
    } catch (e) {
      // 如果没有 axios，使用微信云函数内置的 request
      const request = require('request');
      return new Promise((resolve, reject) => {
        const params = new URLSearchParams({
          content: markdown,
        });
        const url = `https://oiapi.net/API/MarkdownToImage?${params.toString()}`;
        
        request({
          url: url,
          encoding: null // 返回二进制数据
        }, (error, response, body) => {
          if (error) {
            reject(error);
          } else if (response.statusCode !== 200) {
            reject(new Error(`HTTP error! status: ${response.statusCode}`));
          } else {
            console.log('Markdown转图片成功，状态码：', response.statusCode);
            resolve(Buffer.from(body));
          }
        });
      });
    }
    
    // 构建URL和参数
    const params = new URLSearchParams({
      content: markdown,
    });
    const url = `https://oiapi.net/API/MarkdownToImage?${params.toString()}`;
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer'
    });
    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const buffer = Buffer.from(response.data);
    console.log('Markdown转图片成功，状态码：', response.status);
    return buffer;
  } catch (error) {
    console.error('Markdown转图片失败：', error);
    throw new Error('Markdown转图片服务暂不可用，请稍后再试');
  }
}