document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const scanButton = document.getElementById('scanButton');
    const manualButton = document.getElementById('manualButton');
    const scanAgainButton = document.getElementById('scan-again');
    const scannerContainer = document.getElementById('scanner-container');
    const productInfo = document.getElementById('product-info');
    const loadingIndicator = document.getElementById('loading');
    const manualInputContainer = document.getElementById('manualInputContainer');
    const barcodeInput = document.getElementById('barcodeInput');
    const submitBarcode = document.getElementById('submitBarcode');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const progressBar = document.getElementById('search-progress');
    const progressText = document.getElementById('progress-text');
    const progressStatus = document.getElementById('progress-status');
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const result = document.getElementById('result');
    const manualInput = document.getElementById('manualInput');
    const submitManual = document.getElementById('submitManual');
    const productTitle = document.getElementById('productTitle');
    const productDetails = document.getElementById('productDetails');

    let isScanning = false;
    let lastResult = null;
    let lastTime = Date.now();
    let stream = null;

    // Initialize Quagga
    function initQuagga() {
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: video,
                constraints: {
                    facingMode: "environment",
                    width: { min: 640 },
                    height: { min: 480 },
                    aspectRatio: { min: 1, max: 2 }
                }
            },
            locator: {
                patchSize: "medium",
                halfSample: true
            },
            numOfWorkers: 2,
            decoder: {
                readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader"]
            },
            locate: true
        }, function(err) {
            if (err) {
                console.error('Quagga initialization failed:', err);
                alert('Failed to initialize camera. Please check permissions and try again.');
                return;
            }
            isScanning = true;
            Quagga.start();
        });

        // Barcode detected
        Quagga.onDetected(function(result) {
            const now = Date.now();
            if (lastResult === result.codeResult.code && now - lastTime < 2000) {
                return; // Debounce duplicate scans
            }
            
            lastResult = result.codeResult.code;
            lastTime = now;
            
            // Highlight successful scan
            canvas.style.border = "3px solid #28a745";
            setTimeout(() => canvas.style.border = "", 500);

            // Search for the product
            searchProduct(result.codeResult.code);
        });

        // Draw detection result
        Quagga.onProcessed(function(result) {
            const drawingCtx = canvas.getContext("2d");
            if (result) {
                if (result.boxes) {
                    drawingCtx.clearRect(0, 0, canvas.width, canvas.height);
                    result.boxes.filter(box => box !== result.box).forEach(box => {
                        drawingCtx.strokeStyle = "#f00";
                        drawingCtx.strokeRect(box.x, box.y, box.width, box.height);
                    });
                }

                if (result.box) {
                    drawingCtx.strokeStyle = "#00f";
                    drawingCtx.strokeRect(
                        result.box.x, result.box.y,
                        result.box.width, result.box.height
                    );
                }
            }
        });
    }

    // Stop Quagga
    function stopQuagga() {
        if (isScanning) {
            Quagga.stop();
            isScanning = false;
        }
    }

    // Progress bar functions
    function updateProgress(percent, text, status) {
        progressBar.style.width = `${percent}%`;
        progressBar.setAttribute('aria-valuenow', percent);
        if (text) progressText.textContent = text;
        if (status) progressStatus.textContent = status;
    }

    function resetProgress() {
        updateProgress(0, 'Initializing search...', 'Starting product search...');
    }

    // Start camera
    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            video.srcObject = stream;
            startButton.style.display = 'none';
            stopButton.style.display = 'inline-block';
            result.style.display = 'block';
        } catch (err) {
            console.error('Error accessing camera:', err);
            result.textContent = 'Error accessing camera. Please check permissions.';
            result.style.display = 'block';
        }
    }

    // Stop camera
    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
            startButton.style.display = 'inline-block';
            stopButton.style.display = 'none';
            result.style.display = 'none';
        }
    }

    // Search for product
    async function searchProduct(barcode) {
        try {
            stopQuagga();
            scannerContainer.classList.add('d-none');
            loadingIndicator.classList.remove('d-none');
            productInfo.classList.add('d-none');
            resetProgress();

            updateProgress(30, 'Searching for product...', 'Querying database...');
            const response = await fetch(`/search/${barcode}`);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            updateProgress(60, 'Product found!', 'Processing product information...');
            await new Promise(resolve => setTimeout(resolve, 500)); // Visual feedback

            if (!data.productData) {
                throw new Error('No product data received from server');
            }

            updateProgress(90, 'Loading product details...', 'Almost there...');
            await new Promise(resolve => setTimeout(resolve, 500)); // Visual feedback

            updateProductInfo(data.productData);
            updateProgress(100, 'Complete!', 'Product information loaded');
            
            await new Promise(resolve => setTimeout(resolve, 500)); // Show completion
            productInfo.classList.remove('d-none');

        } catch (error) {
            console.error('Error searching for product:', error);
            updateProgress(100, 'Error', `Error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            alert(`Error searching for product: ${error.message}\nPlease try scanning again.`);
            
            scannerContainer.classList.remove('d-none');
            if (!isScanning) {
                initQuagga();
            }
        } finally {
            setTimeout(() => {
                loadingIndicator.classList.add('d-none');
                resetProgress();
            }, 500);
        }
    }

    // Update product information in the UI
    function updateProductInfo(data) {
        document.getElementById('product-title').textContent = data.title || 'No title available';
        document.getElementById('product-sku').textContent = data.sku || 'No SKU available';
        document.getElementById('product-size').textContent = data.size || 'No size available';
        
        const productImage = document.getElementById('product-image');
        if (data.imageUrl) {
            productImage.src = data.imageUrl;
            productImage.classList.remove('d-none');
        } else {
            productImage.classList.add('d-none');
        }

        // Update description sections
        if (data.parsedDescription) {
            document.getElementById('general-description').innerHTML = data.parsedDescription.generalDescription || 'No description available';
            document.getElementById('material-info').innerHTML = data.parsedDescription.materialInfo || 'No material information available';
            document.getElementById('additional-details').innerHTML = data.parsedDescription.additionalDetails || 'No additional details available';
            document.getElementById('size-table').innerHTML = data.parsedDescription.sizeTable || 'No size table available';
        }

        if (data.productUrl) {
            const productLink = document.getElementById('product-link');
            productLink.href = data.productUrl;
            productLink.classList.remove('d-none');
        }
    }

    // Display product information
    function displayProduct(data) {
        productTitle.textContent = data.title;
        productDetails.innerHTML = `
            <p><strong>SKU:</strong> ${data.sku}</p>
            <p><strong>Size:</strong> ${data.size}</p>
            <p><strong>Description:</strong> ${data.parsedDescription.generalDescription}</p>
            <p><strong>Material:</strong> ${data.parsedDescription.materialInfo}</p>
            <a href="${data.productUrl}" target="_blank" class="btn btn-primary">View on Website</a>
        `;
        productInfo.style.display = 'block';
        result.style.display = 'none';
    }

    // Event Listeners
    scanButton.addEventListener('click', () => {
        manualInputContainer.classList.add('d-none');
        scannerContainer.classList.remove('d-none');
        productInfo.classList.add('d-none');
        scanButton.classList.add('btn-primary');
        scanButton.classList.remove('btn-secondary');
        manualButton.classList.add('btn-secondary');
        manualButton.classList.remove('btn-primary');
        initQuagga();
    });

    manualButton.addEventListener('click', () => {
        stopQuagga();
        scannerContainer.classList.add('d-none');
        manualButton.classList.add('btn-primary');
        manualButton.classList.remove('btn-secondary');
        scanButton.classList.add('btn-secondary');
        scanButton.classList.remove('btn-primary');
        manualInputContainer.classList.remove('d-none');
    });

    scanAgainButton.addEventListener('click', () => {
        productInfo.classList.add('d-none');
        scannerContainer.classList.remove('d-none');
        initQuagga();
    });

    submitBarcode.addEventListener('click', () => {
        const barcode = barcodeInput.value.trim();
        if (!barcode) {
            alert('Please enter a barcode');
            return;
        }
        searchProduct(barcode);
    });

    startButton.addEventListener('click', startCamera);
    stopButton.addEventListener('click', stopCamera);

    submitManual.addEventListener('click', () => {
        const barcode = manualInput.value.trim();
        if (barcode) {
            searchProduct(barcode);
        } else {
            result.textContent = 'Please enter a barcode';
            result.style.display = 'block';
        }
    });

    // Handle manual input Enter key
    manualInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitManual.click();
        }
    });

    barcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitBarcode.click();
        }
    });
});
