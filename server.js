const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const port = 3000;

// OpenAI API config
const openai = new OpenAIApi(
    new Configuration({
        apiKey: '', // API key
    })
);

// Config CORS to allow access from your local network
app.use(cors({
    origin: '*', // Be careful with this
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Function to parse description using OpenAI GPT-3.5
async function parseDescriptionWithGPT(description) {
    const prompt = `
    You are an AI that processes product descriptions and extracts specific sections. The input can describe a wide variety of products, including clothing, accessories, home goods, and outdoor equipment. Read the following product description carefully and split it into the following JSON format:
    1. "description": A summary of the product's purpose and features.
    2. "material": Information about the materials used (if available).
    3. "otherInfo": A bullet-point list of additional details, including:
       - Pflegehinweise (Care instructions)
       - Gewicht (Weight)
       - Certifications (e.g., OEKO-TEX, RWS, or others)
    4. "sizeTable": For clothing items with size information, format it as a string with size measurements separated by commas and rows separated by semicolons. Each row should follow this exact format: "Size,Shoulder,Chest,BackLength". Example: "S,42,52,70;M,44,54,72;L,46,56,74". For non-clothing items or if no size table is available, return an empty string.

    Ensure your output is concise, complete, and formatted correctly.
    
    Input:
    ${description}
    
    Example Output for a T-shirt:
    {
      "description": "Classic cotton t-shirt with round neck and short sleeves",
      "material": "100% organic cotton, 180g/m²",
      "otherInfo": [
        "- Pflegehinweise: Machine washable at 30°C, tumble dry low",
        "- Gewicht: 200g",
        "- Certifications: OEKO-TEX Standard 100"
      ],
      "sizeTable": "S,42,52,70;M,44,54,72;L,46,56,74;XL,48,58,76"
    }

    Example Output for a non-clothing item:
    {
      "description": "Stainless steel water bottle with double-wall insulation",
      "material": "18/8 food-grade stainless steel",
      "otherInfo": [
        "- Pflegehinweise: Hand wash only",
        "- Gewicht: 500g",
        "- Certifications: BPA-free"
      ],
      "sizeTable": ""
    }`;

    try {
        console.log('Sending request to OpenAI...');
        const response = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a helpful assistant that splits product descriptions into structured JSON sections.' },
                { role: 'user', content: prompt },
            ],
            max_tokens: 800,
            temperature: 0.3,
        });

        const rawResponse = response.data.choices[0].message.content.trim();
        console.log('Raw OpenAI Response:', rawResponse);

        // Remove backticks and validate JSON
        const cleanedResponse = rawResponse.replace(/```json|```/g, '').trim();
        console.log('Cleaned Response:', cleanedResponse);

        if (isValidJson(cleanedResponse)) {
            const parsedJson = JSON.parse(cleanedResponse);
            console.log('Successfully parsed JSON:', parsedJson);
            return parsedJson;
        } else {
            console.error('Invalid JSON format detected in the OpenAI response');
            throw new Error('Invalid JSON format in OpenAI response');
        }
    } catch (error) {
        console.error('Error in parseDescriptionWithGPT:', error);
        console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        
        // Return a error message
        return {
            description: 'Error processing description. Please try again.',
            material: 'Material information unavailable.',
            otherInfo: 'Additional information unavailable.',
            sizeTable: 'Size table unavailable.',
            error: error.message
        };
    }
}

// Helper function to validate JSON
function isValidJson(jsonString) {
    try {
        const result = JSON.parse(jsonString);
        const requiredFields = ['description', 'material', 'otherInfo', 'sizeTable'];
        return requiredFields.every(field => result.hasOwnProperty(field));
    } catch (e) {
        console.error('JSON validation error:', e);
        return false;
    }
}

// Product search and scraping
app.get('/search/:barcode', async (req, res) => {
    const { barcode } = req.params;
    console.log(`Searching for barcode: ${barcode}`);
    
    try {
        const browser = await puppeteer.launch({
            headless: false,
            slowMo: 250,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
            defaultViewport: { width: 1920, height: 1080 }
        });
        
        const page = await browser.newPage();

        // Set cookies before navigation
        await page.setCookie({
            name: 'cookieConsent',
            value: 'true',
            domain: '.normani.de',
            path: '/',
            expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
        });
        
        // Log all console messages from the page
        page.on('console', msg => console.log('Browser Console:', msg.text()));
        
        console.log(`Navigating to: https://www.normani.de/search/?q=${barcode}`);
        
        // Go to search page
        await page.goto(`https://www.normani.de/search/?q=${barcode}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Bypass cookie popup
        try {
            const acceptButton = await page.waitForSelector('#accept-selected', { timeout: 5000 });
            if (acceptButton) {
                console.log('Cookie popup found, clicking accept button');
                await acceptButton.click();
                await page.waitForTimeout(1000);
            }
        } catch (error) {
            console.log('No cookie popup found or already accepted');
        }

        // Wait for search results and click on the first product
        console.log('Waiting for product results...');
        await page.waitForSelector('div.art-picture-block a', { timeout: 10000 });

        const productLink = await page.$('div.art-picture-block a');
        if (!productLink) throw new Error('No products found');

        console.log('Product found, clicking link...');
        await page.evaluate((link) => link.click(), productLink);
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });

        console.log('Navigated to product page:', page.url());

        // Extract product information
        const productData = await page.evaluate(() => {
            const title = document.querySelector('#pd-form > section > aside > div.pd-info.pd-group > div.page-title > h1')?.textContent?.trim() || '';
            const sku = document.querySelector('#pd-form > section > aside > div.pd-attrs-container > table > tbody > tr > td:nth-child(2)')?.textContent?.trim() || '';
            const description = document.querySelector('#collapse-pd-tabs-0 > div')?.textContent?.trim() || '';
            const size = document.querySelector('.select2-selection__rendered')?.textContent?.trim() || 'Size not available';
            const imageElement = document.querySelector('#pd-gallery img');
            const imageUrl = imageElement ? imageElement.src : '';
            const productUrl = window.location.href;

            return { title, sku, description, size, imageUrl, productUrl };
        });

        // Parse the description using AI
        console.log('Parsing description using OpenAI GPT-3.5-Turbo...');
        productData.parsedDescription = await parseDescriptionWithGPT(productData.description);
        console.log('Parsed description:', productData.parsedDescription);

        // Send the response
        res.json({
            message: 'Product information retrieved',
            url: page.url(),
            productData
        });

        await browser.close();
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'An error occurred', details: error.message });
    }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('To access from your phone, use one of these URLs:');
    // Get local IP addresses
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip internal and non-IPv4 addresses
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`http://${net.address}:${port}`);
            }
        }
    }
});
