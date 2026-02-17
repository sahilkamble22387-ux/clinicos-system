
import { GoogleGenAI } from "@google/genai";
import { Patient, Visit } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getSmartSearchFilters = async (query: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Parse this patient search query: "${query}". 
      Return a JSON object identifying if the user specified: name, phone, gender, or age range.
      Example: { "name": "John", "gender": "Male" }`,
      config: {
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Search Error:", error);
    return null;
  }
};

export const summarizePatientHistory = async (history: { visit: Visit, diagnosis?: string }[]) => {
  try {
    const textHistory = history.map(h => `Date: ${h.visit.arrivalTime}, Diagnosis: ${h.diagnosis || 'N/A'}`).join('\n');
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Summarize this patient's medical history in 2-3 concise bullet points for a doctor: \n${textHistory}`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Summarization Error:", error);
    return "Summary unavailable.";
  }
};
