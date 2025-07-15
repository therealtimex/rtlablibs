// Application state with enhanced purchase tracking
let appState = {
	products: [],
	purchasedProducts: new Set(),
	purchaseDetails: new Map(), // Store detailed purchase information
	isLoading: false,
	lastPurchaseHistoryUpdate: null
};

// Product IDs to load
const productIds = "['com.realtimex.af.appjtzfi.onehour','com.realtimex.af.appjtzfi.oneday','com.realtimex.af.appjtzfi.premium1']";
// Initialize the application
function initializeApp() {
	updateBridgeStatus();
	loadProducts();
	// Check purchase status on startup
	setTimeout(() => {
		checkPurchaseStatus();
	}, 1000);
}

// Update bridge connection status
function updateBridgeStatus() {
	const statusElement = document.getElementById('bridge-status');
	const statusText = document.getElementById('bridge-status-text');

	if (window.AppPurchase) {
		statusText.textContent = 'Connected';
		statusElement.className = 'bridge-status connected';
	} else {
		statusText.textContent = 'Not Available';
		statusElement.className = 'bridge-status error';
		showError('AppPurchase bridge is not available. Make sure you are running in the native app.');
	}
}

// Load products from App Store
function loadProducts() {
	if (!window.AppPurchase) {
		showError('AppPurchase bridge not available');
		return;
	}

	appState.isLoading = true;
	updateProductsDisplay();

	window.AppPurchase.getProducts(productIds, 'onProductsLoaded');
}

// Callback for products loaded
window.onProductsLoaded = function(result) {
	appState.isLoading = false;

	if (result && result.products) {
		appState.products = result.products;
		updateProductsDisplay();
		updateAllPrintButtons();
	} else {
		showError('Failed to load products: Invalid response format');
	}
};

// Purchase a product
function purchaseProduct(productId) {
	if (!window.AppPurchase) {
		showError('AppPurchase bridge not available');
		return;
	}

	window.AppPurchase.purchaseProduct(productId, 'onPurchaseComplete');
}

// Callback for purchase completion
window.onPurchaseComplete = function(result) {
	if (result.success) {
		// Update purchase status immediately
		appState.purchasedProducts.add(result.productId);

		// Store purchase details
		appState.purchaseDetails.set(result.productId, {
			transactionId: result.transactionId,
			purchaseDate: new Date().toISOString(),
			purchaseToken: result.purchaseToken
		});

		const product = appState.products.find(p => p.productId === result.productId);
		const productName = product ? product.title : result.productId;
		alert(`Successfully purchased ${productName}!`);

		updateProductsDisplay();
		updateAllPrintButtons();

		// Handle consumable products
		if (isConsumableProduct(result.productId) && result.purchaseToken) {
			window.AppPurchase.consumePurchase(result.purchaseToken, 'onConsumeComplete');
		}
	} else {
		alert(`Purchase failed: ${result.error || 'Unknown error'}`);
	}
};

// Callback for consume completion
window.onConsumeComplete = function(result) {
	if (result.success) {
		console.log('Purchase consumed successfully');
	} else {
		console.error('Failed to consume purchase:', result.error);
	}
};

// Enhanced restore purchases function
function restorePurchases() {
	if (!window.AppPurchase) {
		showError('AppPurchase bridge not available');
		return;
	}

	// Show loading state
	const restoreBtn = document.querySelector('button[onclick="restorePurchases()"]');
	const originalText = restoreBtn.textContent;
	restoreBtn.textContent = 'Restoring...';
	restoreBtn.disabled = true;

	// Show purchase history status
	showPurchaseHistoryStatus('Restoring purchases...', 'loading');

	// Set a timeout to handle cases where callback never fires
	const timeoutId = setTimeout(() => {
		restoreBtn.textContent = originalText;
		restoreBtn.disabled = false;
		showPurchaseHistoryStatus('Restore purchases timed out. Please try again.', 'error');
	}, 30000);

	// Store original callback and enhance it
	window.restoreTimeoutId = timeoutId;
	window.restoreOriginalText = originalText;

	window.AppPurchase.getPurchaseHistory('onPurchaseHistoryLoaded');
}

// Enhanced callback for purchase history with detailed status updates
window.onPurchaseHistoryLoaded = function(result) {
	console.log('Purchase history result:', result);

	// Clear timeout and restore button state
	if (window.restoreTimeoutId) {
		clearTimeout(window.restoreTimeoutId);
	}
	const restoreBtn = document.querySelector('button[onclick="restorePurchases()"]');
	if (restoreBtn && window.restoreOriginalText) {
		restoreBtn.textContent = window.restoreOriginalText;
		restoreBtn.disabled = false;
	}

	if (result && result.success) {
		// Clear existing purchase data
		appState.purchasedProducts.clear();
		appState.purchaseDetails.clear();

		if (result.purchases && result.purchases.length > 0) {
			// Process each purchase from history
			result.purchases.forEach(purchase => {
				console.log('Processing restored purchase:', purchase);

				// Add to purchased products set
				appState.purchasedProducts.add(purchase.productId);

				// Store detailed purchase information
				appState.purchaseDetails.set(purchase.productId, {
					transactionId: purchase.transactionId || 'restored',
					purchaseDate: purchase.purchaseDate || 'unknown',
					purchaseToken: purchase.purchaseToken || null,
					isRestored: true,
					isActive: purchase.isActive !== false // Default to true if not specified
				});
			});

			appState.lastPurchaseHistoryUpdate = new Date().toISOString();

			showPurchaseHistoryStatus(`Successfully restored ${result.purchases.length} purchase(s)!`, 'success');
			alert(`Successfully restored ${result.purchases.length} purchase(s)!`);
		} else {
			showPurchaseHistoryStatus('No purchases found to restore.', 'error');
			alert('No purchases found to restore. Make sure you\'re signed in with the correct Apple ID.');
		}

		// Update UI with restored purchase status
		updateProductsDisplay();
		updateAllPrintButtons();
	} else {
		console.error('Restore failed:', result);
		const errorMessage = result?.error || 'Unknown error. Please check your internet connection and Apple ID.';
		showPurchaseHistoryStatus(`Failed to restore purchases: ${errorMessage}`, 'error');
		alert(`Failed to restore purchases: ${errorMessage}`);
	}
};

// Show purchase history status
function showPurchaseHistoryStatus(message, type) {
	const statusElement = document.getElementById('purchase-history-status');
	const statusText = document.getElementById('purchase-history-text');

	statusText.textContent = message;
	statusElement.className = `purchase-history-status ${type}`;
	statusElement.style.display = 'block';

	// Auto-hide success messages after 5 seconds
	if (type === 'success') {
		setTimeout(() => {
			statusElement.style.display = 'none';
		}, 5000);
	}
}

// Check purchase status
function checkPurchaseStatus() {
	if (!window.AppPurchase) {
		return;
	}

	window.AppPurchase.getPurchaseStatus('onPurchaseStatusLoaded');
}

// Enhanced callback for purchase status
window.onPurchaseStatusLoaded = function(result) {
	console.log('Purchase status result:', result);

	if (result.error) {
		console.error("Status error:", result.error);
		showPurchaseHistoryStatus(`Status check failed: ${result.error}`, 'error');
		return;
	}

	// Update application state based on the latest status
	appState.purchasedProducts.clear();

	// Process owned products (non-consumables) and active subscriptions
	const allActivePurchases = new Set([
		...(result.ownedProducts || []),
		...(result.activeSubscriptions || [])
	]);

	allActivePurchases.forEach(productId => {
		appState.purchasedProducts.add(productId);
		const subDetails = result.subscriptionStatus ? result.subscriptionStatus[productId] : null;
		const existingDetails = appState.purchaseDetails.get(productId) || {};

		appState.purchaseDetails.set(productId, {
			...existingDetails,
			isActive: subDetails ? subDetails.active : true, // Assume active if present
			expiryTime: subDetails ? subDetails.expiryTime : null,
			autoRenewing: subDetails ? subDetails.autoRenewing : null,
			lastStatusCheck: new Date().toISOString()
		});
	});

	// The hasPremium flag is a quick check for premium access.
	// This ensures the UI reflects premium status even if the specific product ID changes.
	if (result.hasPremium) {
		const premiumProductId = 'com.realtimex.af.appjtzfi.premium1';
		if (!appState.purchasedProducts.has(premiumProductId)) {
			appState.purchasedProducts.add(premiumProductId);
		}
	}

	showPurchaseHistoryStatus('Purchase status updated successfully!', 'success');
	updateProductsDisplay();
	updateAllPrintButtons();
};

// Enhanced products display with detailed purchase status
function updateProductsDisplay() {
	const container = document.getElementById('products-container');

	if (appState.isLoading) {
		container.innerHTML = '<div class="loading">Loading products...</div>';
		return;
	}

	if (appState.products.length === 0) {
		container.innerHTML = '<div class="error-message">No products available</div>';
		return;
	}

	container.innerHTML = '';

	appState.products.forEach(product => {
		const isPurchased = appState.purchasedProducts.has(product.productId);
		const purchaseDetails = appState.purchaseDetails.get(product.productId);
		const productElement = document.createElement('div');

		// Add purchased class for styling
		productElement.className = isPurchased ? 'product-item purchased' : 'product-item';

		// Determine if this is the premium (non-consumable) product
		const isPremium = product.productId === 'com.realtimex.af.appjtzfi.premium1';
		const productType = isPremium ? 'premium' : 'consumable';

		// Build purchase details display
		let purchaseDetailsHtml = '';
		if (isPurchased && purchaseDetails) {
			const details = [];
			if (purchaseDetails.transactionId && purchaseDetails.transactionId !== 'restored') {
				details.push(`Transaction: ${purchaseDetails.transactionId.substring(0, 8)}...`);
			}
			if (purchaseDetails.purchaseDate && purchaseDetails.purchaseDate !== 'unknown') {
				const date = new Date(purchaseDetails.purchaseDate);
				details.push(`Date: ${date.toLocaleDateString()}`);
			}
			if (purchaseDetails.isRestored) {
				details.push('Restored from history');
			}

			if (details.length > 0) {
				purchaseDetailsHtml = `<div class="purchase-details">${details.join(' • ')}</div>`;
			}
		}

		productElement.innerHTML = `
                    <div class="product-info">
                        <div class="product-title">${product.title}</div>
                        <div class="product-id">${product.productId}</div>
                        <div class="product-type type-${productType}">
                            ${isPremium ? 'Premium (Non-Consumable)' : 'Consumable'}
                        </div>
                        <div class="product-price">${product.price}</div>
                        ${product.description ? `<div class="product-description">${product.description}</div>` : ''}
                        <div class="purchase-status ${isPurchased ? 'status-purchased' : 'status-not-purchased'}">
                            ${isPurchased ? '✓ Purchased' : '○ Not Purchased'}
                        </div>
                        ${purchaseDetailsHtml}
                    </div>
                    <button class="btn ${isPremium ? 'btn-premium' : ''} ${isPurchased && isPremium ? 'btn-success' : ''}" 
                            onclick="purchaseProduct('${product.productId}')"
                            ${isPurchased && isPremium ? 'disabled' : ''}>
                        ${isPurchased && isPremium ? 'Purchased' : 'Buy Now'}
                    </button>
                `;
		container.appendChild(productElement);
	});
}

// Update all print buttons based on purchase status
function updateAllPrintButtons() {
	updatePrintButton('onehour', 'com.realtimex.af.appjtzfi.onehour', 'Print Logs - One Hour');
	updatePrintButton('oneday', 'com.realtimex.af.appjtzfi.oneday', 'Print Logs - One Day');
	updatePrintButton('premium', 'com.realtimex.af.appjtzfi.premium1', 'Print Logs - Premium');
}

// Update individual print button status
function updatePrintButton(buttonType, productId, baseText) {
	const printBtn = document.getElementById(`print-btn-${buttonType}`);
	const hasPurchase = appState.purchasedProducts.has(productId);

	printBtn.disabled = !hasPurchase;
	printBtn.textContent = hasPurchase ? baseText : `${baseText} (Purchase Required)`;
}

// Check if product is consumable
function isConsumableProduct(productId) {
	return productId.includes('onehour') || productId.includes('oneday');
}

// Handle print functionality for specific product types
function handlePrint(type) {
	let productId, productName;

	switch (type) {
		case 'onehour':
			productId = 'com.realtimex.af.appjtzfi.onehour';
			productName = 'One Hour';
			break;
		case 'oneday':
			productId = 'com.realtimex.af.appjtzfi.oneday';
			productName = 'One Day';
			break;
		case 'premium':
			productId = 'com.realtimex.af.appjtzfi.premium1';
			productName = 'Premium';
			break;
		default:
			alert('Invalid print type');
			return;
	}

	if (appState.purchasedProducts.has(productId)) {
		alert(`Printing logs with ${productName} access... (Feature activated)`);
		window.print();
	} else {
		alert(`${productName} purchase required to enable this print functionality.`);
	}
}

// Show error message
function showError(message) {
	const container = document.getElementById('products-container');
	container.innerHTML = `<div class="error-message">${message}</div>`;
}

// Initialize app when page loads
window.addEventListener('load', initializeApp);

