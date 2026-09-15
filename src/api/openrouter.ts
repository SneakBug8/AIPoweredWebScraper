import OpenAI from "openai";
import { GetFetch } from "./proxy.js";

//US100 OpenRouter is one of the available APIs
export const OpenRouterClient = new OpenAI({
    apiKey: process.env.OPENROUTER_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    timeout: 32 * 60 * 1000,
    ...(GetFetch() ? { fetch: GetFetch() } : {})
});
