
import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getGeminiResponse = async (history: ChatMessage[], message: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: `You are FILO, an empathetic wellness companion. 
        Your goal is to help users understand their stress, loneliness, and work-life balance.
        Keep responses calm, supportive, and concise. 
        IMPORTANT: Always include a disclaimer that you are an AI and not a medical professional. 
        If a user expresses severe distress, provide links to international crisis hotlines.`,
        temperature: 0.7,
        topP: 0.8,
      },
    });

    return response.text || "I'm sorry, I'm having trouble connecting right now.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm having a technical issue. I'm still here for you, but my response might be limited.";
  }
};
