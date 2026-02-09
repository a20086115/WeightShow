# wechatBotNew 云函数执行流程图

## 主函数：仅 4 种情况（函数式分发）

`exports.main` 只做三件事：**解析参数 → 校验 skw → 按 (gid, hasContent) 分 4 类调用对应处理器**。没有其它分支。

```
                     parseParams(event)
                              │
                              ▼
                     skw 缺失？ ──是──► createEmptyMessage()
                              │
                              否
                              ▼
              ┌───────────────┴───────────────┐
              │  gid ?  hasContent ?           │
              │  是      是  → handleGroupKeyword(params)     [群]关键词
              │  是      否  → handleGroupScheduled(params)   [群]定时
              │  否      是  → handleFriendKeyword(params)   [友]关键词
              │  否      否  → handleFriendScheduled(params) [友]定时
              └───────────────────────────────┘
```

| 类型 | 判定条件 | 处理器 | 用途 |
|------|----------|--------|------|
| **[友] 定时消息** | `!gid && !hasContent` | `handleFriendScheduled(params)` | 个人打卡后私聊评价（仅 skw 时轮询库筛选；带 wxuin/mid 时按绑定检查打卡+定时） |
| **[友] 关键词触发** | `!gid && hasContent` | `handleFriendKeyword(params)` | 绑定个人、评价关键词、后续扩展 |
| **[群] 定时消息** | `gid && !hasContent` | `handleGroupScheduled(params)` | 打卡后群内评价 + 群定时提醒/战报 |
| **[群] 关键词触发** | `gid && hasContent` | `handleGroupKeyword(params)` | 绑定 PK 与群、后续扩展 |

**约定**：`hasContent = content && String(content).trim()`；无 `skw` 时直接返回空，不进入 4 类。

## 四类入口与平台消息类型对应

| 平台类型 | 典型入参 | 主函数分支 | 返回格式 |
|----------|----------|------------|----------|
| [友] 定时消息 | `skw`（或 skw+wxuin/mid） | `handleFriendScheduled` | 仅 skw 时 `{rs, wxid, tip, end:1}`；否则 `{rs, tip, end}` |
| [友] 关键词触发 | `mid/wxuin + skw + content` | `handleFriendKeyword` | `{rs, tip, end}` |
| [群] 定时消息 | `gid + skw`，无 content | `handleGroupScheduled` | `{rs, tip, end:1}` |
| [群] 关键词触发 | `gid + skw + content` | `handleGroupKeyword` | `{rs, tip, end}` |

**关键点**：

- “打卡后群里发评价”由 **`handleGroupScheduled` → `checkCheckInTrigger(binding,'group')`** 完成，依赖平台周期带 `gid` 请求。
- “[友] 定时（仅 skw）发给谁”：由 **`handleFriendScheduled` → `handleSkwOnlyRequest(skw)`** 在库中筛选“已打卡且今日未推送”的用户，返回一条 `{wxid, tip}`。

## 主流程概览（4 分支）

```
  exports.main(event)
        │
        ▼
  params = parseParams(event)
  hasContent = content && String(content).trim()
        │
        ├── !skw ──────────────────────────► createEmptyMessage()
        │
        ├── gid && hasContent ────────────► handleGroupKeyword(params)      [群]关键词
        │
        ├── gid && !hasContent ────────────► handleGroupScheduled(params)    [群]定时
        │
        ├── !gid && hasContent ─────────────► handleFriendKeyword(params)    [友]关键词
        │
        └── !gid && !hasContent ───────────► handleFriendScheduled(params) [友]定时
```

## 4 类处理器内部逻辑（概要）

| 处理器 | 内部逻辑 |
|--------|----------|
| **handleFriendScheduled** | 无 targetId → `handleSkwOnlyRequest(skw)`（库筛选已打卡+未推送）；有 targetId → `getBinding` → `checkCheckInTrigger` → `handleScheduledMessage` |
| **handleFriendKeyword** | `绑定：` → `handleBindKeyword`；`评价/今日评价` → `handleEvaluationKeyword`；`激励` → `handleMotivationKeyword`（对应早上 7-9 点激励话术，不占定时次数）；`今日总结` → `handleDailySummaryKeyword`（与定时每日总结一致，不占定时次数）；`关键词`/`【关键词】` → 返回支持的关键词列表；其它 → 空 |
| **handleGroupScheduled** | `getBinding(gid,'group')` → `checkCheckInTrigger` → `handleScheduledMessage` |
| **handleGroupKeyword** | `绑定：` → `handleBindKeyword`；其它 → 空（可扩展） |

## 个人定时（仅 skw 轮询）详解：怎么“知道该推给谁”

个人定时请求里**没有** `wxuin/mid`，所以云函数不是靠“请求参数里带了谁”，而是靠**轮询所有好友绑定**：

1. **查个人绑定**：`robotConfigs` 中 `type='friend' AND status='active'`
2. **只筛有 targetId**：必须有 `targetId`（说明已绑定，能确定私聊发送对象 wxid）
3. **不按「今日已打卡」「今天未推送」预筛**：否则未打卡用户收不到早上/午餐/晚上提醒，且同一天无法收到多种定时（早/午/晚/每日总结）。去重由内部逻辑保证。
4. **对每个绑定逐个尝试**：
   - 先 `checkCheckInTrigger(binding,'friend')`（仅对今日已打卡且未发过评价的用户返回内容）
   - 再 `handleScheduledMessage(binding,'friend')`（按当前时段与开关判断，且按 messageType 查 robotMessages 避免重复）
   - 一旦得到一条内容，就返回 `{"rs":1,"wxid":binding.targetId,"tip":"...","end":1}`（一次只回一条）

## 定时推送 (handleScheduledMessage) 内部逻辑

```
                    ┌─────────────────────────────┐
                    │ binding.config.             │
                    │ scheduledMessages 存在？     │
                    └──────────────┬──────────────┘
                                   │ 否 → return null
                                   ▼ 是
                    ┌─────────────────────────────┐
                    │ 按 currentHour(东八区) 判断    │
                    │ 7-9   → morning             │
                    │ 11-13 → lunch               │
                    │ 19-21 → evening             │
                    │ 21-23 → daily_summary/report│
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │ 查 robotMessages：           │
                    │ type, targetId, messageType,│
                    │ triggerType='scheduled',    │
                    │ createdAt >= 今日 00:00      │
                    │ （关键词触发的记录不统计）     │
                    └──────────────┬──────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │ 已有记录 → return null (今日已推送)        │ 无记录
              ▼                                          ▼
    ┌──────────────────┐                    ┌─────────────────────────────┐
    │ 不重复发          │                    │ generateScheduledMessage    │
    └──────────────────┘                    │ saveMessageRecord           │
                                             │ return createMessage(...)   │
                                             └─────────────────────────────┘
```

**注意**：“今日” 的判定必须按 **东八区日期** 做。若用 `today + 'T00:00:00.000Z'`（UTC 零点），则中国 7–9 点发的记录会落在 UTC 前一天，查询 `createdAt >= 今日 00:00 UTC` 会查不到，导致早上提醒被重复发送。正确做法是使用 `new Date(today + 'T00:00:00+08:00')` 作为「今日」起点。

## 打卡触发 (checkCheckInTrigger) 简要（如何保证“每天一次”）

- **个人**：`checkInTrigger.enabled` 且 `personalCheckIn.enabled`，查今日 `records`，命中则：
  - 生成话术；
  - 写入 `lastCheckInCheck = { date: today, checked: true, lastCheckTime }`；
  - 保存一条 `robotMessages(type='check_in', triggerType='check_in')`；
  - **同一天再次触发时**，若 `lastCheckInCheck.date === today && checked === true`，直接返回 null。

- **群 PK**：`checkInTrigger.enabled` 且 `pkCheckIn.enabled`，查 PK 成员今日 `records`，然后：
  - 只取**今日新打卡 & 尚未评价过的成员**：
    - 当天第一次触发：`lastCheckInCheck.date !== today`，视为当天还没人发过 → `lastChecked = []`；
    - 同一天后续触发：只有 `lastCheckInCheck.date === today` 时才使用 `checkedUsers` 去重。
  - 为这些成员生成话术（可 @）并拼一条群消息；
  - 更新 `lastCheckInCheck = { date: today, checkedUsers: [...当日已评价 openId], lastCheckTime }`；
  - 保存一条 `robotMessages(type='check_in', triggerType='check_in')`。

### 为什么个人打卡后群里没反应？

**群内 PK 打卡评价依赖「机器人平台」按周期对该群发起请求。** 流程是：

1. 用户在小程序里打卡 → 只写入 `records`，不会主动通知机器人。
2. 机器人平台需在「群定时消息」/「群主动消息」里配置本云函数的 HTTP 地址，并**按周期（如每 2 分钟）**对该群发起请求，请求里带上该群的 `gid`。
3. 云函数收到带 `gid` 的请求后，才会执行 `checkCheckInTrigger(binding, 'group')`，查出新打卡成员并返回要发到群里的内容。

若只在「关键词触发」里配置了 URL，则**只有群内有人发消息时**才会请求云函数，个人打卡不会触发任何请求，群内自然不会有评价。

**排查建议：**

1. 在机器人软件里确认是否已为「群定时消息」/「群主动消息」配置本云函数的 URL，并确认该群在轮询列表里。
2. 看云函数日志：若从未出现 `收到群请求，进入打卡/定时检查` 且 `gid=xxx`，说明平台没有按群周期请求；若出现该日志但 `newCheckInsCount` 始终为 0，再结合 `membersCount`、`todayRecordsCount`、`lastCheckedCount`、`newCheckInsOpenIds` 排查成员与打卡数据是否对应。

### 个人定时提醒为什么没发？

**个人定时提醒依赖机器人平台使用「[友/群] 主动消息（任意）」接口，且请求时只传 `skw`（不传 gid/wxuin/mid）。**

- 若平台使用「[友] 定时消息」等接口，且**按好友轮询、每次请求带 wxuin/mid**，则云函数会按「有 targetId」分支处理，个人定时会正常发。
- 若平台使用「[友/群] 主动消息（任意）」做定时：请求参数里只有 `skw`，**不会**带 wxuin/mid。云函数在「仅 skw」分支里会轮询所有好友绑定，对每条先做打卡触发、再做定时推送，返回**第一条**有内容的结果，格式为 `{"rs":1,"wxid":"xxx","tip":"消息内容","end":1}`，平台用 `wxid` 决定发到哪个好友。

**前置条件：**

1. 在机器人软件里为「[友/群] 主动消息（任意）」配置本云函数的 URL，并启用定时/周期请求（如每 2 分钟）。
2. 请求时传参至少包含 `skw`，不要只依赖「按好友单独请求并传 wxuin」——除非你确认平台对每个好友会单独调一次并带 wxuin/mid。

**排查建议：**

1. 看云函数日志：若出现 `仅 skw 请求（个人定时），轮询好友绑定`，说明已走仅 skw 分支；若出现 `仅 skw：命中好友定时，wxid=xxx`，说明已找到要发的好友并返回。
2. 若从无上述日志、且个人定时从未发出，多半是平台未使用「[友/群] 主动消息（任意）」或未对该应用做周期请求。

## 相关集合与角色

- `robotConfigs`：绑定与开关（打卡评价、定时推送等）
  - `targetId`：群为 gid，好友为 mid
  - `type`：'group' 或 'friend'
  - `pkId`：冗余保存 pk._id（type='group' 时）
  - `userId`：冗余保存 users._id（type='friend' 时）
- `robotMessages`：已发消息记录，用于“今日是否已发”判断
- `records`：打卡记录
- `users`：用户信息，`mid` 字段存储微信用户ID（好友绑定）
- `pk`：PK 信息，`gid` 字段直接存储微信群ID（群绑定），不再使用 robotBinding 嵌套结构
