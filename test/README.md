# wechatBotNew 接口测试

## 运行方式

```bash
# 在项目根目录或 test 目录下执行，需 Node.js 18+（内置 fetch）
node test/wechatBotNew.test.js
```

## 环境变量（可选）

- `SKW`：应用 ID，云函数入口要求必传，未设置时脚本内使用占位符（可能返回空消息）。
- `BASE_URL`：接口根地址，默认 `https://release-ba24f3-1257780911.ap-shanghai.app.tcloudbase.com`。

示例：

```bash
SKW=your_app_skw node test/wechatBotNew.test.js
```

## 测试前：定时消息重复过滤说明

定时类请求（个人定时、群定时）会检查「今日是否已推送」：若 `robotMessages` 里已有**今日**、**同一 targetId**、**同一 messageType**、**triggerType='scheduled'** 的记录，则不再发送。

若需要**重复触发**定时类测试（同一天内多次跑脚本且期望再次收到定时内容），测试前需在云开发控制台删除以下数据。

### 1. 个人定时（仅 skw，无 gid、无 content）

删除 **robotMessages** 中同时满足的文档：

- `type` = `'friend'`
- `targetId` = `'wxid_fn8hiqd4hutg21'`（测试用个人 ID）
- `triggerType` = `'scheduled'`
- `createdAt` ≥ **今日 0 点（东八区）**

即：该用户今日所有「定时推送」记录（早上/午餐/晚上/每日总结、打卡评价等，只要 triggerType 为 scheduled 的都会参与过滤）。

### 2. 群定时（有 gid，无 content）

删除 **robotMessages** 中同时满足的文档：

- `type` = `'group'`
- `targetId` = `'823184'`（测试用群 ID）
- `triggerType` = `'scheduled'`
- `createdAt` ≥ **今日 0 点（东八区）**

即：该群今日所有「定时推送」记录。

### 3. 可选：只允许某一种定时再次发送

若只想让某一种类型（如「早上激励」）再次发送，可只删对应 `messageType` 的文档，例如：

- 个人：`type='friend'`、`targetId='wxid_fn8hiqd4hutg21'`、`messageType='morning'`、`triggerType='scheduled'`、`createdAt` ≥ 今日 0 点。
- 群：`type='group'`、`targetId='823184'`、`messageType='daily_report'`（或其它类型）、`triggerType='scheduled'`、`createdAt` ≥ 今日 0 点。

**关键词类**（个人关键词、群关键词）不受上述「今日已推送」限制，可重复调用，无需删数据。

### 在云开发控制台删除

1. 打开 [云开发控制台](https://console.cloud.tencent.com/tcb) → 对应环境 → 数据库 → 集合 **robotMessages**。
2. 使用「高级查询」或「条件筛选」：
   - 个人定时：`type` 等于 `friend`，`targetId` 等于 `wxid_fn8hiqd4hutg21`，`triggerType` 等于 `scheduled`，`createdAt` 大于等于今日 0 点（东八区）。
   - 群定时：`type` 等于 `group`，`targetId` 等于 `823184`，`triggerType` 等于 `scheduled`，`createdAt` 大于等于今日 0 点。
3. 勾选命中记录后删除，或导出备份后再删。

## 测试用例说明

| 用例       | 说明                     | 请求方式 |
|------------|--------------------------|----------|
| 个人定时   | 仅 skw，无 gid、无 content | POST     |
| 群定时     | gid + skw，无 content   | POST     |
| 个人关键词 | skw + mid/wxuin + content（如「关键词」「激励」「今日总结」） | POST |
| 群关键词   | gid + skw + content（如「绑定：PK_ID」） | POST     |

脚本会依次调用上述四类，并打印请求体与响应体。

---

## 怎么测试定时提醒的效果

定时提醒是**机器人平台定时来查**云函数时才发的：平台在约定时段（如每 2 分钟）请求一次，云函数根据**当前东八区时间**决定这次要不要发、发哪种类型。

### 云函数里的时段规则（东八区）

| 时段（东八区） | 个人定时 | 群定时 |
|----------------|----------|--------|
| 7:00–8:59      | 早上激励 morning | 早上激励 morning |
| 11:00–12:59    | 午餐提醒 lunch   | 午餐提醒 lunch   |
| 19:00–20:59    | 晚上提醒 evening | 晚上提醒 evening |
| 21:00–22:59    | 每日总结 daily_summary | 每日战报 daily_report |
| 其他时段       | 不落上述类型时可能返回空，或先处理「打卡评价」 | 同上 |

只有在对应时段内请求，且该用户/群**今日尚未发过该类型**（见下方「测试前删除数据」），云函数才会返回该类型的文案。

### 推荐测试方式

**方式一：在对应时段跑脚本（最贴近真实）**

1. 看当前东八区时间属于哪一段（如 7:30 属于早上、12:00 属于午餐）。
2. 测试前按上文「测试前：定时消息重复过滤说明」删除该用户/群今日的 `robotMessages`（`triggerType='scheduled'`）记录，否则会因「今日已推送」直接返回空。
3. 在该时段内执行：  
   `SKW=你的skw node test/wechatBotNew.test.js`
4. 看「个人定时」「群定时」的响应里的 `tip`：应包含【早上好】/【午餐提醒】/【晚上提醒】/【今日总结】或【今日战报】等对应文案；若返回空，多半是已发过或不在时段内。

脚本开头会打印**当前东八区小时**和**预期会触发的定时类型**，便于对照。

**方式二：不挑时段，先验证「会发哪种」**

- 任意时间运行脚本，看打印的「当前东八区小时」和「预期定时类型」。
- 若当前不在 7–9 / 11–13 / 19–21 / 21–23，定时接口可能返回空或只处理打卡评价，这是预期行为。
- 想直接看某类文案时，可用**关键词**代替定时（不受时段限制）：
  - **个人**：发「激励」→ 早上激励文案；发「今日总结」→ 今日总结文案（需今日有打卡）。
  - 再在**对应时段**按方式一测一次定时，确认定时和关键词都能出对应内容即可。

**方式三：机器人平台真实轮询**

- 在机器人侧配置好「定时/轮询」调用本云函数（个人：仅传 `skw`；群：传 `gid` + `skw`），在 7–9、11–13、19–21、21–23 各测一段时间。
- 看用户/群是否在对应时段收到一条【早上好】/【午餐提醒】/【晚上提醒】/【今日总结】或【今日战报】。
- 若收不到，检查：平台是否在该时段有请求、请求参数是否带对 `skw`（及群的 `gid`）、该用户/群今日是否已发过该类型（需删 robotMessages 后再测）。

### 小结

- **定时提醒效果** = 在对应东八区时段内请求 + 今日该类型未发过 → 云函数返回该类型文案。
- 测试前删掉今日该用户/群的 `robotMessages`（`triggerType='scheduled'`），再在该时段跑脚本或让平台轮询，即可验证定时提醒效果。
