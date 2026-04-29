import Groq from 'groq-sdk';

export const GroqAPI = new Groq({
  apiKey: process.env['GROQ_API_KEY'], // This is the default and can be omitted
});

