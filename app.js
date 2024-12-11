document.addEventListener('DOMContentLoaded', function () {
    const serverUrl = window.location.origin;
    const scannerContainer = document.getElementById('scanner-container');
    const loadingIndicator = document.getElementById('loading');
    const startButton = document.getElementById('start-button');
    const scanAgainButton = document.getElementById('scan-again');
    const manualButton = document.getElementById('manualButton');
    const manualInputContainer = document.getElementById('manualInputContainer');
    const submitBarcode = document.getElementById('submitBarcode');
    const barcodeInput = document.getElementById('barcodeInput');
    const productInfo = document.getElementById('product-info');

    let isScanning = false;
    let lastScannedCode = null;
    let lastScanTime = 0;

    // Initialize scanner
    async function initScanner() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });
            
            stream.getTracks().forEach(track => track.stop());

            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: document.querySelector("#interactive"),
                    constraints: {
                        facingMode: "environment"
                    },
                },
                locator: {
                    patchSize: "medium",
                    halfSample: true
                },
                numOfWorkers: navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4) : 2,
                decoder: {
                    readers: [
                        "ean_reader",
                        "ean_8_reader",
                        "upc_reader",
                        "upc_e_reader"
                    ]
                },
                locate: true
            }, function(err) {
                if (err) {
                    console.error("Quagga initialization error:", err);
                    alert("Unable to start the scanner. Please check your camera permissions or browser settings.");
                    startButton.classList.remove('d-none');
                    scannerContainer.classList.add('d-none');
                    return;
                }
                console.log("Quagga initialization succeeded");
                Quagga.start();
                isScanning = true;
                scannerContainer.classList.remove('d-none');
            });

            return true;
        } catch (error) {
            console.error("Camera permission error:", error);
            alert("Camera permissions are required to use the scanner. Please allow access in your browser settings.");
            return false;
        }
    }

    // Search for product using barcode
    async function searchProduct(barcode) {
        try {
            if (isScanning) {
                scannerContainer.classList.add('d-none');
            }
            loadingIndicator.classList.remove('d-none');
            startButton.classList.add('d-none');
            scanAgainButton.classList.add('d-none');
            productInfo.classList.add('d-none');

            console.log('Searching for barcode:', barcode);
            const response = await fetch(`${serverUrl}/search/${barcode}`);
            const responseData = await response.json();
            
            if (!response.ok) {
                throw new Error(responseData.error || responseData.details || 'Error fetching product data');
            }

            // Get the product description element
            const productDescription = document.getElementById('product-description');
            
            // Convert <br/> to newlines and preserve bold tags
            let formattedText = responseData.data
                .replace(/<br\/?>/g, '\n')  // Convert <br/> to newline
                .split('\n')                // Split into lines
                .map(line => line.trim())   // Trim each line
                .filter(line => line)       // Remove empty lines
                .join('\n');                // Join with newlines

            // Create a temporary div to handle HTML content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = formattedText;
            
            // Style the text with proper spacing and preserve bold
            productDescription.style.whiteSpace = 'pre-line';  // Preserve line breaks
            productDescription.innerHTML = tempDiv.innerHTML;   // Use innerHTML to preserve bold tags

            // Clear other fields
            document.getElementById('product-title').textContent = '';
            document.getElementById('product-sku').textContent = '';
            document.getElementById('product-price').textContent = '';
            
            const productImage = document.getElementById('product-image');
            productImage.style.display = 'none'; // Hide the image

            loadingIndicator.classList.add('d-none');
            productInfo.classList.remove('d-none');
            scanAgainButton.classList.remove('d-none');
        } catch (error) {
            console.error('Error searching for product:', error);
            alert(error.message);
            loadingIndicator.classList.add('d-none');
            if (isScanning) {
                scannerContainer.classList.remove('d-none');
            }
            startButton.classList.remove('d-none');
        }
    }

    // Handle barcode detection
    Quagga.onDetected(function (result) {
        const code = result.codeResult.code;
        const currentTime = new Date().getTime();

        // Debounce scanning to prevent multiple rapid scans
        if (currentTime - lastScanTime < 2000) {
            return;
        }

        if (code !== lastScannedCode) {
            console.log("Detected barcode:", code);
            lastScannedCode = code;
            lastScanTime = currentTime;
            
            if (isScanning) {
                Quagga.stop();
                isScanning = false;
                searchProduct(code);
            }
        }
    });

    // Event Listeners
    startButton.addEventListener('click', async () => {
        startButton.classList.add('d-none');
        manualInputContainer.classList.add('d-none');
        const success = await initScanner();
        if (!success) {
            startButton.classList.remove('d-none');
            scannerContainer.classList.add('d-none');
        }
    });

    scanAgainButton.addEventListener('click', () => {
        productInfo.classList.add('d-none');
        scanAgainButton.classList.add('d-none');
        startButton.classList.remove('d-none');
        manualInputContainer.classList.remove('d-none');
        lastScannedCode = null;
        lastScanTime = 0;
    });

    manualButton.addEventListener('click', () => {
        if (isScanning) {
            Quagga.stop();
            isScanning = false;
        }
        scannerContainer.classList.add('d-none');
        manualInputContainer.classList.remove('d-none');
        startButton.classList.add('d-none');
    });

    submitBarcode.addEventListener('click', () => {
        const barcode = barcodeInput.value.trim();
        if (barcode) {
            searchProduct(barcode);
            barcodeInput.value = '';
            manualInputContainer.classList.add('d-none');
        } else {
            alert('Please enter a valid barcode.');
        }
    });

    barcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitBarcode.click();
        }
    });

    // Show manual input by default
    manualInputContainer.classList.remove('d-none');
});