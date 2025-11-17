import { GoogleGenAI } from "@google/genai";

// API key must be obtained exclusively from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const translateMessage = async (text: string, targetLanguage: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following text into ${targetLanguage}. Return ONLY the translated text without quotes or explanation.\n\nText: ${text}`,
    });
    
    return response.text?.trim() || text;
  } catch (error) {
    console.error("Translation error:", error);
    return text + " (Translation Failed)";
  }
};

export const getAIResponse = async (history: string[], userMessage: string): Promise<string> => {
  try {
    // Simple chat simulation
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a user on a messenger app called Prep Talk. 
      Reply briefly and naturally to the last message. 
      
      Context: ${history.join('\n')}
      User: ${userMessage}
      You:`,
    });

    return response.text?.trim() || "...";
  } catch (error) {
    console.error("AI Response error:", error);
    return "...";
  }
};