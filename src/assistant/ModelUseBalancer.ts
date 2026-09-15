import { GroqBigWrapper, GroqQwenWrapper, GroqWrapper, GroqWrapperClass } from "../api/groq.js";
import { OpenRouterWrapperClass } from "../api/openrouter.js";
import { AIMessageWrapper, AIModelWrapper, AIResponseWrapper, JSONStructure } from "../api/types.js";
import { MIS_DT } from "../util/MIS_DT.js";
import { Sleep } from "../util/Sleep.js";
import { OpencodeWrapperClass } from "../api/opencode.js";
import { ModelRequestLog, ModelRequestLogRepository } from "./ModelRequest.js";
import { KiloWrapperClass } from "../api/kilo.js";

// US23 ModelUseBalancer routes each agent request to the most appropriate available model,
// manages per-model rate limits (TPM/RPM), enforces retries with lock penalty back-off, and
// falls back to the local model when remote providers fail or none can fit the request.
// US23AC5 ModelUseBalancer filters candidate models by capability (tools / structured output),
// input size and complexity before choosing one.
function estimateTokens(text: string): number {
    if (!text) return 0;
    const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) || []).length;
    const totalLen = text.length;
    const cyrillicRatio = cyrillicCount / totalLen;
    // Blended multiplier: between 0.2875 (Latin) and 0.667 (Cyrillic)
    const multiplier = 0.2875 + (0.667 - 0.2875) * cyrillicRatio;
    return Math.ceil(totalLen * multiplier * 1.25);
}
// Used with Promise.race to timeout prompts
function rejectOnTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Error: Timeout: Request timed out after ${ms}ms`)), ms)
    );
}

// ----------------------------------------------------------------------
// Extended ModelOption with rate‑limit metadata
// ----------------------------------------------------------------------
class ModelOption {
    Wrapper!: AIModelWrapper;
    LockedUntil = 0;               // absolute timestamp (ms) when this model becomes free
    SupportsTools = false;
    SupportsStructuredResponse = false;
    LengthLimit = 0;               // maximum input tokens (0 = unlimited)
    TPM = 0;                       // tokens per minute limit (0 = no limit)
    RPM = 0;                       // requests per minute limit (0 = no limit)
    TPS = 0;                       // approximate tokens per second (for sorting speed)
    errorsCounter = 0;
}

// ----------------------------------------------------------------------
// All available models – with their known limits
// ----------------------------------------------------------------------

export const GroqGPTModelOption: ModelOption =
{
    LockedUntil: 0,
    Wrapper: GroqWrapper,        // "openai/gpt-oss-20b" (default)
    SupportsTools: true,
    SupportsStructuredResponse: true,
    LengthLimit: 7500,
    TPM: 8000,
    RPM: 30,
    TPS: 160,
    errorsCounter: 0
};
export const GroqGPTBigModelOption: ModelOption =
{
    LockedUntil: 0,
    Wrapper: GroqBigWrapper,     // "openai/gpt-oss-120b"
    SupportsTools: true,
    SupportsStructuredResponse: true,
    LengthLimit: 7500,
    TPM: 8000,
    RPM: 30,
    TPS: 150,
    errorsCounter: 0
};


export const NvidiaNemotronModelOption: ModelOption = {
    LockedUntil: 0,
    Wrapper: new KiloWrapperClass("nvidia/nemotron-3-ultra-550b-a55b:free"),
    SupportsTools: true,
    SupportsStructuredResponse: true,
    LengthLimit: 900_000,
    TPM: 40000,
    RPM: 3,
    TPS: 50,
    errorsCounter: 0
};

export const Options: ModelOption[] = [
    GroqGPTModelOption, GroqGPTBigModelOption,
    NvidiaNemotronModelOption,
    {
        LockedUntil: 0,
        Wrapper: new OpenRouterWrapperClass("google/gemma-4-31b-it:free"),
        SupportsTools: true,
        SupportsStructuredResponse: true,
        LengthLimit: 45000,
        TPM: 18000,
        RPM: 30,
        TPS: 20,
        errorsCounter: 0
    },
    {
        LockedUntil: 0,
        Wrapper: new OpenRouterWrapperClass("nvidia/nemotron-3.5-lightning:free"),
        SupportsTools: true,
        SupportsStructuredResponse: true,
        LengthLimit: 40000,
        TPM: 16000,
        RPM: 30,
        TPS: 47,
        errorsCounter: 0
    },
    {
        LockedUntil: 0,
        Wrapper: new OpenRouterWrapperClass("google/gemma-4-26b-a4b-it:free"),
        SupportsTools: false,
        SupportsStructuredResponse: false,
        LengthLimit: 45000,
        TPM: 18000,
        RPM: 30,
        TPS: 50,
        errorsCounter: 0
    },
    {
        LockedUntil: 0,
        Wrapper: new OpencodeWrapperClass("big-pickle"),
        SupportsTools: true,
        SupportsStructuredResponse: true,
        LengthLimit: 190_000,
        TPM: 999_000,
        RPM: 6,
        TPS: 40,
        errorsCounter: 0
    },
];

//const FallbackOption = (Config.isDev()) ? LocalOption : Options[0];
const FallbackOption = Options[Options.length - 1];

// Slightly adjust local llm only boundary to balance between two modes;
export let LocalLLMOnlyBoundary = 1000;

// Helper: pick the best option based on estimated total completion time
function pickBest(filteredOptions: ModelOption[], estimatedOutputTokens: number): ModelOption {
    const now = MIS_DT.GetExact();

    // Don't wait for long disabled options
    const newFiltered = filteredOptions.filter((x) => x.LockedUntil < MIS_DT.GetExact() + MIS_DT.OneMinute());

    if (!newFiltered.length) {
        return FallbackOption; // Use fallback last resort
    }

    // Temporarily try using only the local option to grade the model choice
    //if (newFiltered.includes(LocalOption)) {
    //    
    //    return LocalOption;
    //}

    const sorted = [...newFiltered].sort((a, b) => {
        // 1. How long until this model becomes available (ms)
        const aWait = Math.max(0, a.LockedUntil - now) * 1000;
        const bWait = Math.max(0, b.LockedUntil - now) * 1000;

        // 2. How long it will take to generate the response (ms)
        //    Avoid division by zero; if TPS is 0 or undefined, assume very slow (1 TPS)
        const aTps = Math.max(a.TPS, 1);
        const bTps = Math.max(b.TPS, 1);
        const aGenTime = (estimatedOutputTokens / aTps) * 1000; // convert to ms
        const bGenTime = (estimatedOutputTokens / bTps) * 1000;

        // Prioritize models with length limits if they are suitable for the task
        const aLenLimit = (a.LengthLimit) ? 2 : 1;
        const bLenLimit = (b.LengthLimit) ? 2 : 1;

        // 3. Total estimated time to completion
        const aScore = (aWait + aGenTime) / aLenLimit;
        const bScore = (bWait + bGenTime) / bLenLimit;

        // Sort ascending
        return aScore - bScore;
    });

    return sorted[0];
}

// ----------------------------------------------------------------------
// Helper: get the lock duration for a request
// ----------------------------------------------------------------------
function getLockDuration(option: ModelOption, inputTokens: number, outputTokens: number): number {
    let lockMs = 0;
    // TPM constraint
    if (option.TPM > 0) {
        const totalTokens = inputTokens + outputTokens;
        const tpmLock = (totalTokens / option.TPM) * 60 * 1000;
        lockMs = Math.max(lockMs, tpmLock);
    }
    // RPM constraint
    if (option.RPM > 0) {
        const rpmLock = (1 / option.RPM) * 60 * 1000;
        lockMs = Math.max(lockMs, rpmLock);
    }
    // add a small buffer (20%) to avoid burst errors
    return lockMs * 1.2;
}

// ----------------------------------------------------------------------
// Main exported functions
// ----------------------------------------------------------------------
export function GetExpectedDelay() {
    const now = MIS_DT.GetExact();
    const minLock = Options.reduce((min, opt) => Math.min(min, opt.LockedUntil), Infinity);
    return minLock - now;
}

// Shorthand wrapper for a single prompt without tools
export async function BalancedPromptRequest(prompt: string, response_format: JSONStructure | undefined = undefined): Promise<string> {
    // US23AC20 BalancedPromptRequest is a convenience wrapper for a single-message request with no tool handling
    const res = await BalancedAIRequestWTools([GroqWrapper.message("user", prompt)], undefined, response_format);
    return res.getContent();
}

// This function exposes tool calls but doesn't process them and doesn't mutate messages history
// US23AC25 BalancedAIRequestSkimmed issues a request but leaves tool calls unprocessed (handled by the agent loop)
export async function BalancedAIRequestSkimmed(messages: AIMessageWrapper[], tools?: any[], response_format?: JSONStructure): Promise<AIResponseWrapper> {
    return BalancedAIRequestWTools(messages, tools, response_format, false)
}

export let LastModelRequestDone = MIS_DT.GetExact();

function getFilteredOptions(messages: AIMessageWrapper[],
    tools?: any[],
    response_format?: JSONStructure,
    handleTools = true,
    localOnly = false) {
    // ---- Step 1: filter models by capability, input size and complexity ----
    let filteredOptions = [...Options];
    // Estimate total input tokens from all messages
    const totalInputTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

    if (tools) {
        filteredOptions = filteredOptions.filter(opt => opt.SupportsTools);
    }
    if (response_format) {
        filteredOptions = filteredOptions.filter(opt => opt.SupportsStructuredResponse);
    }

    filteredOptions = filteredOptions.filter(opt => opt.LengthLimit === 0 || opt.LengthLimit > totalInputTokens);

    if (filteredOptions.length === 0) {
        throw new Error("ModelUseBalancer: no suitable model for this request");
    }

    return filteredOptions;
}

// This function uses recursion to handle nested requests instead of conversation history embedded in the SQL DB
// US23AC10 BalancedAIRequestWTools filters candidate models, waits for rate-limit locks, applies a
// retry loop (max 10 attempts) that backs off with lock penalties and falls back to the local model.
export async function BalancedAIRequestWTools(
    messages: AIMessageWrapper[],
    tools?: any[],
    response_format?: JSONStructure,
    handleTools = true,
    localOnly = false
): Promise<AIResponseWrapper> {

    LastModelRequestDone = MIS_DT.GetExact();

    const totalInputTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

    const filteredOptions = getFilteredOptions(messages, tools, response_format, handleTools, localOnly);
    let bestOption = pickBest(filteredOptions, totalInputTokens / 4); // select faster models for larger contexts and inputs
    return BalancedAIRequestWModel(messages, bestOption, tools, response_format, handleTools);
}

export async function BalancedAIRequestWModels(
    messages: AIMessageWrapper[],
    filteredOptions: ModelOption[],
    tools?: any[],
    response_format?: JSONStructure,
    handleTools = true
): Promise<AIResponseWrapper> {

    LastModelRequestDone = MIS_DT.GetExact();

    const totalInputTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

    let bestOption = pickBest(filteredOptions, totalInputTokens / 4); // select faster models for larger contexts and inputs
    return BalancedAIRequestWModel(messages, bestOption, tools, response_format, handleTools);
}

// This function uses recursion to handle nested requests instead of conversation history embedded in the SQL DB
// US23AC10 BalancedAIRequestWTools filters candidate models, waits for rate-limit locks, applies a
// retry loop (max 10 attempts) that backs off with lock penalties and falls back to the local model.
export async function BalancedAIRequestWModel(
    messages: AIMessageWrapper[],
    bestOption: ModelOption,
    tools?: any[],
    response_format?: JSONStructure | undefined,
    handleTools = true,
): Promise<AIResponseWrapper> {
    // ---- Step 2: selection loop (max 10 retries) ----
    let attempts = 0;
    const maxAttempts = 10;
    const totalInputTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    const filteredOptions = getFilteredOptions(messages, tools, response_format, handleTools);

    while (attempts < maxAttempts) {
        attempts++;
        if (attempts == maxAttempts)
            bestOption = FallbackOption; // fallback to local for the last attempt

        // ---- Step 3: wait until the chosen model is available ----
        const now = MIS_DT.GetExact();
        const waitTime = bestOption.LockedUntil - now;
        if (waitTime > 0) {
            console.log(`[ModelUseBalancer] Waiting ${Math.ceil(waitTime / 1000)}s for ${bestOption.Wrapper.GetModel()} (${bestOption.Wrapper.GetProvider()})`);
            await Sleep(waitTime);
        }

        // ---- Step 4: attempt the request ----
        const currentMessages = [...messages];
        // Sanitize before sending: a message with `content: null` and no tool_calls is rejected by
        // OpenAI-compatible providers as an invalid type. Only replace null content in that case —
        // an assistant tool-call turn legitimately carries `content: null` alongside its tool_calls,
        // which the providers accept, so leave those untouched.
        const sanitizedMessages = currentMessages.map((m) =>
            m.content == null && !(m.tool_calls && m.tool_calls.length > 0) ? { ...m, content: "[empty message]" } : m
        );
        const prompt = sanitizedMessages[sanitizedMessages.length - 1].content;
        try {
            const timeStart = MIS_DT.GetExact();

            console.log(`[ModelUseBalancer] Prompting ${bestOption.Wrapper.GetModel()} (${bestOption.Wrapper.GetProvider()})`);

            let timeout = (bestOption.Wrapper.GetProvider().toLowerCase() == "ollama") ? 1000 * 1000 : 180 * 1000;
            const chatCompletion = await Promise.race([bestOption.Wrapper.prompt(sanitizedMessages, response_format, tools), rejectOnTimeout(timeout)]);

            // Estimate output tokens
            const outputContent = chatCompletion.getContent();
            const outputTokens = estimateTokens(outputContent);

            // An empty response with no tool calls is never useful to any caller and is a strong
            // signal (e.g. a model like qwen3.6-27b hitting its budget) that the model could not
            // produce an answer. Treat it as a retryable failure so the loop picks the next model.
            if ((!outputContent || outputContent.trim().length === 0) && chatCompletion.getToolCalls().length === 0) {
                throw new Error(`Empty response (no text, no tool calls) from ${bestOption.Wrapper.GetProvider()} / ${bestOption.Wrapper.GetModel()}. Retrying with another model.`);
            }

            // ---- Step 5: apply rate‑limit locks ----
            const inputTokens = totalInputTokens; // already computed
            const lockMs = getLockDuration(bestOption, inputTokens, outputTokens);
            bestOption.LockedUntil = Math.max(MIS_DT.GetExact(), bestOption.LockedUntil) + lockMs;
            bestOption.errorsCounter = Math.max(0, bestOption.errorsCounter - 1);

            console.debug(`[ModelUseBalancer] Model ${bestOption.Wrapper.GetModel()} locked for ${Math.ceil(lockMs / 1000)}s`);

            // ---- Step 6: log the request ----
            const logentry = new ModelRequestLog();
            logentry.message = outputContent;
            logentry.reasoning = chatCompletion.getReasoningContent();
            logentry.tools = JSON.stringify(chatCompletion.getToolCalls());
            logentry.model = bestOption.Wrapper.GetModel();
            logentry.provider = bestOption.Wrapper.GetProvider();
            logentry.conversationLength = currentMessages.length;
            logentry.context = JSON.stringify(currentMessages);
            logentry.prompt = prompt;
            logentry.completionTokens = outputTokens; // approximate
            logentry.completionTime = MIS_DT.GetExact() - timeStart;
            await ModelRequestLogRepository.Insert(logentry);

            return chatCompletion;
        } catch (e) {
            // ---- Error handling: increase lock to back off ----
            console.error(`[BalancedAIRequestWTools] ${bestOption.Wrapper.GetProvider()} / ${bestOption.Wrapper.GetModel()} error:`, e);

            LocalLLMOnlyBoundary--;

            // Increase lock: if the error is rate‑limit related, we might want to wait longer.
            // Simple strategy: add 5 seconds or the same lock duration as a normal request.
            const inputTokens = totalInputTokens;
            const penaltyMs = Math.min(5000, getLockDuration(bestOption, inputTokens, 500));
            // Apply increasing delays for models with repeated errors
            bestOption.errorsCounter++;
            bestOption.LockedUntil = Math.max(MIS_DT.GetExact(), bestOption.LockedUntil) + penaltyMs * bestOption.errorsCounter;

            // Append some lock based on the error type. JSON.stringify on an Error yields "{}"
            // (its message lives on a non-enumerable property), masking the error kind and leaving
            // the model unlocked on TPM/RPM=0 providers. String(e) keeps the message text.
            const error = (e instanceof Error ? (e.stack || e.message) : String(e)).toLowerCase();
            if (error.includes("tokens per day")) {
                bestOption.LockedUntil += MIS_DT.OneMinute() * 30;
            }
            else if (error.includes("badrequesterror: 400") || error.includes('"status": 400')) {
                bestOption.LockedUntil += MIS_DT.OneMinute() * 10;
            }
            else if (error.includes("ratelimiterror: 429")) {
                bestOption.LockedUntil += MIS_DT.OneMinute() * 3;
            }
            else if (error.includes("permissiondeniederror: 403")) {
                bestOption.LockedUntil += MIS_DT.OneMinute() * 30;
            }
            else if (error.includes("timeout") || error.includes("timed out")) {
                bestOption.LockedUntil += MIS_DT.OneMinute() * 2;
            }
            else if (error.includes("apierror: 402")) {
                bestOption.LockedUntil += MIS_DT.OneMinute() * 15;
            }
            else if (error.includes("does not exist or you do not have access to it")) {
                bestOption.LockedUntil += MIS_DT.OneMinute() * 60;
            }
            else if (error.includes("request too large")) {
                bestOption.LockedUntil += MIS_DT.OneMinute() * 1;
            }
            else {
                bestOption.LockedUntil += MIS_DT.OneMinute() * 5;
            }

            console.debug(`[ModelUseBalancer] Model ${bestOption.Wrapper.GetModel()} locked for ${Math.ceil((bestOption.LockedUntil - MIS_DT.GetExact()) / 1000)}s`);

            // Re‑pick the next best model for the next attempt
            bestOption = pickBest(filteredOptions, totalInputTokens);
        }
    }

    throw new Error(`ModelUseBalancer: failed after ${maxAttempts} attempts`);
}