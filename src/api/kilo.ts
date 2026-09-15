import OpenAI from "openai";
import { AIMessageWrapper, AIModelWrapper, AIResponseWrapper, ExtractReasoningContent, JSONStructure, ToolCallWrapper } from "./types.js";
import { dumpDebugJSON } from "../util/dumpDebugJSON.js";
import { GetFetch } from "./proxy.js";


//US100 Kilo is one of the available APIs.
export const KiloClient = new OpenAI({
    baseURL: "https://api.kilo.ai/api/gateway",
    timeout: 5 * 60 * 1000,
    apiKey: process.env.Kilo_API_KEY,
    ...(GetFetch() ? { fetch: GetFetch() } : {})
});

export class KiloWrapperClass implements AIModelWrapper {

    model: string;
    public constructor(model: string) {
        this.model = model;
    }
    public GetProvider() {
        return "Kilo";
    }

    public GetModel() {
        return this.model;
    }

    public GetSleep() {
        return 99000;
    }

    public message(role: string, content: string, name: string | undefined = undefined, tool_call_id: string | undefined = undefined) {
        let msg = new KiloMessageWrapper();
        msg.role = role;
        msg.content = content;
        if (name)
            msg.name = name;
        if (tool_call_id)
            msg.tool_call_id = tool_call_id;
        return msg;
    }

    public wrapMessage(message: OpenAI.Chat.Completions.ChatCompletionMessageParam) {
        let msg = new KiloMessageWrapper();
        Object.assign(msg, message);
        msg.role = message.role;
        msg.content = message.content as string;
        if ((message as any).tool_calls) (msg as any).tool_calls = (message as any).tool_calls;
        return msg;
    }

    public messageToNative(message: AIMessageWrapper): OpenAI.Chat.Completions.ChatCompletionMessageParam {
        let msg = { name: message.name || undefined, role: message.role as any, content: message.content } as any;
        if ((message as any).tool_calls) msg.tool_calls = (message as any).tool_calls;
        if ((message as any).tool_call_id) msg.tool_call_id = (message as any).tool_call_id;
        return msg;
    }

    public async prompt(messages: AIMessageWrapper[], response_format?: JSONStructure, tools?: any[]): Promise<AIResponseWrapper> {
        try {
            const chatCompletion = await KiloClient.chat.completions.create(
                {
                    messages: messages.map((x) => this.messageToNative(x)),
                    model: this.GetModel(),
                    response_format: response_format as any,
                    tools: tools
                },
            );

            return new KiloResponseWrapper(chatCompletion);
        }
        catch (e) {
            dumpDebugJSON([this.GetProvider(), this.GetModel(), e, {
                messages: messages.map((x) => this.messageToNative(x)),
                model: this.model,
                response_format: response_format as any,
                tools: tools
            }]);
            throw e;
        }
    }
}

export class KiloMessageWrapper implements AIMessageWrapper {
    role!: string;
    content!: string;
    name?: string;
    tool_call_id?: string | undefined;
    tool_calls?: JSONStructure[] | undefined;
}

export class KiloResponseWrapper implements AIResponseWrapper {
    response: OpenAI.Chat.Completions.ChatCompletion;

    constructor(response: OpenAI.Chat.Completions.ChatCompletion) {
        this.response = response;
    }
    getCompletionTokens(): number {
        return this.response.usage?.completion_tokens || Math.ceil(this.getContent().length / 4);
    }

    public getFinishReason(): string {
        return this.response.choices?.[0]?.finish_reason || "";
    }

    public getContent(): string {
        if (!this.response || !this.response.choices || !this.response.choices.length || !this.response.choices[0].message)
            return "";
        return this.response.choices[0].message.content || "";
    }
    public getReasoningContent(): string {
        return ExtractReasoningContent(this.response?.choices?.[0]?.message);
    }
    public getToolCalls(): ToolCallWrapper[] {
        if (!this.response || !this.response.choices || !this.response.choices.length || !this.response.choices[0].message.tool_calls)
            return [];

        return this.response.choices[0].message.tool_calls.map((x) => new KiloToolWrapper(x as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall));
    }

    public getMessage(): KiloMessageWrapper {
        const msg = this.getMessageRaw();
        return msg as KiloMessageWrapper;
    }

    public getMessageRaw(): OpenAI.Chat.Completions.ChatCompletionMessageParam {
        return this.response.choices[0].message;
    }
}

export class KiloToolWrapper implements ToolCallWrapper {
    call: OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;

    constructor(call: OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall) {
        this.call = call;
    }
    public getName(): string {
        return this.call.function.name;
    }
    public getArguments(): JSONStructure {
        return JSON.parse(this.call.function.arguments);
    }
    public getArgumentsRaw(): string {
        return JSON.stringify(this.getArguments());
    }
    public getToolCallId() {
        return this.call.id;
    }

    public setToolCallId(id: string): void {
        this.call.id = id;
    }
}