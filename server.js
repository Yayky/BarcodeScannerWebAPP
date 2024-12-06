const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const port = 3000;

// OpenAI API configuration
const openai = new OpenAIApi(
    new Configuration({
        apiKey: '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',
    })
);

// Configure CORS to allow access only from localhost
app.use(cors({
    origin: 'http://localhost:3000', // Only allow localhost
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Utility function for cleaning and validating the parsed response
function validateParsedResponse(parsedResponse) {
    return {
        description: typeof parsedResponse.description === "string" ? parsedResponse.description.trim() : "",
        materials: typeof parsedResponse.materials === "string" ? parsedResponse.materials.trim() : "",
        sizeInfo: typeof parsedResponse.sizeInfo === "string" ? parsedResponse.sizeInfo.trim() : "",
        otherInfo: typeof parsedResponse.otherInfo === "string" ? parsedResponse.otherInfo.trim() : ""
    };
}

// Function to parse product description using OpenAI GPT-3.5-Turbo
async function parseProductDescription(description) {
    try {
        const prompt = `
        Analyze the following product description and extract the following information as JSON:
        {
            "description": "Brief summary of product features",
            "materials": {
                "Außenmaterial": "e.g., 100 % Merino Wool",
                "Innenmaterial": "e.g., 100 % Merino Wool"
            },
            "sizeInfo": {
                "Größentabelle": {
                    "XS": {
                        "1/2 Schulter": "value",
                        "1/2 Brust": "value",
                        "Rückenlänge": "value"
                    },
                    ...
                }
            },
            "otherInfo": {
                "certifications": ["certifications"],
                "careInstructions": "care instructions",
                "gender": "gender",
                "additionalDetails": ["additional features"]
            }
        }

        Product Description:
        ${description}
        `;

        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are a JSON parser. Respond with JSON only." },
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 1000
        });

        let rawResponse = completion.data.choices[0]?.message?.content?.trim();

        if (!rawResponse) {
            console.error('Error: OpenAI API returned an empty response');
            return { description: '', materials: '', sizeInfo: '', otherInfo: '' };
        }

        console.log('Raw OpenAI Response:', rawResponse);

        // Clean the response by removing markdown code blocks (```json and ```)
        rawResponse = rawResponse.replace(/```json|```/g, '');

        // Try to parse the JSON
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(rawResponse);
        } catch (parseError) {
            console.error('Error parsing OpenAI response:', { error: parseError.message, rawResponse });
            return { description: '', materials: '', sizeInfo: '', otherInfo: '' };
        }

        // Format the materials, sizeInfo, and otherInfo as strings for the frontend
        const formattedResponse = {
            description: parsedResponse.description || '',
            materials: Object.entries(parsedResponse.materials || {})
                .map(([key, value]) => `${key}: ${value}`)
                .join(', '),
            sizeInfo: Object.entries(parsedResponse.sizeInfo?.Größentabelle || {})
                .map(([size, details]) => `${size}: ${Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(', ')}`)
                .join(' | '),
            otherInfo: [
                ...((parsedResponse.otherInfo?.certifications || []).map(c => `Certification: ${c}`)),
                `Care Instructions: ${parsedResponse.otherInfo?.careInstructions || ''}`,
                `Gender: ${parsedResponse.otherInfo?.gender || ''}`,
                ...(parsedResponse.otherInfo?.additionalDetails || [])
            ].join('. ')
        };

        return formattedResponse;
    } catch (error) {
        console.error('Error in parseProductDescription:', error);
        return { description: '', materials: '', sizeInfo: '', otherInfo: '' };
    }
}

// Product search and scraping endpoint
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
        
        // Navigate to search page
        await page.goto(`https://www.normani.de/search/?q=${barcode}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Handle cookie popup
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
            const cleanText = (selector) =>
                document.querySelector(selector)?.textContent?.trim() || '';

            return {
                title: cleanText('#pd-form > section > aside > div.pd-info.pd-group > div.page-title > h1'),
                sku: cleanText('#pd-form > section > aside > div.pd-attrs-container > table > tbody > tr > td:nth-child(2)'),
                description: cleanText('#collapse-pd-tabs-0 > div'),
                size: cleanText('.select2-selection__rendered'),
                imageUrl: document.querySelector('#pd-gallery img')?.src || '',
                productUrl: window.location.href
            };
        });

        // Parse the description using OpenAI GPT
        console.log('Parsing description using OpenAI GPT-3.5-Turbo...');
        productData.parsedDescription = await parseProductDescription(productData.description);
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
app.listen(port, 'localhost', () => {
    console.log(`Server running at http://localhost:${port}`);
});