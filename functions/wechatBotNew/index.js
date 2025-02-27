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

// 云函数入口函数
exports.main = async (event, context) => {
  const { pkId = 'c69c6e4c67bc6929033282c0167851e5' } = event;
  
  // 解析 event.body
  const bodyParams = {};
  if (event.body) {
    event.body.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      bodyParams[key] = decodeURIComponent(value || '');
    });
  }
  console.log('解析后的body参数：', bodyParams);

  try {
    // 获取当前日期和小时
    const now = new Date();
    const currentHour = (now.getUTCHours() + 8) % 24; // 调整为中国标准时间
    const today = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7);

    let messageType = '';
    // 根据时间段确定消息类型
    if (currentHour >= 8 && currentHour < 10) {
      messageType = 'morning';
    } else if (currentHour >= 10 && currentHour < 18) {
      messageType = 'daytime';
    } else if (currentHour >= 20 && currentHour < 21) {
      messageType = 'evening_reminder';
    } else if (currentHour >= 21) {
      messageType = 'daily_report';
    }
    console.log('初始消息类型：', messageType);

    // 根据 content 内容判断消息类型
    if (bodyParams.content) {
      console.log('检测到content参数，内容：', bodyParams.content);
      bodyParams.content = decodeUnicode(bodyParams.content)
      if (bodyParams.content.startsWith('统计')) {
        messageType = 'total_report';
      } else if (bodyParams.content.startsWith('口号')) {
        messageType = 'morning';
      } else if (bodyParams.content.startsWith('解答')) {
        messageType = 'ai_answer';
      } else if (bodyParams.content.startsWith('日报')) {
        messageType = 'daily_report';
      } else{
        bodyParams.content = ''
      }
      console.log('根据content更新后的消息类型：', messageType);
    }

    // 如果不在任何消息时间段内且没有特定内容，返回空消息
    if (!messageType && !bodyParams.content) {
      console.log('无有效消息类型，返回空消息');
      return JSON.stringify({
        rs: 1,
        tip: "",
        end: 0
      });
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
        return JSON.stringify({
          rs: 1,
          tip: "",
          end: 0
        });
      }
    }

    // 查询PK集合
    const pkRes = await db.collection('pk').where({
      _id: pkId
    }).get();

    if (pkRes.data.length === 0) {
      console.error('未找到PK赛信息');
      return JSON.stringify({
        rs: 1,
        tip: "未找到PK赛信息",
        end: 0
      });
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

    let message = '';
    if (messageType === 'morning') {
      const aiMessage = await callAi('生成今日减肥战队宣言');
      message = {
        rs: 1,
        tip: "\UE04A【今日战队宣言】\n" + aiMessage,
        end: 0
      };
    } else if (messageType === 'daytime') {
      message = {
        rs: 1,
        tip: "\UE315【科学减脂小课堂】\n饿的时候先喝水！\n❗️研究发现：67%的'饥饿感'实为脱水！",
        end: 0
      };
    } else if (messageType === 'evening_reminder') {
      message = {
        rs: 1,
        tip: `\UE02D【数据录入倒计时】\n今日还剩5小时记录体重！\n \UE032 当前${completedMembers}/${totalMembers}人已完成，达${completionRate.toFixed(2)}%解锁明日团队壁纸！`,
        end: 0
      };
    } else if (messageType === 'daily_report') {
      // 简单的每日打卡统计
      const simpleDetails = members.map(member => {
        const hasRecord = todayRecords.data.find(record => record.openId === member.openId);
        return `${member.nickName}: ${hasRecord ? '已打卡 \UE032' : '未打卡 \UE333'}`;
      }).join('\n');

      message = {
        rs: 1,
        tip: `\\UE11D【今日战报】\n 今日打卡率${completionRate.toFixed(2)}%\n\n${simpleDetails}`,
        end: 0
      };
    } else if (messageType === 'total_report') {
      // 详细的体重变化统计
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

      // 生成详细统计
      const details = members.map((member, index) => {
        const records = weightResults[index].data;
        const currentWeight = records.length > 0 ? records[records.length - 1].weight : '未知';
        const targetWeight = member.aimWeight || '未知';

        if (currentWeight === '未知' || targetWeight === '未知' || records.length === 0) {
          return `姓名 ${member.nickName} 当月打卡数据 `;
        }

        const initialWeight = records[0].weight;
        const yesterdayWeight = records.length > 1 ? records[records.length - 2].weight : currentWeight;
        const totalWeightLoss = (initialWeight - currentWeight).toFixed(2);
        const weightChange = (currentWeight - yesterdayWeight).toFixed(2);
        const totalWeightLossNeeded = initialWeight - targetWeight;
        const completionPercentage = ((initialWeight - currentWeight) / totalWeightLossNeeded * 100).toFixed(2);

        // 获取当月天数
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const currentDayOfMonth = now.getDate();
        const progress = currentWeight <= (initialWeight - (totalWeightLossNeeded / daysInMonth) * currentDayOfMonth) ? '超越' : '滞后';

        return `姓名 ${member.nickName} 当前体重${currentWeight} 今日变化${weightChange} 月初体重${initialWeight} 目标体重${targetWeight} 累计减重${totalWeightLoss} 目标完成率${completionPercentage}% 目标完成进度【${progress}】`;
      }).join('\n');

      message = {
        rs: 1,
        tip: `📊【战队战报】\n🔥今日打卡率${completionRate.toFixed(2)}%\n\n${details}`,
        end: 0
      };
    } else if (messageType === 'ai_answer') {
      const aiAnswer = await callAi(bodyParams.content);
      message = {
        rs: 1,
        tip: `💡【AI解答】\n${aiAnswer}`,
        end: 0
      };
    }
    console.log('生成的消息内容：', message);

    // 保存推送记录（仅当没有content参数时保存）
    if (!bodyParams.content) {
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

    return JSON.stringify(message);

  } catch (error) {
    console.error('执行过程中发生错误：', error);
    return JSON.stringify({
      rs: 1,
      tip: `错误：${error.message}`,
      end: 0
    });
  }
}

// AI调用函数
async function callAi(content) {
  console.log('开始调用AI，输入内容：', content);
  try {
    await auth.signInAnonymously();
    const ai = await app.ai();
    
    const res = await ai.bot.sendMessage({
      data: {
        botId: "app-er4p84fo",
        msg: content,
        history: [],
      },
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

// 解码函数
function decodeUnicode(str) {
  // 方法 1：通过 JSON.parse 转换（推荐）
  const decoded1 = JSON.parse(`"${str.replace(/\\/g, "\\\\")}"`);

  // 方法 2：通过 replace 正则转换
  const decoded2 = str.replace(/\\u([\dA-Fa-f]{4})/g, (_, grp) => 
    String.fromCharCode(parseInt(grp, 16))
  );

  return decoded2; // 两种方法结果一致
}