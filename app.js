document.addEventListener('DOMContentLoaded', function () {
    const serverUrl = window.location.origin;

    // UI Elements
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

    let html5QrcodeScanner = null;
    let isScanning = false;

    // Success callback for the scanner
    function onScanSuccess(decodedText) {
        if (!isScanning) return; // Prevent multiple scans
        isScanning = false;
        html5QrcodeScanner.pause();

        console.log(`Barcode detected: ${decodedText}`);
        searchProduct(decodedText);
    }

    // Error callback for the scanner
    function onScanError(error) {
        console.warn(`QR error: ${error}`);
    }

    // Initialize the scanner
    async function initScanner() {
        try {
            if (html5QrcodeScanner) {
                await html5QrcodeScanner.clear();
            }

            html5QrcodeScanner = new Html5QrcodeScanner(
                "reader",
                {
                    fps: 10,
                    qrbox: { width: 250, height: 150 },
                    aspectRatio: 1.777778,
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.CODE_39
                    ]
                }
            );

            html5QrcodeScanner.render(onScanSuccess, onScanError);
            isScanning = true;
            return true;
        } catch (error) {
            console.error("Scanner initialization error:", error);
            alert("Unable to start the scanner. Please check your camera permissions or browser settings.");
            return false;
        }
    }

    // Update product information in the UI
    function updateProductInfo(data) {
        const productTitle = document.getElementById('product-title');
        const productSize = document.getElementById('product-size');
        const productSku = document.getElementById('product-sku');
        const descriptionContent = document.getElementById('description-content');
        const materialContent = document.getElementById('material-content');
        const otherInfoContent = document.getElementById('otherInfo-content');
        const sizeTableContent = document.getElementById('sizeTable-content');
        const productImage = document.getElementById('product-image');
        const productUrl = document.getElementById('product-url');

         console.log('Parsed Data in updateProductInfo:', data.productData); // Debug log

        if (data.productData) {
            const pd = data.productData;

            // Set product title
            productTitle.textContent = pd.title || 'Product Information';

            // Set size if available
            productSize.textContent = pd.size || '';
            productSize.style.display = pd.size ? 'block' : 'none';

            // Set SKU
            productSku.textContent = pd.sku ? `SKU: ${pd.sku}` : '';
            productSku.style.display = pd.sku ? 'block' : 'none';

            // Set product image
            if (pd.imageUrl) {
                productImage.src = pd.imageUrl;
                productImage.style.display = 'block';
            } else {
                productImage.style.display = 'none';
            }

            // Set product URL
            if (pd.productUrl) {
                productUrl.href = pd.productUrl;
                productUrl.style.display = 'block';
            } else {
                productUrl.style.display = 'none';
            }

            if (pd.parsedDescription) {
                const parsedDesc = pd.parsedDescription;

                // Description section
                if (parsedDesc.description) {
                    descriptionContent.innerHTML = `<p>${parsedDesc.description}</p>`;
                    document.getElementById('descriptionCollapse').classList.add('show');
                } else {
                    descriptionContent.innerHTML = '';
                }

                // Materials section
                if (parsedDesc.materials) {
                    materialContent.innerHTML = `<p>${parsedDesc.materials}</p>`;
                    document.getElementById('materialsCollapse').classList.remove('collapse');
                } else {
                    materialContent.innerHTML = '';
                    document.getElementById('materialsCollapse').classList.add('collapse');
                }

                // Additional info section
                if (parsedDesc.otherInfo) {
                    otherInfoContent.innerHTML = `<p>${parsedDesc.otherInfo}</p>`;
                    document.getElementById('additionalCollapse').classList.remove('collapse');
                } else {
                    otherInfoContent.innerHTML = '';
                    document.getElementById('additionalCollapse').classList.add('collapse');
                }

                // Size table section
                if (parsedDesc.sizeInfo) {
                    sizeTableContent.innerHTML = `<p>${parsedDesc.sizeInfo}</p>`;
                    document.getElementById('sizeTableCollapse').classList.remove('collapse');
                } else {
                    sizeTableContent.innerHTML = '';
                    document.getElementById('sizeTableCollapse').classList.add('collapse');
                }
            }
        }

        // Show the product info card and scan again button
        productInfo.classList.remove('d-none');
        scanAgainButton.classList.remove('d-none');
        startButton.classList.add('d-none');
        scannerContainer.classList.add('d-none');
    }

    // Search for product using barcode
    async function searchProduct(barcode) {
        try {
            loadingIndicator.classList.remove('d-none');
            scannerContainer.classList.add('d-none');
    
            const response = await fetch(`${serverUrl}/search/${barcode}`);
            if (!response.ok) {
                throw new Error('Product not found');
            }
    
            const data = await response.json();
            console.log('Product Data Received:', data); // Debug log to verify backend response
            updateProductInfo(data);
        } catch (error) {
            console.error('Error:', error);
            alert('Unable to find product information. Please try again.');
            resetUI();
        } finally {
            loadingIndicator.classList.add('d-none');
        }
    }
    

    // Reset UI
    function resetUI() {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.resume();
        }
        isScanning = true;
        productInfo.classList.add('d-none');
        scanAgainButton.classList.add('d-none');
        startButton.classList.remove('d-none');
        scannerContainer.classList.remove('d-none');
        loadingIndicator.classList.add('d-none');
    }

    // Event Listeners
    startButton.addEventListener('click', async () => {
        const success = await initScanner();
        if (success) {
            startButton.classList.add('d-none');
            scannerContainer.classList.remove('d-none');
        }
    });

    scanAgainButton.addEventListener('click', () => {
        resetUI();
    });

    // Toggle between scan and manual input
    scanButton.addEventListener('click', () => {
        scanButton.classList.add('btn-primary');
        scanButton.classList.remove('btn-secondary');
        manualButton.classList.add('btn-secondary');
        manualButton.classList.remove('btn-primary');

        manualInputContainer.classList.add('d-none');
        startButton.classList.remove('d-none');
        if (isScanning) {
            scannerContainer.classList.remove('d-none');
        }
    });

    manualButton.addEventListener('click', () => {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.pause();
        }

        manualButton.classList.add('btn-primary');
        manualButton.classList.remove('btn-secondary');
        scanButton.classList.add('btn-secondary');
        scanButton.classList.remove('btn-primary');

        scannerContainer.classList.add('d-none');
        startButton.classList.add('d-none');
        manualInputContainer.classList.remove('d-none');
    });

    // Manual barcode input
    submitBarcode.addEventListener('click', () => {
        const barcode = barcodeInput.value.trim();
        if (barcode) {
            searchProduct(barcode);
            barcodeInput.value = '';
        } else {
            alert('Please enter a valid barcode');
        }
    });

    // Initialize with scan mode
    scanButton.click();
});
