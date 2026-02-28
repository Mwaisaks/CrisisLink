import { GoogleGenAI, Type } from "@google/genai";
import { SeverityTier } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const classifyCrisis = async (type: string, description: string, location?: string) => {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `Act as a calm, clear emergency guide. Classify the following crisis report and provide exactly 5 numbered steps for immediate action.
    
    Crisis Type: ${type}
    Description: ${description}
    Location Context: ${location || "Unknown"}
    
    Rules for Steps:
    - Step 1 MUST ALWAYS be: "Call [local emergency number] immediately — do not rely on this platform alone"
    - Steps 2–4 must be specific to the crisis type reported.
    - Step 5 MUST ALWAYS be: "Stay on the line with emergency services and do not leave the area unless you are in immediate danger"
    - Each step must be a single short sentence.
    - No medical jargon. No mention of specific medications or clinical procedures.
    
    Rules for Classification:
    - Assign a severity tier: Tier 1 — Critical, Tier 2 — High, or Tier 3 — Moderate.
    - Be conservative: if unsure, escalate to a higher tier.
    
    Rules for Detection:
    - If the description involves a child or elderly person, set "vulnerablePersonDetected" to true.
    
    End with a calm reassurance line: "You have done the right thing. Help is being coordinated."`,
    config: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          severity: {
            type: Type.STRING,
            description: "The severity tier (Tier 1 — Critical, Tier 2 — High, Tier 3 — Moderate)",
          },
          guidance: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Exactly 5 steps as an array of strings",
          },
          vulnerablePersonDetected: {
            type: Type.BOOLEAN,
            description: "True if a child or elderly person is mentioned",
          },
          reassurance: {
            type: Type.STRING,
            description: "The calm reassurance line",
          },
          summary: {
            type: Type.STRING,
            description: "A brief 1-sentence summary of the situation for the public",
          }
        },
        required: ["severity", "guidance", "vulnerablePersonDetected", "reassurance", "summary"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const searchNearbyOrgs = async (type: string, location: string) => {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `Find emergency response organisations, NGOs, or government services related to "${type}" in or near "${location}". 
    Return a list of organisations with their name, type, and contact info if available.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            type: { type: Type.STRING },
            phone: { type: Type.STRING },
            website: { type: Type.STRING },
            email: { type: Type.STRING }
          },
          required: ["name", "type"]
        }
      }
    }
  });

  return JSON.parse(response.text);
};

export const analyzeCrisisImage = async (base64Image: string) => {
  const model = "gemini-3.1-pro-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
        {
          text: "Analyze this crisis image. What is happening? Estimate the scale and immediate dangers.",
        },
      ],
    },
  });

  return response.text;
};

export const moderateComment = async (comment: string) => {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `You are a content moderator for an emergency alert platform. 
    Review this comment and determine if it: (a) contains harmful, 
    offensive or abusive language, (b) appears to be deliberate 
    misinformation about an emergency, or (c) contains personal 
    attacks.
    
    Comment: "${comment}"
    
    Respond with JSON only: 
    { "approved": true/false, "reason": "string" }
    If genuinely uncertain, approve it — do not over-filter. 
    Community safety information should not be blocked.`,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          approved: { type: Type.BOOLEAN },
          reason: { type: Type.STRING }
        },
        required: ["approved", "reason"]
      }
    }
  });

  return JSON.parse(response.text);
};
