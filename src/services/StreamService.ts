// Stream Video Service - Calls Supabase Edge Function for token generation
import { supabase } from "../lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface StreamTokenResponse {
    token: string;
    userId: string;
    apiKey: string;
}

export class StreamService {
    /**
     * Get Stream token from Supabase Edge Function
     */
    static async getStreamToken(userId: string): Promise<StreamTokenResponse> {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/stream-token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({ userId }),
        });

        if (!response.ok) {
            throw new Error("Failed to get Stream token");
        }

        return response.json();
    }
}
