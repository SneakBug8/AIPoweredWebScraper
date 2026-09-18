import OpenAI from "openai";
import { AIMessageWrapper, AIModelWrapper, AIResponseWrapper, ExtractReasoningContent, JSONStructure, ToolCallWrapper } from "./types";
import { dumpDebugJSON } from "../util/dumpDebugJSON";
import * as fs from "fs";
import * as path from "path";

// MIME types for the image formats accepted as OpenAI-compatible image_url parts.
const ImageMimeByExtension: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
};

function mimeTypeForFile(filePath: string): string {
    const mime = ImageMimeByExtension[path.extname(filePath).toLowerCase()];
    if (!mime) throw new Error(`[Unsloth] Unsupported image file for multimodal input: ${filePath}`);
    return mime;
}

const UnslothClient = new OpenAI({
    baseURL: "http://127.0.0.1:8888/v1/",
    apiKey: process.env.unsloth_key, // required but ignored
    timeout: 60 * 60 * 60 * 1000
});

export class UnslothOpenAIWrapperClass implements AIModelWrapper {

    public GetProvider() {
        return "Unsloth";
    }

    public GetModel() {
        return 'gemma-4-12B-it-qat-GGUF';
    }

    public GetSleep() {
        return 0;
    }

    public message(role: string, content: string, name: string | undefined = undefined, tool_call_id: string | undefined = undefined) {
        let msg = new UnslothOpenAIMessageWrapper();
        msg.role = role;
        msg.content = content;
        msg.name = name;
        msg.tool_call_id = tool_call_id;
        return msg;
    }

    public wrapMessage(message: OpenAI.Chat.Completions.ChatCompletionMessageParam) {
        let msg = new UnslothOpenAIMessageWrapper();
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
        const chatCompletion = await UnslothClient.chat.completions.create(
            {
                messages: messages.map((x) => this.messageToNative(x)),
                model: this.GetModel(),
                response_format: response_format as any,
                //max_tokens: 128000,
                //max_completion_tokens: 128000,
                tools: tools
            },
        );

        //if (chatCompletion.usage?.prompt_tokens || 0 >= 32000)
        //    console.error(`Unsloth model runs out of context window due to tokens count`);

        // console.log(`Unsloth finish reason`, chatCompletion.choices[0].finish_reason);
        if (chatCompletion.choices[0].finish_reason === "length") {
            process.stdout.write("Message lengths: ")
            for (const msg of messages) {
                process.stdout.write(msg.content.length + " ");
            }
            console.error(`[Unsloth] Unsloth model runs out of context window due to tokens count`);
            dumpDebugJSON([this.GetProvider(), this.GetModel(),`Unsloth model runs out of context window due to tokens count`,  messages]);
        }

        return new UnslothOpenAIResponseWrapper(chatCompletion);
    }

    // Multimodal input using the OpenAI-compatible chat completions API: the image files
    // are inlined as base64 data:image URLs in the user message content parts.
    public async promptWithImage(imagePath: string, prompt: string): Promise<AIResponseWrapper> {
        return this.promptWithImages([imagePath], prompt);
    }

    public async promptWithImages(imagePaths: string[], prompt: string): Promise<AIResponseWrapper> {
        const content: any[] = [{ type: "text", text: prompt }];
        for (const imagePath of imagePaths) {
            const mime = mimeTypeForFile(imagePath);
            const base64 = fs.readFileSync(imagePath).toString("base64");
            content.push({
                type: "image_url",
                image_url: { url: `data:${mime};base64,${base64}` },
            });
        }

        const chatCompletion = await UnslothClient.chat.completions.create({
            messages: [{ role: "user", content }],
            model: this.GetModel(),
            max_tokens: 2048,
        });

        return new UnslothOpenAIResponseWrapper(chatCompletion);
    }
}

export const UnslothOpenAIWrapper = new UnslothOpenAIWrapperClass();

export class UnslothOpenAIMessageWrapper implements AIMessageWrapper {
    role!: string;
    content!: string;
    name?: string;
    tool_call_id?: string | undefined;
    tool_calls?: JSONStructure[] | undefined;
}

export class UnslothOpenAIResponseWrapper implements AIResponseWrapper {
    response: OpenAI.Chat.Completions.ChatCompletion;

    constructor(response: OpenAI.Chat.Completions.ChatCompletion) {
        this.response = response;
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

        return this.response.choices[0].message.tool_calls.map((x) => new UnslothOpenAIToolWrapper(x as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall));
    }

    public getMessage(): UnslothOpenAIMessageWrapper {
        const msg = this.getMessageRaw();
        return msg as UnslothOpenAIMessageWrapper;
    }

    public getMessageRaw(): OpenAI.Chat.Completions.ChatCompletionMessageParam {
        return this.response.choices[0].message;
    }

    public getCompletionTokens() {
        return this.response.usage?.completion_tokens || Math.ceil(this.getContent().length / 4);
    }

    public getFinishReason(): string {
        return this.response.choices?.[0]?.finish_reason || "";
    }
}

export class UnslothOpenAIToolWrapper implements ToolCallWrapper {
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