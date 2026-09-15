import Groq from 'groq-sdk';
import { GetFetch } from './proxy';

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