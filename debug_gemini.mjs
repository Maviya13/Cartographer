
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

async function main() {
    try {
        console.log('Reading .env file...');
        const envPath = path.resolve(process.cwd(), '.env');
        if (!fs.existsSync(envPath)) {
            console.error('.env file not found at:', envPath);
            return;
        }

        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);

        if (!match) {
            console.error('GEMINI_API_KEY not found in .env');
            return;
        }

        let apiKey = match[1].trim().replace(/^["']|["']$/g, '');
        console.log(`API Key found: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)} (Length: ${apiKey.length})`);

        console.log('Initializing GoogleGenAI...');
        const genAI = new GoogleGenAI({ apiKey: apiKey });

        console.log('Testing generateContent with model: gemini-2.5-pro');
        const result = await genAI.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: 'Hello, explain "hello world" in 5 words.'
        });

        console.log('Success!');
        console.log('Response:', result.text());

    } catch (error) {
        console.error('Error occurred:');
        console.error(error);
        if (error.response) {
            console.error('Response data:', await error.response.text());
        }
    }
}

main();
