const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const port = 3000;

// Configure fetch options
const fetchOptions = {
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
    }
};

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Product search endpoint
app.get('/search/:barcode', async (req, res) => {
    const { barcode } = req.params;
    console.log(`Searching for barcode: ${barcode}`);

    try {
        const apiUrl = `http://dynamic.normani.de/BarcodeQuery/${barcode}`;
        console.log(`Fetching from API: ${apiUrl}`);

        const response = await fetch(apiUrl, fetchOptions);
        console.log(`API Response status: ${response.status}`);

        if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
        }

        const text = await response.text();
        console.log('Raw response:', text);

        // Simply return the raw text data
        res.json({ data: text });
    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            code: error.code
        });
        
        res.status(500).json({ 
            error: 'Unable to fetch data',
            details: error.message
        });
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