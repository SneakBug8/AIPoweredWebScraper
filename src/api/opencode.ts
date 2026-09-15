import OpenAI from "openai";
import { AIMessageWrapper, AIModelWrapper, AIResponseWrapper, ExtractReasoningContent, JSONStructure, ToolCallWrapper } from "./types.js";
import { dumpDebugJSON } from "../util/dumpDebugJSON.js";
import { GetFetch } from "./proxy.js";
import { randomBytes } from "crypto";

//US100 Opencode is one of the available APIs. The zen free tier needs no API key: anonymous
//  requests are rated on the free quota (429 FreeUsageLimitError when it is exhausted), while a
//  wrong key returns 401 Invalid API key. When OPENCODE_API_KEY is set it is sent as a real key.
const opencodeApiKey = process.env.OPENCODE_API_KEY;

// The real CLI compiles in a build-time OPENCODE_VERSION global; there is none here, so the
// imitated version is pinned to a known-working CLI release (spec §2, docs/specs/model-server-headers.md).
const installationVersion = "1.15.0";

// Crockford base32 alphabet (ULID-style), matching the real CLI id encodings.
const idAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomId(length: number): string {
    const bytes = randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i++) out += idAlphabet[bytes[i] % idAlphabet.length];
    return out;
}

// Session id: ses_ + 26-char reverse-time-sortable id. Resolved once per process so all requests
// within this client "session" share one id (spec §3.1).
const opencodeSessionId = "ses_" + randomId(26);

// x-opencode-project id, hardcoded for the Kate project. This was computed from the git remote
// URL hash for this repo (SHA1("git-remote:github.com/sneakbug8/katepersonalaiassistant")); it is
// now hardcoded to avoid shelling out to git on every process boot (spec §3.4, step 1).
const opencodeProjectId = "2c4db1f7208c023f650bac9bb2a64ce34e8d557f";

// Per-request operational headers (spec §3.1). A fresh user-message id per LLM request; the
// optional x-parent-session-id is only set for child/subagent sessions.
function buildOpencodeHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        "x-opencode-session": opencodeSessionId,
        "x-opencode-request": "msg_" + randomId(20),
        "x-opencode-client": process.env.OPENCODE_CLIENT || "cli",
        "User-Agent": `opencode/${installationVersion}`,
    };
    if (opencodeProjectId) headers["x-opencode-project"] = opencodeProjectId;
    if (process.env.OPENCODE_PARENT_SESSION_ID) headers["x-parent-session-id"] = process.env.OPENCODE_PARENT_SESSION_ID;
    return headers;
}

// The OpenAI SDK always attaches "Bearer <apiKey>"; without a configured key that placeholder
// would be rejected with 401, so the Authorization header is stripped for anonymous requests.
// When a proxy is enabled, requests are routed through it (same endpoint as Telegram).
const baseFetch = GetFetch() || (globalThis.fetch as typeof fetch);
const opencodeFetch: typeof fetch = async (url, init) => {
    const headers = new Headers(init?.headers);
    for (const [key, value] of Object.entries(buildOpencodeHeaders())) {
        headers.set(key, value);
    }
    if (!opencodeApiKey) {
        headers.delete("Authorization");
    }
    return baseFetch(url, { ...init, headers });
};
export const OpencodeClient = new OpenAI({
    baseURL: "https://opencode.ai/zen/v1",
    timeout: 5 * 60 * 1000,
    apiKey: opencodeApiKey || "opencode",
    fetch: opencodeFetch,
});

export class OpencodeWrapperClass implements AIModelWrapper {

    model: string;
    public constructor(model: string) {
        this.model = model;
    }
    public GetProvider() {
        return "Opencode";
    }

    public GetModel() {
        return this.model;
    }

    public GetSleep() {
        return 99000;
    }

    public message(role: string, content: string, name: string | undefined = undefined, tool_call_id: string | undefined = undefined) {
        let msg = new OpencodeMessageWrapper();
        msg.role = role;
        msg.content = content;
        if (name)
            msg.name = name;
        if (tool_call_id)
            msg.tool_call_id = tool_call_id;
        return msg;
    }

    public wrapMessage(message: OpenAI.Chat.Completions.ChatCompletionMessageParam) {
        let msg = new OpencodeMessageWrapper();
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
            const chatCompletion = await OpencodeClient.chat.completions.create(
                {
                    messages: messages.map((x) => this.messageToNative(x)),
                    model: this.GetModel(),
                    response_format: response_format as any,
                    tools: tools
                },
            );

            console.log(`[OpenCode] Finish reason: ${chatCompletion.choices[0].finish_reason}`);

            return new OpencodeResponseWrapper(chatCompletion);
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

export class OpencodeMessageWrapper implements AIMessageWrapper {
    role!: string;
    content!: string;
    name?: string;
    tool_call_id?: string | undefined;
    tool_calls?: JSONStructure[] | undefined;
}

export class OpencodeResponseWrapper implements AIResponseWrapper {
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

        return this.response.choices[0].message.tool_calls.map((x) => new OpencodeToolWrapper(x as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall));
    }

    public getMessage(): OpencodeMessageWrapper {
        const msg = this.getMessageRaw();
        return msg as OpencodeMessageWrapper;
    }

    public getMessageRaw(): OpenAI.Chat.Completions.ChatCompletionMessageParam {
        return this.response.choices[0].message;
    }
}

export class OpencodeToolWrapper implements ToolCallWrapper {
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