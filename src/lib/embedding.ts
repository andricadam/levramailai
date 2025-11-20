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
            console.error("OpenAI API error:", result.error || result);
            throw new Error(result.error?.message || "Failed to get embeddings");
        }
        
        // Check if data exists and has items
        if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
            console.error("Unexpected API response structure:", result);
            throw new Error("Invalid response structure from OpenAI API");
        }
        
        return result.data[0].embedding as number[];
    } catch (error) {
        console.log("error calling openai embeddings api", error);
        throw error;
    }
}