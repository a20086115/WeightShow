# AI

提供云开发 AI 接入能力，快速接入大模型和 Agent。

## 初始化

使用 node sdk 进行初始化后，通过 `.ai()` 获取 [AI](#ai-1) 实例。

```js
import tcb from '@cloudbase/node-sdk'
const app = tcb.init({ env: 'xxx' })
const ai = app.ai()
```

## AI

用于创建 AI 模型的类。

### createModel()

创建指定的 AI 文生文模型。

#### 使用示例

```ts
const model = ai.createModel("hunyuan-exp");
```

#### 类型声明

```ts
function createModel(model: string): ChatModel;
```

返回一个实现了 [ChatModel](#chatmodel) 抽象类的模型实例，该实例提供 AI 生成文本相关能力。

### createImageModel()

创建指定的图片生成模型。

#### 使用示例

```ts
const imageModel = ai.createImageModel("hunyuan-image");
```

#### 类型声明

```ts
function createImageModel(provider: string): ImageModel;
```

#### 参数

| 参数名   | 必填 | 类型   | 说明                                         |
| -------- | ---- | ------ | -------------------------------------------- |
| provider | 是   | string | 模型提供方名称，如 `"hunyuan-image"` |

#### 返回值

返回一个 [ImageModel](#imagemodel) 实例，该实例提供 AI 图片生成相关能力。

### registerFunctionTool()

注册函数工具。在进行大模型调用时，可以告知大模型可用的函数工具，当大模型的响应被解析为工具调用时，会自动调用对应的函数工具。

#### 使用示例

```js
// 省略初始化 AI sdk 的操作...

// 1. 定义获取天气的工具，详见 FunctionTool 类型
const getWeatherTool = {
  name: "get_weather",
  description: "返回某个城市的天气信息。调用示例：get_weather({city: '北京'})",
  fn: ({ city }) => `${city}的天气是：秋高气爽！！！`, // 在这定义工具执行的内容
  parameters: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "要查询的城市",
      },
    },
    required: ["city"],
  },
};

// 2. 注册我们刚定义好的工具
ai.registerFunctionTool(getWeatherTool);

// 3. 在给大模型发送消息的同时，告知大模型可用一个获取天气的工具
const model = ai.createModel("hunyuan-exp");
const result = await model.generateText({
  model: "hunyuan-turbos-latest",
  tools: [getWeatherTool], // 这里我们传入了获取天气工具
  messages: [
    {
      role: "user",
      content: "请告诉我北京的天气状况",
    },
  ],
});

console.log(result.text);
```

#### 类型声明

```ts
function registerFunctionTool(functionTool: FunctionTool);
```

#### 参数

| 参数名       | 必填 | 类型         | 说明                               |
| ------------ | ---- | ------------ | ---------------------------------- |
| functionTool | 是   | FunctionTool | 详见 [FunctionTool](#functiontool) |

#### 返回值

`undefined`

## ChatModel

这个抽象类描述了 AI 生文模型类提供的接口。

### generateText()

调用大模型生成文本。

#### 使用示例

```ts
const hy = ai.createModel("hunyuan-exp"); // 创建模型
const res = await hy.generateText({
  model: "hunyuan-turbos-latest",
  messages: [{ role: "user", content: "你好，请你介绍一下李白" }],
});
console.log(res.text); // 打印生成的文本
```

#### 类型声明

```ts
function generateText(data: BaseChatModelInput): Promise<{
  rawResponses: Array<unknown>;
  text: string;
  messages: Array<ChatModelMessage>;
  usage: Usage;
  error?: unknown;
}>;
```

#### 参数

| 参数名 | 必填 | 类型               | 示例                                                                                       | 说明                                                                                                                                                                                                                                                                                     |
| ------ | ---- | ------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| data   | 是   | BaseChatModelInput | `{model: "hunyuan-turbos-latest", messages: [{ role: "user", content: "你好，请你介绍一下李白" }]}` | 参数类型定义为 [BaseChatModelInput](#basechatmodelinput) ，作为基础的入参定义。实际上各家大模型还会有各自独特的输入参数，开发者可按需根据实际使用的大模型官方文档传入其他不在此类型中被定义的参数，充分利用大模型提供的能力。其他参数会被透传至大模型接口， SDK 侧不对它们不做额外处理。 |

#### 返回值

| 属性名       | 类型               | 示例                                                                                                                                                                                                   | 说明                                                                                                         |
| ------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| text         | string             | `"李白是一位唐朝诗人。"`                                                                                                                                                                               | 大模型生成的文本。                                                                                           |
| rawResponses | unknown[]          | `[{"choices": [{"finish_reason": "stop","message": {"role": "assistant", "content": "你好呀，有什么我可以帮忙的吗？"}}], "usage": {"prompt_tokens": 14, "completion_tokens": 9, "total_tokens": 23}}]` | 大模型的完整返回值，包含更多详细数据，如消息创建时间等等。由于各家大模型返回值互有出入，请根据实际情况使用。 |
| res.messages | ChatModelMessage[] | `[{role: 'user', content: '你好'},{role: 'assistant', content: '你好！很高兴与你交流。请问有什么我可以帮助你的吗？无论是关于生活、工作、学习还是其他方面的问题，我都会尽力为你提供帮助。'}]`           | 本次调用的完整消息列表。                                                                                     |
| usage        | Usage              | `{"completion_tokens":33,"prompt_tokens":3,"total_tokens":36}`                                                                                                                                         | 本次调用消耗的 token。                                                                                       |
| error        | unknown            |                                                                                                                                                                                                        | 调用过程中产生的错误。                                                                                       |

### streamText()

以流式调用大模型生成文本。流式调用时，生成的文本及其他响应数据会通过 SSE 返回，该接口的返回值对 SSE 做了不同程度的封装，开发者能根据实际需求获取到文本流和完整数据流。

#### 使用示例

```ts
const hy = ai.createModel("hunyuan-exp"); // 创建模型
const res = await hy.streamText({
  model: "hunyuan-turbos-latest",
  messages: [{ role: "user", content: "你好，请你介绍一下李白" }],
});

for await (let str of res.textStream) {
  console.log(str); // 打印生成的文本
}
for await (let data of res.dataStream) {
  console.log(data); // 打印每次返回的完整数据
}
```

#### 类型声明

```ts
function streamText(data: BaseChatModelInput): Promise<StreamTextResult>;
```

#### 参数

| 参数名 | 必填 | 类型               | 示例                                                                                       | 说明                                                                                                                                                                                                                                                                                     |
| ------ | ---- | ------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| data   | 是   | BaseChatModelInput | `{model: "hunyuan-turbos-latest", messages: [{ role: "user", content: "你好，请你介绍一下李白" }]}` | 参数类型定义为 [BaseChatModelInput](#basechatmodelinput) ，作为基础的入参定义。实际上各家大模型还会有各自独特的输入参数，开发者可按需根据实际使用的大模型官方文档传入其他不在此类型中被定义的参数，充分利用大模型提供的能力。其他参数会被透传至大模型接口， SDK 侧不对它们不做额外处理。 |

#### 返回值

| StreamTextResult 属性名 | 类型                          | 说明                                                                                                                   |
| ----------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| textStream              | `ReadableStream<string>`      | 以流式返回的大模型生成文本，可参考使用示例获取到生成的增量文本。                                                       |
| dataStream              | `ReadableStream<DataChunk>`   | 以流式返回的大模型响应数据，可参考使用示例获取到生成的增量数据。由于各家大模型响应值互有出入，请根据实际情况合理使用。 |
| messages                | `Promise<ChatModelMessage[]>` | 本次调用的完整消息列表。                                                                                               |
| usage                   | `Promise<Usage>`              | 本次调用消耗的 token。                                                                                                 |
| error                   | `unknown`                     | 本次调用产生的错误。                                                                                                   |

| DataChunk 属性名         | 类型               | 说明                   |
| ------------------------ | ------------------ | ---------------------- |
| choices                  | `Array<object>`    |                        |
| choices[n].finish_reason | `string`           | 模型终止推断的原因。   |
| choices[n].delta         | `ChatModelMessage` | 本次请求的消息。       |
| usage                    | `Usage`            | 本次请求消耗的 token。 |
| rawResponse              | `unknown`          | 大模型返回的原始回复。 |

#### 示例

```js
const hy = ai.createModel("hunyuan-exp");
const res = await hy.streamText({
  model: "hunyuan-turbos-latest",
  messages: [{ role: "user", content: "1+1结果是" }],
});

// 文本流
for await (let str of res.textStream) {
  console.log(str);
}
// 1
// 加
// 1
// 的结果
// 是
// 2
// 。

// 数据流
for await (let str of res.dataStream) {
  console.log(str);
}

// {created: 1723013866, id: "a95a54b5c5d2144eb700e60d0dfa5c98", model: "hunyuan-turbos-latest", version: "202404011000", choices: Array(1), …}
// {created: 1723013866, id: "a95a54b5c5d2144eb700e60d0dfa5c98", model: "hunyuan-turbos-latest", version: "202404011000", choices: Array(1), …}
// {created: 1723013866, id: "a95a54b5c5d2144eb700e60d0dfa5c98", model: "hunyuan-turbos-latest", version: "202404011000", choices: Array(1), …}
// {created: 1723013866, id: "a95a54b5c5d2144eb700e60d0dfa5c98", model: "hunyuan-turbos-latest", version: "202404011000", choices: Array(1), …}
// {created: 1723013866, id: "a95a54b5c5d2144eb700e60d0dfa5c98", model: "hunyuan-turbos-latest", version: "202404011000", choices: Array(1), …}
// {created: 1723013866, id: "a95a54b5c5d2144eb700e60d0dfa5c98", model: "hunyuan-turbos-latest", version: "202404011000", choices: Array(1), …}
// {created: 1723013866, id: "a95a54b5c5d2144eb700e60d0dfa5c98", model: "hunyuan-turbos-latest", version: "202404011000", choices: Array(1), …}
// {created: 1723013866, id: "a95a54b5c5d2144eb700e60d0dfa5c98", model: "hunyuan-turbos-latest", version: "202404011000", choices: Array(1), …}
```

## ImageModel

这个类描述了 AI 图片生成模型类提供的接口。

### generateImage()

调用大模型生成图片。

#### 使用示例

```ts
const imageModel = ai.createImageModel("hunyuan-image");
const res = await imageModel.generateImage({
  model: "hunyuan-image-v3.0-v1.0.4",
  prompt: "一只可爱的猫咪在草地上玩耍",
});
console.log(res.data[0].url); // 打印生成的图片 URL
```

#### 类型声明

```ts
function generateImage(input: HunyuanARGenerateImageInput): Promise<HunyuanARGenerateImageOutput>;
function generateImage(input: HunyuanGenerateImageInput): Promise<HunyuanGenerateImageOutput>;
```

#### 参数

| 参数名 | 必填 | 类型                     | 说明                                                           |
| ------ | ---- | ------------------------ | -------------------------------------------------------------- |
| input  | 是   | HunyuanARGenerateImageInput \| HunyuanGenerateImageInput | 图片生成参数，详见 [HunyuanARGenerateImageInput](#hunyuanargenerateimageinput) 或 [HunyuanGenerateImageInput](#hunyuangenerateimageinput) |

#### 返回值

`Promise<HunyuanARGenerateImageOutput>` 或 `Promise<HunyuanGenerateImageOutput>`

| 属性名          | 类型           | 说明                                   |
| --------------- | -------------- | -------------------------------------- |
| id              | string         | 此次请求的 id                          |
| created         | number         | unix 时间戳                            |
| data            | Array\<object\> | 返回的图片生成内容                     |
| data[n].url     | string         | 生成的图片 url，有效期为 24 小时       |
| data[n].revised_prompt | string  | 原 prompt 改写后的文本（若 revise 为 false，则为原 prompt） |

## 类型定义

### BaseChatModelInput

```ts
interface BaseChatModelInput {
  model: string;
  messages: Array<ChatModelMessage>;
  temperature?: number;
  topP?: number;
  tools?: Array<FunctionTool>;
  toolChoice?: "none" | "auto" | "custom";
  maxSteps?: number;
  onStepFinish?: (prop: IOnStepFinish) => unknown;
}
```

| BaseChatModelInput 属性名 | 类型                               | 说明                                                |
| ------------------------- | ---------------------------------- | --------------------------------------------------- |
| model                     | `string`                           | 模型名称。                                          |
| messages                  | `Array<ChatModelMessage>`          | 消息列表。                                          |
| temperature               | `number`                           | 采样温度，控制输出的随机性。                        |
| topP                      | `number`                           | 温度采样，即模型考虑概率质量为 top_p 的标记的结果。 |
| tools                     | `Array<FunctionTool>`              | 大模型可用的工具列表。                              |
| toolChoice                | `string`                           | 指定大模型选择工具的方式。                          |
| maxSteps                  | `number`                           | 请求大模型的最大次数。                              |
| onStepFinish              | `(prop: IOnStepFinish) => unknown` | 当对大模型的一次请求完成时，出发的回调函数。        |

### ChatModelMessage

```ts
type ChatModelMessage =
  | UserMessage
  | SystemMessage
  | AssistantMessage
  | ToolMessage;
```

#### UserMessage

```ts
type UserMessage = {
  role: "user";
  content: string;
};
```

#### SystemMessage

```ts
type SystemMessage = {
  role: "system";
  content: string;
};
```

#### AssistantMessage

```ts
type AssistantMessage = {
  role: "assistant";
  content?: string;
  tool_calls?: Array<ToolCall>;
};
```

#### ToolMessage

```ts
type ToolMessage = {
  role: "tool";
  tool_call_id: string;
  content: string;
};
```

### ToolCall

```ts
export type ToolCall = {
  id: string;
  type: string;
  function: { name: string; arguments: string };
};
```

### FunctionTool

工具定义类型。

```ts
type FunctionTool = {
  name: string;
  description: string;
  fn: CallableFunction;
  parameters: object;
};
```

| FunctionTool 属性名 | 类型               | 说明                                                                                               |
| ------------------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| name                | `string`           | 工具名称。                                                                                         |
| description         | `string`           | 工具的描述。清楚的工具描述有助于大模型认识工具的用途。                                             |
| fn                  | `CallableFunction` | 工具的执行函数。当 AI SDK 解析出大模型的响应需要该工具调用时，会调用此函数，并将结果返回给大模型。 |
| parameters          | `object`           | 工具执行函数的入参。需要使用 JSON Schema 的格式定义入参。                                          |

### IOnStepFinish

大模型响应后出发的回调函数的入参类型。

```ts
interface IOnStepFinish {
  messages: Array<ChatModelMessage>;
  text?: string;
  toolCall?: ToolCall;
  toolResult?: unknown;
  finishReason?: string;
  stepUsage?: Usage;
  totalUsage?: Usage;
}
```

| IOnStepFinish 属性名 | 类型                      | 说明                             |
| -------------------- | ------------------------- | -------------------------------- |
| messages             | `Array<ChatModelMessage>` | 到当前步骤为止所有的消息列表。   |
| text                 | `string`                  | 当前响应的文本。                 |
| toolCall             | `ToolCall`                | 当前响应调用的工具。             |
| toolResult           | `unknown`                 | 对应的工具调用结果。             |
| finishReason         | `string`                  | 大模型推理结束的原因。           |
| stepUsage            | `Usage`                   | 当前步骤所花费的 token。         |
| totalUsage           | `Usage`                   | 到当前步骤为止所花费的总 token。 |

### Usage

```ts
type Usage = {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
};
```

### HunyuanGenerateImageInput

混元图片生成输入参数。

```ts
interface HunyuanGenerateImageInput { 
  model: 'hunyuan-image';
  /** 用来生成图像的文本描述 */
  prompt: string;
  /** 模型版本，支持 v1.8.1 和 v1.9，默认版本 v1.8.1 */
  version?: 'v1.8.1' | 'v1.9' | (string & {});
  /** 图片尺寸，默认 "1024x1024" */
  size?: string;
  /** 仅 v1.9 支持，负向词 */
  negative_prompt?: string;
  /** 仅 v1.9 支持，可指定风格 */
  style?: '古风二次元风格' | '都市二次元风格' | '悬疑风格' | '校园风格' | '都市异能风格' | (string & {});
  /** 为 true 时对 prompt 进行改写，默认为 true */
  revise?: boolean;
  /** 生成图片个数，默认为 1 */
  n?: number;
  /** 业务自定义水印内容，限制 16 个字符长度 */
  footnote?: string;
  /** 生成种子，范围 [1, 4294967295] */
  seed?: number;
}
```

| HunyuanGenerateImageInput 属性名 | 类型      | 说明                                                                                           |
| -------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| model                            | `string`  | 模型名称，固定为 `hunyuan-image`                                                               |
| prompt                           | `string`  | 用来生成图像的文本描述                                                                         |
| version                          | `string`  | 模型版本，支持 `v1.8.1` 和 `v1.9`，默认版本 `v1.8.1`                                           |
| size                             | `string`  | 图片尺寸，默认 `"1024x1024"`                                                                   |
| negative_prompt                  | `string`  | 仅 v1.9 支持，负向词                                                                           |
| style                            | `string`  | 仅 v1.9 支持，可指定风格：古风二次元风格、都市二次元风格、悬疑风格、校园风格、都市异能风格     |
| revise                           | `boolean` | 为 true 时对 prompt 进行改写，默认为 true                                                      |
| n                                | `number`  | 生成图片个数，默认为 1                                                                         |
| footnote                         | `string`  | 业务自定义水印内容，限制 16 个字符长度                                                         |
| seed                             | `number`  | 生成种子，范围 [1, 4294967295]                                                                 |

### HunyuanGenerateImageOutput

混元图片生成输出。

```ts
interface HunyuanGenerateImageOutput {
  /** 此次请求的 id */
  id: string;
  /** unix 时间戳 */
  created: number;
  /** 返回的图片生成内容 */
  data: Array<{
    /** 生成的图片 url，有效期为 24 小时 */
    url: string;
    /** 原 prompt 改写后的文本。若 revise 为 false，则为原 prompt */
    revised_prompt?: string;
  }>;
}
```

| HunyuanGenerateImageOutput 属性名 | 类型            | 说明                                                              |
| --------------------------------- | --------------- | ----------------------------------------------------------------- |
| id                                | `string`        | 此次请求的 id                                                     |
| created                           | `number`        | unix 时间戳                                                       |
| data                              | `Array<object>` | 返回的图片生成内容                                                |
| data[n].url                       | `string`        | 生成的图片 url，有效期为 24 小时                                  |
| data[n].revised_prompt            | `string`        | 原 prompt 改写后的文本。若 revise 为 false，则为原 prompt         |

### HunyuanARGenerateImageInput

混元图片生成 v3.0 输入参数，支持自定义宽高比。

```ts
interface HunyuanARGenerateImageInput {
  /** 模型名称：hunyuan-image-v3.0-v1.0.4（推荐）或 hunyuan-image-v3.0-v1.0.1 */
  model: 'hunyuan-image-v3.0-v1.0.4' | 'hunyuan-image-v3.0-v1.0.1';
  /** 生成图片使用的文本，不超过 8192 字符 */
  prompt: string;
  /**
   * 图片尺寸，格式 "${宽}x${高}"，默认 "1024x1024"
   * hunyuan-image-v3.0-v1.0.4：宽高范围 [512, 2048]，面积不超过 1024x1024
   * hunyuan-image-v3.0-v1.0.1：支持固定尺寸列表
   */
  size?: string;
  /** 生成种子，仅当生成图片数为 1 时生效，范围 [1, 4294967295] */
  seed?: number;
  /** 业务自定义水印内容，限制 16 字符，生成在图片右下角 */
  footnote?: string;
  /** 是否对 prompt 改写，默认开启。改写会增加约 30s 耗时 */
  revise?: { value: boolean };
  /** 改写是否开启 thinking 模式，默认开启。开启后效果提升但耗时增加（最大 60s） */
  enable_thinking?: { value: boolean };
}
```

| HunyuanARGenerateImageInput 属性名 | 类型              | 说明                                                                                           |
| ---------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| model                              | `string`          | 模型名称，`hunyuan-image-v3.0-v1.0.4`（推荐）或 `hunyuan-image-v3.0-v1.0.1`                    |
| prompt                             | `string`          | 生成图片使用的文本，不超过 8192 字符                                                           |
| size                               | `string`          | 图片尺寸，格式 `"宽x高"`，默认 `"1024x1024"`，宽高范围 [512, 2048]，面积不超过 1024x1024       |
| seed                               | `number`          | 生成种子，仅当生成图片数为 1 时生效，范围 [1, 4294967295]                                      |
| footnote                           | `string`          | 业务自定义水印内容，限制 16 字符，生成在图片右下角                                             |
| revise                             | `{ value: boolean }` | 是否对 prompt 改写，默认开启。改写会增加约 30s 耗时                                         |
| enable_thinking                    | `{ value: boolean }` | 改写是否开启 thinking 模式，默认开启。开启后效果提升但耗时增加（最大 60s）                  |

### HunyuanARGenerateImageOutput

混元图片生成 v3.0 输出。

```ts
interface HunyuanARGenerateImageOutput {
  /** 此次请求的 id */
  id: string;
  /** unix 时间戳 */
  created: number;
  /** 返回的图片生成内容 */
  data: Array<{
    /** 生成的图片 url，有效期为 24 小时 */
    url: string;
    /** 改写后的 prompt */
    revised_prompt?: string;
  }>;
}
```

| HunyuanARGenerateImageOutput 属性名 | 类型            | 说明                                                              |
| ----------------------------------- | --------------- | ----------------------------------------------------------------- |
| id                                  | `string`        | 此次请求的 id                                                     |
| created                             | `number`        | unix 时间戳                                                       |
| data                                | `Array<object>` | 返回的图片生成内容                                                |
| data[n].url                         | `string`        | 生成的图片 url，有效期为 24 小时                                  |
| data[n].revised_prompt              | `string`        | 改写后的 prompt                                                   |


---
source: https://docs.cloudbase.net/api-reference/server/node-sdk/ai