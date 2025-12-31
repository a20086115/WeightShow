const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

/**
 * 获取用户年度打卡报告数据
 * @param {object} event - 事件对象
 * @param {object} context - 上下文对象
 * @returns {Promise<object>} 年度报告数据
 */
exports.main = async (event, context) => {
  let openId = event.userInfo.openId;
  let year = event.year || '2025'; // 默认查询2025年
  
  // 如果参数中有openId, 则取参数的openId
  if (event.openId) {
    openId = event.openId;
  }

  try {
    // 查询用户信息（用于获取昵称和身高）
    const userRes = await db.collection('users')
      .where({ openId: openId })
      .get();
    const userInfo = userRes.data && userRes.data.length > 0 ? userRes.data[0] : {};
    
    // 查询该年度的所有打卡记录
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const records = await db.collection('records')
      .where({
        date: _.and(_.gte(startDate), _.lte(endDate)),
        openId: openId
      })
      .orderBy('date', 'asc')
      .get();

    const recordsData = records.data || [];
    
    // 过滤出有体重数据的记录
    const weightRecords = recordsData.filter(r => r.weight && r.weight > 0);
    
    // 计算统计数据
    const stats = {
      // 总打卡天数（有记录的日期数）
      totalDays: new Set(recordsData.map(r => r.date)).size,
      // 总打卡次数
      totalCount: recordsData.length,
      // 有体重数据的打卡次数
      weightCount: weightRecords.length,
      // 年初体重（1月1日或最早记录）
      startWeight: null,
      startDate: null,
      // 年末体重（12月31日或最晚记录）
      endWeight: null,
      endDate: null,
      // 最重体重
      maxWeight: null,
      maxWeightDate: null,
      // 最轻体重
      minWeight: null,
      minWeightDate: null,
      // 平均体重
      avgWeight: null,
      // 体重变化
      weightChange: null,
      // 连续打卡天数
      maxConsecutiveDays: 0,
      // 月度统计
      monthlyStats: {}
    };

    if (weightRecords.length > 0) {
      // 年初体重（最早记录）
      const firstRecord = weightRecords[0];
      stats.startWeight = firstRecord.weight;
      stats.startDate = firstRecord.date;

      // 年末体重（最晚记录）
      const lastRecord = weightRecords[weightRecords.length - 1];
      stats.endWeight = lastRecord.weight;
      stats.endDate = lastRecord.date;

      // 体重变化
      stats.weightChange = parseFloat((stats.endWeight - stats.startWeight).toFixed(2));

      // 最重和最轻体重
      let maxWeight = weightRecords[0].weight;
      let maxWeightDate = weightRecords[0].date;
      let minWeight = weightRecords[0].weight;
      let minWeightDate = weightRecords[0].date;

      let totalWeight = 0;
      weightRecords.forEach(record => {
        totalWeight += record.weight;
        if (record.weight > maxWeight) {
          maxWeight = record.weight;
          maxWeightDate = record.date;
        }
        if (record.weight < minWeight) {
          minWeight = record.weight;
          minWeightDate = record.date;
        }
      });

      stats.maxWeight = maxWeight;
      stats.maxWeightDate = maxWeightDate;
      stats.minWeight = minWeight;
      stats.minWeightDate = minWeightDate;
      stats.avgWeight = parseFloat((totalWeight / weightRecords.length).toFixed(2));

      // 计算连续打卡天数
      const dates = [...new Set(recordsData.map(r => r.date))].sort();
      let maxConsecutive = 0;
      let currentConsecutive = 1;

      for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i - 1]);
        const currDate = new Date(dates[i]);
        const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          currentConsecutive++;
        } else {
          maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
          currentConsecutive = 1;
        }
      }
      stats.maxConsecutiveDays = Math.max(maxConsecutive, currentConsecutive);

      // 月度统计
      const monthlyData = {};
      recordsData.forEach(record => {
        const month = record.date.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
          monthlyData[month] = {
            count: 0,
            weightCount: 0,
            weights: []
          };
        }
        monthlyData[month].count++;
        if (record.weight && record.weight > 0) {
          monthlyData[month].weightCount++;
          monthlyData[month].weights.push(record.weight);
        }
      });

      // 计算每月平均体重，并找出高光月份
      let highlightMonth = null;
      let maxWeightLoss = 0;
      let maxCountMonth = null;
      let maxCount = 0;
      
      Object.keys(monthlyData).forEach(month => {
        const monthData = monthlyData[month];
        if (monthData.weights.length > 0) {
          const avg = monthData.weights.reduce((a, b) => a + b, 0) / monthData.weights.length;
          const minWeight = Math.min(...monthData.weights);
          const maxWeight = Math.max(...monthData.weights);
          const weightLoss = maxWeight - minWeight;
          
          stats.monthlyStats[month] = {
            count: monthData.count,
            weightCount: monthData.weightCount,
            avgWeight: parseFloat(avg.toFixed(2)),
            minWeight: parseFloat(minWeight.toFixed(2)),
            maxWeight: parseFloat(maxWeight.toFixed(2)),
            weightLoss: parseFloat(weightLoss.toFixed(2))
          };
          
          // 找出减重最多的月份（逆袭月）
          if (weightLoss > maxWeightLoss) {
            maxWeightLoss = weightLoss;
            highlightMonth = month;
          }
          
          // 找出打卡次数最多的月份（劳模月）
          if (monthData.count > maxCount) {
            maxCount = monthData.count;
            maxCountMonth = month;
          }
        } else {
          stats.monthlyStats[month] = {
            count: monthData.count,
            weightCount: 0,
            avgWeight: null
          };
          
          if (monthData.count > maxCount) {
            maxCount = monthData.count;
            maxCountMonth = month;
          }
        }
      });
      
      // 计算BMI（如果有身高）
      if (userInfo.height && stats.startWeight && stats.endWeight) {
        const heightM = userInfo.height / 100; // 转换为米
        const startWeightKg = stats.startWeight / 2; // 转换为kg
        const endWeightKg = stats.endWeight / 2;
        
        stats.startBMI = parseFloat((startWeightKg / (heightM * heightM)).toFixed(2));
        stats.endBMI = parseFloat((endWeightKg / (heightM * heightM)).toFixed(2));
        stats.bmiChange = parseFloat((stats.endBMI - stats.startBMI).toFixed(2));
        
        // BMI分类
        const getBMICategory = (bmi) => {
          if (bmi <= 18.4) return '偏瘦';
          if (bmi < 24) return '正常';
          if (bmi < 28) return '过重';
          return '肥胖';
        };
        
        stats.startBMICategory = getBMICategory(stats.startBMI);
        stats.endBMICategory = getBMICategory(stats.endBMI);
      }
      
      // 生成个性标签
      const tags = [];
      
      // 1. 减重相关标签（按减重幅度分级）
      if (stats.weightChange < -10) {
        tags.push('减重10斤+超级达人');
      } else if (stats.weightChange < -5) {
        tags.push('稳扎稳打减脂选手');
      } else if (stats.weightChange < 0) {
        tags.push('自律减重达人');
      } else if (stats.weightChange === 0 && stats.weightCount > 0) {
        tags.push('体重管理大师'); // 体重保持稳定
      } else if (stats.weightChange > 0 && stats.weightCount > 0) {
        tags.push('体重增长观察者'); // 体重增加但仍在记录
      }
      
      // 2. 连续打卡标签
      if (stats.maxConsecutiveDays >= 60) {
        tags.push(`${stats.maxConsecutiveDays}天连续打卡传奇`);
      } else if (stats.maxConsecutiveDays >= 30) {
        tags.push(`${stats.maxConsecutiveDays}天自律王者`);
      } else if (stats.maxConsecutiveDays >= 15) {
        tags.push('坚持打卡小能手');
      } else if (stats.maxConsecutiveDays >= 7) {
        tags.push('一周坚持者');
      } else if (stats.maxConsecutiveDays >= 3) {
        tags.push('打卡新星'); // 降低门槛，至少3天连续
      }
      
      // 3. 总打卡天数标签
      if (stats.totalDays >= 200) {
        tags.push('年度打卡超级劳模');
      } else if (stats.totalDays >= 100) {
        tags.push('年度打卡劳模');
      } else if (stats.totalDays >= 50) {
        tags.push('打卡积极分子');
      } else if (stats.totalDays >= 30) {
        tags.push('月度打卡达人');
      } else if (stats.totalDays >= 10) {
        tags.push('打卡入门者'); // 降低门槛，至少10天
      }
      
      // 4. 数据质量标签（有体重数据的记录占比）
      if (stats.totalCount > 0) {
        const weightDataRatio = stats.weightCount / stats.totalCount;
        if (weightDataRatio >= 0.9 && stats.weightCount >= 20) {
          tags.push('数据记录完美主义者');
        } else if (weightDataRatio >= 0.7 && stats.weightCount >= 10) {
          tags.push('数据记录达人');
        } else if (weightDataRatio >= 0.5 && stats.weightCount >= 5) {
          tags.push('数据记录者'); // 降低门槛
        }
      }
      
      // 5. 月度表现标签（基于高光月份）
      if (highlightMonth && maxWeightLoss >= 10) {
        tags.push('月度逆袭之星');
      } else if (highlightMonth && maxWeightLoss >= 5) {
        tags.push('月度突破者');
      } else if (highlightMonth && maxWeightLoss >= 2) {
        tags.push('月度进步者'); // 降低门槛，至少2斤
      }
      
      // 6. 打卡频率标签（平均每月打卡次数）
      if (stats.totalCount > 0) {
        const monthlyAvgCount = stats.totalCount / 12;
        if (monthlyAvgCount >= 25) {
          tags.push('月度全勤标兵');
        } else if (monthlyAvgCount >= 20) {
          tags.push('高频打卡者');
        } else if (monthlyAvgCount >= 10) {
          tags.push('活跃打卡者'); // 降低门槛
        }
      }
      
      // 7. 体重稳定性标签（如果体重变化很小且有足够数据）
      if (stats.weightChange >= -2 && stats.weightChange <= 2 && stats.weightCount >= 30) {
        tags.push('体重稳定大师');
      } else if (stats.weightChange >= -1 && stats.weightChange <= 1 && stats.weightCount >= 10) {
        tags.push('体重稳定者'); // 降低门槛
      }
      
      // 8. 基础标签（确保至少有一个标签）
      if (tags.length === 0) {
        if (stats.totalCount > 0) {
          tags.push('2025年打卡记录者');
        } else if (stats.totalDays > 0) {
          tags.push('开始记录之旅');
        }
      }
      
      stats.personalityTags = tags;
      stats.highlightMonth = highlightMonth;
      // 格式化高光月份减重数值，保留两位小数
      stats.highlightMonthLoss = highlightMonth ? parseFloat(maxWeightLoss.toFixed(2)) : null;
      stats.maxCountMonth = maxCountMonth;
      stats.maxCount = maxCount;
    }
    
    // 添加用户信息
    stats.userInfo = {
      nickName: userInfo.nickName || userInfo.nickname || '用户', // 兼容不同的字段名
      avatarUrl: userInfo.avatarUrl || '',
      height: userInfo.height || null
    };
    
    // 如果还是没有昵称，记录日志便于调试
    if (!stats.userInfo.nickName || stats.userInfo.nickName === '用户') {
      console.log('用户昵称为空，userInfo:', userInfo);
    }

    // 返回所有记录和统计数据
    return {
      records: recordsData,
      stats: stats,
      year: year
    };
  } catch (e) {
    console.error('getYearlyReport 错误:', e);
    return {
      errMsg: e.message || '查询失败',
      errCode: -1
    };
  }
}

