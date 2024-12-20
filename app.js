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
    let consecutiveDetections = 0;

    // Initialize scanner
    async function initScanner() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });
            
            stream.getTracks().forEach(track => track.stop());

            // Initialize Quagga with the correct configuration
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

    // Function to restart the scanner
    function restartScanner() {
        Quagga.start();
        isScanning = true;
        scannerContainer.classList.remove('d-none');
    }

    // Function to restart the scanner immediately
    function restartScannerImmediately() {
        Quagga.start(); // Restart Quagga for continuous scanning
        isScanning = true;
    }

    // Search for product using barcode
    async function searchProduct(barcode) {
        try {
            loadingIndicator.classList.remove('d-none');
            productInfo.classList.add('d-none');
    
            console.log('Searching for barcode:', barcode);
            const response = await fetch(`${serverUrl}/search/${barcode}`);
            const responseData = await response.json();
            
            if (!response.ok) {
                throw new Error(responseData.error || responseData.details || 'Error fetching product data');
            }
    
            // Update product information
            const productDescription = document.getElementById('product-description');
            let formattedText = responseData.data
                .replace(/<br\/?>/g, '\n') // Convert <br> tags to newlines
                .split('\n')
                .map(line => line.trim())
                .filter(line => line)
                .join('\n');
    
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = formattedText;
    
            productDescription.style.whiteSpace = 'pre-line';
            productDescription.innerHTML = tempDiv.innerHTML;
    
            document.getElementById('product-title').textContent = '';
            document.getElementById('product-sku').textContent = '';
            document.getElementById('product-price').textContent = '';
    
            const productImage = document.getElementById('product-image');
            productImage.style.display = 'none';
    
            loadingIndicator.classList.add('d-none');
            productInfo.classList.remove('d-none');
        } catch (error) {
            console.error('Error searching for product:', error);
            alert(error.message);
            loadingIndicator.classList.add('d-none');
        }
    }
    

    // Function to ensure the video element remains visible
    function ensureVideoVisibility() {
        const videoElement = document.querySelector('#interactive video');
        if (videoElement) {
            videoElement.style.display = 'block'; // Ensure video is visible
            videoElement.style.visibility = 'visible'; // Ensure video is visible
            videoElement.style.opacity = '1'; // Ensure video is opaque
        }
    }

    // Set an interval to continuously ensure video visibility
    setInterval(ensureVideoVisibility, 1000); // Check every second

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
            // manualInputContainer.classList.add('d-none');
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