export interface AIModelWrapper {
    GetProvider() : string;
    GetModel() : string;
    GetSleep() : number;
    message(role: string, content: string, name: string | undefined, tool_call_id: string | undefined, tool_calls: JSONStructure | undefined) : AIMessageWrapper;
    wrapMessage(message: any): AIMessageWrapper;
    prompt(messages : AIMessageWrapper[], response_format?: JSONStructure, tools?: any[]) : Promise<AIResponseWrapper>;
}

export interface AIResponseWrapper {
    getContent() : string;
    getToolCalls() : ToolCallWrapper[];
    getMessage() : AIMessageWrapper;
    getCompletionTokens() : number;
    getFinishReason() : string;
    // Reasoning/thinking text the model generated but did not include in `content`
    // (e.g. OpenAI-compatible `reasoning_content`). Used for telemetry (ModelRequestLog).
    getReasoningContent() : string;
}

// Extracts the reasoning/thinking text from a raw provider message, whichever field name the
// provider used (`reasoning_content`, `reasoning`, `thinking`, `thought`). Returns "" when the
// provider inlines reasoning into content or does no separate thinking.
export function ExtractReasoningContent(msg: any): string {
    if (!msg) return "";
    if (typeof msg.reasoning_content === "string") return msg.reasoning_content;
    if (typeof msg.reasoning === "string") return msg.reasoning;
    if (typeof msg.thinking === "string") return msg.thinking;
    if (typeof msg.thought === "string") return msg.thought;
    return "";
}

export interface AIMessageWrapper {
    role: string;
    content: string;
    name?: string;
    tool_calls?: JSONStructure[] | undefined;
}

export type JSONStructure = {[key: string]: any};

export interface ToolCallWrapper {
    getName() : string;
    getArguments(): JSONStructure;
    getArgumentsRaw(): string;
    getToolCallId(): string | undefined;
    setToolCallId(id: string) : void;
}