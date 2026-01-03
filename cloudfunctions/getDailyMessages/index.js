/*
 * @Author: YuWenqiang
 * @Date: 2025-02-24 18:31:34
 * @Description: 
 * 
 */
// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { pkId } = event; // 从事件中获取PK赛ID

  try {
    // 查询PK集合，获取比赛成员的openid
    const pkRes = await db.collection('pk').where({
      pkId: pkId
    }).get();

    if (pkRes.data.length === 0) {
      return {
        statusCode: 404,
        error: 'PK赛未找到'
      }
    }

    const members = pkRes.data[0].members; // 假设成员信息在'members'字段中

    // 查询weight数据
    const weightPromises = members.map(member => {
      return db.collection('weight').where({
        openid: member.openid
      }).get();
    });

    const weightResults = await Promise.all(weightPromises);

    // 计算达标率
    let totalMembers = members.length;
    let completedMembers = weightResults.filter(result => result.data.length > 0).length;
    let completionRate = (completedMembers / totalMembers) * 100;

    // 根据时间生成消息
    const currentHour = new Date().getHours();
    let messages = [];

    if (currentHour >= 7 && currentHour < 10) {
      messages.push({
        time: "7:30",
        type: "每日减肥宣言",
        template: "🌞【今日战队宣言】\n早起一杯温水！今日目标：拒绝零食！\n👉 跟贴回复你的今日小目标！",
        logic: "手动@3名昨日积极用户示范回复（如"@用户A 目标：午餐吃粗粮"）"
      });
    }

    if (currentHour >= 10 && currentHour < 18) {
      messages.push({
        time: "10:00",
        type: "减肥小贴士",
        template: "🧠【科学减脂小课堂】\n饿的时候先喝水！\n❗️研究发现：67%的'饥饿感'实为脱水！",
        logic: "每周一、三、五发饮食技巧；二、四发运动技巧；周末发心理激励短文"
      });
    }

    if (currentHour >= 18 && currentHour < 19) {
      messages.push({
        time: "18:30",
        type: "打卡提醒",
        template: `⏰【数据录入倒计时】\n今日还剩5小时记录体重！\n✅ 当前${completedMembers}/${totalMembers}人已完成，达${completionRate.toFixed(2)}%解锁明日团队壁纸！`,
        logic: "根据剩余人数动态修改文案（如"差3人满员"）"
      });
    }

    if (currentHour >= 19 && currentHour < 20) {
      messages.push({
        time: "19:30",
        type: "随机互动任务",
        template: "🎯【挑战任务】\n晒出你最爱的低卡晚餐照片！\n📸 点赞最高者明日海报C位出道！",
        logic: "每周二、四、六发布，任务类型轮换（拍照/投票/问答）"
      });
    }

    if (currentHour >= 20) {
      messages.push({
        time: "20:30",
        type: "当日进度海报",
        template: `📊【战队战报】\n🔥今日达标率${completionRate.toFixed(2)}%！\n🏆MVP：@用户B（连续3天体重↓）\n🌙明日提升点：增加饮水人数`,
        logic: "海报自动生成：包含完成率曲线图、TOP3用户昵称、团队累计减重总斤数"
      });
    }

    return {
      statusCode: 200,
      data: messages
    }
  } catch (error) {
    return {
      statusCode: 500,
      error: error.message
    }
  }
} 