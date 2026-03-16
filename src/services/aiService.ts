import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface GeneratedPrescription {
    symptoms: string;
    diagnosis: string;
    medicines: {
        name: string;
        dosage: string;
    }[];
}

export const AIService = {
    async generatePrescriptionFromTranscript(transcript: string): Promise<GeneratedPrescription> {
        if (!API_KEY) {
            throw new Error("Gemini API key is not configured.");
        }

        const genAI = new GoogleGenerativeAI(API_KEY);
        // Gemini 3 Flash (preview) — the latest model
        let modelId = "gemini-3-flash-preview";
        
        // Define the schema to enforce JSON output
        const responseSchema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                symptoms: {
                    type: SchemaType.STRING,
                    description: "The patient's symptoms extracted from the conversation.",
                },
                diagnosis: {
                    type: SchemaType.STRING,
                    description: "The medical diagnosis extracted from the conversation.",
                },
                medicines: {
                    type: SchemaType.ARRAY,
                    description: "List of prescribed medicines.",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            name: {
                                type: SchemaType.STRING,
                                description: "The name of the medicine, including strength if mentioned (e.g. Paracetamol 500mg)",
                            },
                            dosage: {
                                type: SchemaType.STRING,
                                description: "The dosage and frequency instructions (e.g. 1 tablet twice a day for 5 days)",
                            }
                        },
                        required: ["name", "dosage"]
                    }
                }
            },
            required: ["symptoms", "diagnosis", "medicines"],
        };

        const prompt = `
You are an expert medical AI assistant. Analyze the following transcription of a doctor-patient consultation.
Extract the symptoms the patient has, the diagnosis determined by the doctor, and the exact medicines prescribed.

Transcript:
"""
${transcript}
"""
`;

        try {
            const model = genAI.getGenerativeModel({ model: modelId }); 
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                }
            });

            const responseText = result.response.text();
            return JSON.parse(responseText) as GeneratedPrescription;
        } catch (error: any) {
            console.error("Gemini Generate Error:", error);
            
            // Fallback just in case "gemini-3.0-flash" isn't the exact string Google deployed yet for the API param
            if (error.message && (error.message.includes("not found") || error.message.includes("Invalid model"))) {
                console.warn("Falling back to gemini-2.0-flash...");
                const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); 
                const fallbackResult = await fallbackModel.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: responseSchema,
                    }
                });
                return JSON.parse(fallbackResult.response.text()) as GeneratedPrescription;
            }
            throw error;
        }
    }
};
