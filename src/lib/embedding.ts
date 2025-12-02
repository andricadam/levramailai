import { OpenAIApi, Configuration } from "openai-edge";

const config = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(config);

export async function getEmbeddings(text: string) {
    try {
        const response = await openai.createEmbedding({
            model: "text-embedding-ada-002",
            input: text.replace(/\n/g, " "),
        });
        const result = await response.json();
        
        // Check if the response has an error
        if (!response.ok || result.error) {
            const errorMessage = result.error?.message || "Failed to get embeddings";
            console.error("OpenAI API error:", result.error || result);
            
            // Check if it's a quota error
            if (errorMessage.includes("quota") || errorMessage.includes("exceeded") || errorMessage.includes("billing")) {
                const quotaError = new Error(`OpenAI quota exceeded: ${errorMessage}. Please check your OpenAI billing and plan.`);
                (quotaError as any).isQuotaError = true;
                throw quotaError;
            }
            
            throw new Error(errorMessage);
        }
        
        // Check if data exists and has items
        if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
            console.error("Unexpected API response structure:", result);
            throw new Error("Invalid response structure from OpenAI API");
        }
        
        return result.data[0].embedding as number[];
    } catch (error) {
        // Re-throw quota errors with better context
        if (error instanceof Error && (error.message.includes("quota") || error.message.includes("exceeded") || error.message.includes("billing"))) {
            console.error("OpenAI quota error - embeddings cannot be generated:", error.message);
            throw error;
        }
        console.error("Error calling OpenAI embeddings API:", error);
        throw error;
    }
}