document.addEventListener('DOMContentLoaded', function () {
    const serverUrl = window.location.origin;

    const startButton = document.getElementById('start-button');
    const scanAgainButton = document.getElementById('scan-again');
    const scannerContainer = document.getElementById('scanner-container');
    const productInfo = document.getElementById('product-info');
    const loadingIndicator = document.getElementById('loading');
    const manualInputContainer = document.getElementById('manualInputContainer');
    const barcodeInput = document.getElementById('barcodeInput');
    const submitBarcode = document.getElementById('submitBarcode');
    const scanButton = document.getElementById('scanButton');
    const manualButton = document.getElementById('manualButton');

    let isScanning = false;
    let barcodeFrequency = {};
    let frequencyThreshold = 3;
    let lastScannedCode = null;
    let lastScanTime = 0;

    // Request camera permission
    async function requestCameraPermission() {
        console.log("Requesting camera permission...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment", // Use rear camera if available
                },
            });
            console.log("Camera permission granted.");
            stream.getTracks().forEach((track) => track.stop()); // Stop camera immediately after permissions
            return true; // Permissions granted
        } catch (error) {
            console.error("Camera permission error:", error);
            alert("Camera permissions are required to use the scanner. Please allow access in your browser settings.");
            return false; // Permissions denied
        }
    }

    // Initialize Quagga with camera constraints
    async function initQuaggaWithCamera(constraints) {
        try {
            await Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: document.querySelector("#interactive"),
                    constraints: constraints,
                },
                decoder: {
                    readers: [
                        "ean_reader",
                        "ean_8_reader",
                        "upc_reader",
                        "upc_e_reader",
                        "code_128_reader",
                        "code_39_reader",
                    ],
                },
                locate: true,
            });

            Quagga.start();
            isScanning = true;
            return true;
        } catch (error) {
            console.error('Quagga initialization error:', error);
            return false;
        }
    }

    // Initialize scanner with camera selection
    async function initScanner() {
        const constraints = {
            facingMode: "environment", // Use rear camera
        };
    
        try {
            await Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: document.querySelector("#interactive"), // Ensure this element exists
                    constraints: constraints,
                },
                decoder: {
                    readers: [
                        "ean_reader",
                        "ean_8_reader",
                        // Add any other readers you need
                    ],
                },
            }, (err) => {
                if (err) {
                    console.error("Quagga initialization error:", err);
                    return;
                }
                console.log("Quagga initialized successfully.");
                Quagga.start(); // Start the scanning process
            });
        } catch (error) {
            console.error("Error during Quagga initialization:", error);
        }
    }

    // Handle barcode detection
    Quagga.onDetected(function (result) {
        const code = result.codeResult.code;
        const currentTime = new Date().getTime();

        if (code !== lastScannedCode || currentTime - lastScanTime > 5000) {
            barcodeFrequency = {};
            lastScannedCode = code;
        }

        lastScanTime = currentTime;
        barcodeFrequency[code] = (barcodeFrequency[code] || 0) + 1;

        if (barcodeFrequency[code] >= frequencyThreshold) {
            if (isScanning) {
                Quagga.stop();
                isScanning = false;
            }

            searchProduct(code);
            barcodeFrequency = {};
        }
    });

    // Update product information in the UI
    function updateProductInfo(data) {
        document.getElementById('product-title').textContent = data.title;
        document.getElementById('product-sku').textContent = data.sku;
        document.getElementById('product-size').textContent = data.size;

        const updateSection = (elementId, content) => {
            const element = document.getElementById(elementId);
            element.innerHTML = content ? content.replace(/\n/g, '<br>') : 'No information available';
        };

        updateSection('description-content', data.parsedDescription.description);
        updateSection('material-content', data.parsedDescription.material);
        updateSection('otherInfo-content', data.parsedDescription.otherInfo);
        updateSection('sizeTable-content', data.parsedDescription.sizeTable);

        const productImage = document.getElementById('product-image');
        if (data.imageUrl) {
            productImage.src = data.imageUrl;
            productImage.style.display = 'block';
        } else {
            productImage.style.display = 'none';
        }

        const productLink = document.getElementById('product-url').querySelector('a');
        if (data.productUrl) {
            productLink.href = data.productUrl;
            productLink.style.display = 'inline-block';
        } else {
            productLink.style.display = 'none';
        }

        loadingIndicator.classList.add('d-none');
        productInfo.classList.remove('d-none');
    }

    // Search for product using barcode
    async function searchProduct(barcode) {
        try {
            scannerContainer.classList.add('d-none');
            loadingIndicator.classList.remove('d-none');
            productInfo.classList.add('d-none');

            const response = await fetch(`${serverUrl}/search/${barcode}`);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            updateProductInfo(data.productData);
        } catch (error) {
            console.error('Error searching for product:', error);
            alert('Error searching for product. Please try again.');
        } finally {
            loadingIndicator.classList.add('d-none');
        }
    }

    // Reset UI
    function resetUI() {
        productInfo.classList.add('d-none');
        loadingIndicator.classList.add('d-none');
        scannerContainer.classList.remove('d-none');
        startButton.classList.remove('d-none');
        scanAgainButton.classList.add('d-none');
        if (isScanning) {
            Quagga.stop();
            isScanning = false;
        }
    }

    // Event Listeners
    startButton.addEventListener('click', async () => {
        const permissionGranted = await requestCameraPermission();
        if (permissionGranted) {
            const success = await initScanner();
            if (!success) {
                // Handle scanner initialization failure
            }
        }
    });

    scanAgainButton.addEventListener('click', () => {
        resetUI();
        initScanner();
    });

    // Toggle between scan and manual input
    scanButton.addEventListener('click', () => {
        scannerContainer.classList.remove('d-none');
        manualInputContainer.classList.add('d-none');
    });

    manualButton.addEventListener('click', () => {
        scannerContainer.classList.add('d-none');
        manualInputContainer.classList.remove('d-none');
    });

    // Handle manual barcode input submission
    submitBarcode.addEventListener('click', async () => {
        const barcode = barcodeInput.value.trim();
        if (barcode) {
            await searchProduct(barcode);
        } else {
            alert('Please enter a barcode.');
        }
    });

    barcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitBarcode.click();
        }
    });
});
