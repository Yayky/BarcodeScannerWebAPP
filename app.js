document.addEventListener('DOMContentLoaded', function () {
    const serverUrl = window.location.origin;
    const scannerContainer = document.getElementById('scanner-container');
    const loadingIndicator = document.getElementById('loading');
    const startButton = document.getElementById('start-button');
    const scanAgainButton = document.getElementById('scan-again');
    const manualInputContainer = document.getElementById('manualInputContainer');
    const submitBarcode = document.getElementById('submitBarcode');
    const barcodeInput = document.getElementById('barcodeInput');
    const productInfo = document.getElementById('product-info');
    const productTitle = document.getElementById('product-title');
    const productDescription = document.getElementById('product-description');
    const productImage = document.getElementById('product-image');

    let isScanning = false;
    let lastScannedCode = null;
    let lastScanTime = 0;

    // Search for product using barcode
    async function searchProduct(barcode) {
        try {
            console.log(`Searching for barcode: ${barcode}`);
            loadingIndicator.classList.remove('d-none');
            productInfo.classList.add('d-none');

            const response = await fetch(`${serverUrl}/search/${barcode}`);
            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.error || responseData.details || 'Error fetching product data');
            }

            // Update product information
            let formattedText = responseData.data
                .replace(/<br\/?>/g, '\n') // Convert <br> tags to newlines
                .split('\n')
                .map(line => line.trim())
                .filter(line => line)
                .join('\n');

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = formattedText;

            productTitle.textContent = ''; // Add title formatting if needed
            productDescription.style.whiteSpace = 'pre-line';
            productDescription.innerHTML = tempDiv.innerHTML;

            productImage.style.display = 'none'; // Hide product image if unavailable

            loadingIndicator.classList.add('d-none');
            productInfo.classList.remove('d-none');
        } catch (error) {
            console.error('Error searching for product:', error);
            alert(error.message);
            loadingIndicator.classList.add('d-none');
        }
    }

    // Automatically search when 13 digits are entered
    barcodeInput.addEventListener('input', function () {
        const barcode = barcodeInput.value.trim();
        if (barcode.length === 13) {
            searchProduct(barcode);
            barcodeInput.value = ''; // Clear the input field after submission
        }
    });

    // Manual search button
    submitBarcode.addEventListener('click', function () {
        const barcode = barcodeInput.value.trim();
        if (barcode) {
            searchProduct(barcode);
            barcodeInput.value = ''; // Clear the input field after submission
        }
    });

    barcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitBarcode.click();
        }
    });

    // Initialize scanner
    async function initScanner() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });

            stream.getTracks().forEach(track => track.stop());

            Quagga.init({
                inputStream: {
                    type: "LiveStream",
                    constraints: {
                        width: 640,
                        height: 480,
                        facingMode: "environment" // or "user" for front-facing
                    },
                    target: document.querySelector('#interactive') // Ensure this targets the correct element
                },
                decoder: {
                    readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "code_39_vin_reader", "codabar_reader", "upc_reader", "upc_e_reader", "i2of5_reader"]
                }
            }, function (err) {
                if (err) {
                    console.log(err);
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

// Handle barcode detection
Quagga.onDetected(function (result) {
    const code = result.codeResult.code;
    const currentTime = new Date().getTime();

    // Debounce to prevent rapid consecutive detections
    if (currentTime - lastScanTime < 2500) { // Adjust debounce time as needed
        return;
    }

    if (code !== lastScannedCode) {
        console.log("Detected barcode:", code);
        lastScannedCode = code;
        lastScanTime = currentTime;
        searchProduct(code);
    }else {
        consecutiveDetections++;
        if (consecutiveDetections >= 3) {
            console.log("Detected barcode:", code);
            lastScannedCode = code;
            lastScanTime = currentTime;
            searchProduct(code);
            consecutiveDetections = 0;
        }
    }
});

    // Add event listener to the Start Scanner button
    document.getElementById('start-button').addEventListener('click', function() {
        Quagga.init({
            inputStream: {
                type: "LiveStream",
                constraints: {
                    width: 640,
                    height: 480,
                    facingMode: "environment" // or "user" for front-facing
                },
                area: { // defines rectangle of the detection/localization area
                    top: "0%",    // top offset
                    right: "0%",  // right offset
                    left: "0%",   // left offset
                    bottom: "0%"  // bottom offset
                },
                target: document.querySelector('#interactive') // Ensure this targets the correct element
            },
            decoder: {
                readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "code_39_vin_reader", "codabar_reader", "upc_reader", "upc_e_reader", "i2of5_reader"]
            }
        }, function(err) {
            if (err) {
                console.log(err);
                return;
            }
            Quagga.start();
        });
    });

    // Event Listeners
    startButton.addEventListener('click', async () => {
        startButton.classList.add('d-none');
        const success = await initScanner();
        if (!success) {
            startButton.classList.remove('d-none');
            scannerContainer.classList.add('d-none');
        }
    });
    // Reset scanner and clear data
    scanAgainButton.addEventListener('click', () => {
        productInfo.classList.add('d-none');
        scanAgainButton.classList.add('d-none');
        startButton.classList.remove('d-none');
        lastScannedCode = null;
        lastScanTime = 0;
    });
});
