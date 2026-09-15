import Groq from 'groq-sdk';

import { AIMessageWrapper, AIModelWrapper, AIResponseWrapper, ExtractReasoningContent, JSONStructure, ToolCallWrapper } from './types.js';
import { ChatCompletion, ChatCompletionMessageParam, ChatCompletionMessageToolCall } from 'groq-sdk/resources/chat/completions';
import { dumpDebugJSON } from '../util/dumpDebugJSON.js';
import { GetFetch } from './proxy.js';

// US100-AC5 Groq provides two interchangeable API keys; each request is routed to one of them
// (about 50/50 when the second key is configured) to spread the daily quota.

export const GroqAPI = new Groq({
  apiKey: process.env.GROQ_API_KEY, // This is the default and can be omitted
  timeout: 32 * 60 * 1000,
  ...(GetFetch() ? { fetch: GetFetch() } : {})
});

export const GroqAPI2 = new Groq({
  apiKey: process.env.GROQ_API_KEY2, // This is the default and can be omitted
  timeout: 32 * 60 * 1000,
  ...(GetFetch() ? { fetch: GetFetch() } : {})
});

function getGroqClient() {
  if (process.env.GROQ_API_KEY2 && Math.random() < 0.5)
    return GroqAPI2;
  return GroqAPI;
}


export class GroqWrapperClass implements AIModelWrapper {
  model = "openai/gpt-oss-20b";

  public constructor(model: string = "openai/gpt-oss-20b") {
    this.model = model;
  }

  public GetProvider() {
    return "groq";
  }

  public GetModel() {
    return this.model;
  }

  public GetSleep() {
    return 49000;
  }

  public message(role: string, content: string, name: string | undefined = undefined, tool_call_id: string | undefined = undefined) {
    let msg = new GroqMessageWrapper();
    msg.role = role;
    msg.content = content;
    if (name)
      msg.name = name;
    if (tool_call_id)
      msg.tool_call_id = tool_call_id;
    return msg;
  }

  public messageToNative(message: AIMessageWrapper): ChatCompletionMessageParam {
    let msg = { role: message.role as any, content: message.content } as any;
    if ((message as any).tool_calls) msg.tool_calls = (message as any).tool_calls;
    //if ((message as any).tool_call_id) msg.tool_call_id = (message as any).tool_call_id;
    // It appears Groq requires any value in the field when it sees tool calls from other providers
    if ((message as any).tool_call_id)
      msg.tool_call_id = (message as any).tool_call_id;
    // console.log(message);
    return msg;
  }

  public wrapMessage(message: ChatCompletionMessageParam) {
    let msg = new GroqMessageWrapper();
    Object.assign(msg, message);
    msg.role = message.role;
    msg.content = message.content as string || "";
    if ((message as any).tool_calls)
      (msg as any).tool_calls = (message as any).tool_calls;
    return msg;
  }

  public async prompt(messages: AIMessageWrapper[], response_format?: JSONStructure, tools?: any[]): Promise<AIResponseWrapper> {
    try {
      const chatCompletion = await getGroqClient().chat.completions.create(
        {
          messages: messages.map((x) => this.messageToNative(x)),
          model: this.GetModel(),
          response_format: response_format as any,
          tools: tools
        },
      );

      return new GroqResponseWrapper(chatCompletion);
    }
    catch (e) {
      dumpDebugJSON([this.GetProvider(), this.GetModel(), e, {
        messages: messages.map((x) => this.messageToNative(x)),
        model: this.GetModel(),
        response_format: response_format as any,
        tools: tools
      }]);
      throw (e);
    }
  }
}

export class GroqMessageWrapper implements AIMessageWrapper {
  role!: string;
  content!: string;
  name: string | undefined;
  tool_call_id?: string | undefined;
  tool_calls?: JSONStructure[] | undefined;
}

export class GroqResponseWrapper implements AIResponseWrapper {
  response: ChatCompletion;

  constructor(response: ChatCompletion) {
    this.response = response;
  }

  public getContent(): string {
    if (!this.response || !this.response.choices || !this.response.choices[0].message.content)
      return "";
    return this.response.choices[0].message.content || "";
  }
  public getReasoningContent(): string {
    return ExtractReasoningContent(this.response.choices?.[0]?.message);
  }
  public getToolCalls(): ToolCallWrapper[] {
    if (!this.response.choices[0].message.tool_calls)
      return [];

    return this.response.choices[0].message.tool_calls.map((x) => new GroqToolWrapper(x));
  }

  public getMessage(): AIMessageWrapper {
    return GroqWrapper.wrapMessage(this.response.choices[0].message);
  }

  public getCompletionTokens(): number {
    return this.response.usage?.completion_tokens || Math.ceil(this.getContent().length / 4);
  }

  public getFinishReason(): string {
    return this.response.choices?.[0]?.finish_reason || "";
  }
}

export class GroqToolWrapper implements ToolCallWrapper {
  call: ChatCompletionMessageToolCall;

  constructor(call: ChatCompletionMessageToolCall) {
    this.call = call;
  }
  public getName(): string {
    return this.call.function.name;
  }
  public getArguments(): JSONStructure {
    return JSON.parse(this.call.function.arguments);
  }
  public getArgumentsRaw(): string {
    return this.call.function.arguments;
  }
  public getToolCallId() {
    return this.call.id;
  }
  public setToolCallId(id: string): void {
    this.call.id = id;
  }
}

export const GroqWrapper = new GroqWrapperClass();
export const GroqBigWrapper = new GroqWrapperClass("openai/gpt-oss-120b");
export const GroqQwenWrapper = new GroqWrapperClass("qwen/qwen3.6-27b");