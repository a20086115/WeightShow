#!/usr/bin/env node
/**
 * wechatBotNew 接口测试脚本
 * 依次测试：个人定时、群定时、个人关键词、群关键词
 * 运行：Node.js 18+ 下执行 node test/wechatBotNew.test.js
 * 环境变量：SKW（必填，应用 ID）、BASE_URL（可选）
 */

const BASE_URL = process.env.BASE_URL || 'https://release-ba24f3-1257780911.ap-shanghai.app.tcloudbase.com';
const SKW = process.env.SKW || 'YOUR_SKW'; // 请设置环境变量 SKW 或在此替换为真实应用 ID
const PERSONAL_ID = 'wxid_fn8hiqd4hutg21';
const GROUP_ID = '823184';

const ENDPOINT = `${BASE_URL.replace(/\/$/, '')}/wechatBotNew`;

async function post(body) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    parsed = text;
  }
  return { status: res.status, ok: res.ok, data: parsed, raw: text };
}

function log(name, body, result) {
  console.log('\n' + '='.repeat(60));
  console.log('【' + name + '】');
  console.log('请求体:', JSON.stringify(body, null, 2));
  console.log('状态:', result.status, result.ok ? 'OK' : 'FAIL');
  console.log('响应:', typeof result.data === 'object' ? JSON.stringify(result.data, null, 2) : result.raw);
  console.log('='.repeat(60));
}

// 东八区当前小时（与云函数一致）
function getCstHour() {
  const now = new Date();
  return (now.getUTCHours() + 8) % 24;
}

// 根据东八区小时返回预期定时类型（与 wechatBotNew handleScheduledMessage 一致）
function getExpectedScheduledType(hour) {
  if (hour >= 7 && hour < 9) return 'morning（早上激励）';
  if (hour >= 11 && hour < 13) return 'lunch（午餐提醒）';
  if (hour >= 19 && hour < 21) return 'evening（晚上提醒）';
  if (hour >= 21 && hour < 23) return 'daily_summary/daily_report（每日总结/战报）';
  return '无（当前不在 7-9/11-13/19-21/21-23 时段，可能返回空或仅处理打卡评价）';
}

async function run() {
  const cstHour = getCstHour();
  const expectedType = getExpectedScheduledType(cstHour);

  console.log('wechatBotNew 接口测试');
  console.log('BASE_URL:', ENDPOINT);
  console.log('当前东八区小时:', cstHour, '→ 预期定时类型:', expectedType);
  console.log('SKW:', SKW === 'YOUR_SKW' ? '(未设置，请设置环境变量 SKW)' : SKW);
  if (SKW === 'YOUR_SKW') {
    console.log('\n提示：未设置 SKW 时，个人定时/群定时可能返回空消息，关键词仍可测路由。');
  }

  // 1. 个人定时（仅 skw，无 gid、无 content）
  const body1 = { skw: SKW };
  const res1 = await post(body1);
  log('1. 个人定时（仅 skw）', body1, res1);

  // 2. 群定时（gid + skw，无 content）
  const body2 = { gid: GROUP_ID, skw: SKW };
  const res2 = await post(body2);
  log('2. 群定时（gid + skw）', body2, res2);

  // 3. 个人关键词：关键词列表
  const body3 = { skw: SKW, wxuin: PERSONAL_ID, content: '关键词' };
  const res3 = await post(body3);
  log('3. 个人关键词 - 关键词列表', body3, res3);

  // 4. 个人关键词 - 激励
  const body4 = { skw: SKW, wxuin: PERSONAL_ID, content: '激励' };
  const res4 = await post(body4);
  log('4. 个人关键词 - 激励', body4, res4);

  // 5. 个人关键词 - 今日总结（需今日有打卡记录）
  const body5 = { skw: SKW, wxuin: PERSONAL_ID, content: '今日总结' };
  const res5 = await post(body5);
  log('5. 个人关键词 - 今日总结', body5, res5);

  // 6. 群关键词（仅绑定会处理；其他内容返回空）
  const body6 = { gid: GROUP_ID, skw: SKW, content: '关键词' };
  const res6 = await post(body6);
  log('6. 群关键词 - 非绑定内容（预期可为空）', body6, res6);

  // 7. 群关键词 - 绑定（需替换为真实 PK _id 才能绑定成功）
  const body7 = { gid: GROUP_ID, skw: SKW, content: '绑定：REPLACE_WITH_PK_ID' };
  const res7 = await post(body7);
  log('7. 群关键词 - 绑定（content 中 PK_ID 需替换为真实值）', body7, res7);

  console.log('\n全部用例执行完毕。');
  console.log('\n若定时类返回空，请参考 test/README.md 中「测试前：定时消息重复过滤说明」删除对应 robotMessages 后再测。');
}

run().catch((err) => {
  console.error('执行失败:', err);
  process.exit(1);
});
