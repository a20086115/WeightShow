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
  env: "your-env", // 需替换为实际使用环境 id
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
  const { pkId = 'c69c6e4c67bc6929033282c0167851e5' } = event; // 从事件中获取PK赛ID
  
  // 解析 event.body
  const bodyParams = {};
  if (event.body) {
    event.body.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      bodyParams[key] = decodeURIComponent(value || '');
    });
  }
  console.log('解析后的body参数：', bodyParams);
  bodyParams.content = '口号';
  try {
    // 获取当前日期和小时
    const now = new Date();
    const currentHour = (now.getUTCHours() + 8) % 24; // 调整为中国标准时间
    const today = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]; // 格式：YYYY-MM-DD
    const currentMonth = today.slice(0, 7); // 获取当前月份，格式：YYYY-MM
    console.log(now, currentHour, today)
    let messageType = '';
    // 根据时间段确定消息类型
    if (currentHour >= 8 && currentHour < 10) {
      messageType = 'morning';
    } else if (currentHour >= 10 && currentHour < 18) {
      messageType = 'daytime';
    } else if (currentHour >= 18 && currentHour < 19) {
      messageType = 'evening_reminder';
    } else if (currentHour >= 19 && currentHour < 20) {
      messageType = 'dinner';
    } else if (currentHour >= 20) {
      messageType = 'daily_report';
    }

    if(bodyParams.content){
      // 判断content内容， 如果是统计，则发送统计结果daily_report，如果是以解答开头，则调用AI解答
      if(bodyParams.content.startsWith('统计')){
        messageType = 'daily_report';
      }else if(bodyParams.content.startsWith('口号')){
        messageType = 'morning';
      }else if(bodyParams.content.startsWith('解答')){
        messageType = 'ai_answer';
      }
    }
      

    // 如果不在任何消息时间段内，返回空消息
    if (!messageType && !bodyParams.content) {
      return JSON.stringify({
        rs: 1,
        tip: "",
        end: 0
      });
    }

    // 检查今天该类型的消息是否已推送
    // 只有在没有 content 参数时才检查推送记录
    if (!bodyParams.content) {
      const pushRecord = await db.collection('pushRecords').where({
        pkId: pkId,
        pushDate: today,
        messageType: messageType
      }).get();

      // 如果已经推送过，返回空消息
      if (pushRecord.data.length > 0) {
        return JSON.stringify({
          rs: 1,
          tip: "",
          end: 0
        });
      }
    }

    // 查询PK集合，获取比赛成员的openid
    const pkRes = await db.collection('pk').where({
      _id: pkId
    }).get();

    if (pkRes.data.length === 0) {
      return {
        statusCode: 404,
        error: 'PK赛未找到'
      }
    }

    let members = pkRes.data[0].members; // 假设成员信息在'members'字段中
    const openIds = members.map(member => member.openId);

    // 批量查询用户信息
    const userResults = await db.collection('users').where({
      openId: db.command.in(openIds)
    }).get();

    // 将用户信息与成员信息合并
    members = members.map(member => {
      const userInfo = userResults.data.find(user => user.openId === member.openId) || {};
      return {
        ...member,
        ...userInfo
      };
    });

    // 查询weight数据，只查询本月的，并按日期排序
    const weightPromises = members.map(member => {
      return db.collection('records').where({
        openId: member.openId,
        date: db.RegExp({
          regexp: `^${currentMonth}`, // 正则表达式匹配当前月份
          options: 'i',
        })
      }).orderBy('date', 'asc').get(); // 按日期升序排序
    });

    const weightResults = await Promise.all(weightPromises);

    // 计算达标率
    let totalMembers = members.length;
    let completedMembers = weightResults.filter(result => 
      result.data.some(record => record.date === today)
    ).length;
    let completionRate = (completedMembers / totalMembers) * 100;

    // 获取当月天数
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDayOfMonth = now.getDate();
    console.log(daysInMonth, currentDayOfMonth, members)
    // 生成打卡明细
    let details = members.map((member, index) => {
      const records = weightResults[index].data;
      const currentWeight = records.length > 0 ? records[records.length - 1].weight : '未知';
      const targetWeight = member.aimWeight || '未知'; // 假设目标体重存储在成员信息中

      if (currentWeight === '未知' || targetWeight === '未知' || records.length === 0) {
        return `姓名 ${member.nickName} 当月打卡数据 `;
      }

      const initialWeight = records[0].weight; // 1号的体重
      const yesterdayWeight = records.length > 1 ? records[records.length - 2].weight : currentWeight;
      const totalWeightLoss = (initialWeight - currentWeight).toFixed(2);
      const weightChange = (currentWeight - yesterdayWeight).toFixed(2);
      const totalWeightLossNeeded = initialWeight - targetWeight;
      const completionPercentage = ((initialWeight - currentWeight) / totalWeightLossNeeded * 100).toFixed(2);
      const progress = currentWeight <= (initialWeight - (totalWeightLossNeeded / daysInMonth) * currentDayOfMonth) ? '超越' : '滞后';

      return `姓名 ${member.nickName} 当前体重${currentWeight} 今日变化${weightChange} 月初体重${initialWeight} 目标体重${targetWeight} 累计减重${totalWeightLoss} 目标完成率${completionPercentage}% 目标完成进度【${progress}】`;
    }).join('\n');

    let message = '';
    if (messageType === 'morning') {
      // 如果今天已经生成过战队宣言，则发送今天生成的战队宣言
      const todayMessage = await db.collection('pushRecords').where({
        pkId: pkId,
        pushDate: today,
        messageType: 'morning'
      }).get();

      if(todayMessage.data.length > 0){
        message = {
          rs: 1,
          tip: todayMessage.data[0].messageContent,
          end: 0
        };
      }else{
        // AI 生成今日战队宣言
        const aiMessage = await callAi('生成今日减肥战队宣言');
        message = {
          rs: 1,
          tip: "🌞【今日战队宣言】\n" + aiMessage,
          end: 0
        };
      }
    } else if (messageType === 'daytime') {
      message = {
        rs: 1,
        tip: "🧠【科学减脂小课堂】\n饿的时候先喝水！\n❗️研究发现：67%的'饥饿感'实为脱水！",
        end: 0
      };
    } else if (messageType === 'evening_reminder') {
      message = {
        rs: 1,
        tip: `⏰【数据录入倒计时】\n今日还剩5小时记录体重！\n✅ 当前${completedMembers}/${totalMembers}人已完成，达${completionRate.toFixed(2)}%解锁明日团队壁纸！`,
        end: 0
      };
    } else if (messageType === 'dinner') {
      message = {
        rs: 1,
        tip: "🎯【挑战任务】\n晒出你最爱的低卡晚餐照片！\n📸 点赞最高者明日海报C位出道！",
        end: 0
      };
    } else if (messageType === 'daily_report') {
      message = {
        rs: 1,
        tip: `📊【战队战报】\n🔥今日打卡率${completionRate.toFixed(2)}%！\n今日打卡明细\n${details}`,
        end: 0
      };
    } else if (messageType === 'ai_answer') {
      // 调用AI解答
      const aiAnswer = await callAi(bodyParams.content);
      message = {
        rs: 1,
        tip: `💡【AI解答】\n${aiAnswer}`,
        end: 0
      };
    }

    // 如果不是content有值，则保存推送记录
    if(!bodyParams.content){
      await db.collection('pushRecords').add({
        data: {
          pkId: pkId,
          pushDate: today,
          messageType: messageType,
          messageContent: message.tip,
          createdAt: db.serverDate()
        }
      })
    }

    return JSON.stringify(message);

  } catch (error) {
    return JSON.stringify({
      rs: 1,
      tip: `错误：${error.message}`,
      end: 0
    });
  }
}

async function callAi(content) {
  try {
    await auth.signInAnonymously(); // 或者使用其他登录方式
    const ai = await app.ai();
    // 接下来就可以调用 ai 模块提供的方法了
    // 调用AI机器人接口
    const res = await ai.bot.sendMessage({
      data: {
        botId: "app-er4p84fo", // 替换为实际的Agent唯一标识
        msg: content, // 用户的输入内容
        history: [], // 历史对话内容，首次对话可以为空
      },
    });

    // 收集AI的回答
    let aiResponse = '';
    for await (let x of res.textStream) {
      aiResponse += x;
    }
    console.log('AI回答：', aiResponse);
    return aiResponse;
  } catch (error) {
    console.error("调用AI接口出错：", error);
    throw new Error("AI服务暂时不可用，请稍后再试。");
  }
} 