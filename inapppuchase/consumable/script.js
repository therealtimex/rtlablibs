// Product IDs for different gem packages - String array format
const PRODUCT_IDS = "[\"com.realtimex.af.appjtzfi.gem1\",\"com.realtimex.af.appjtzfi.gem3\",\"com.realtimex.af.appjtzfi.gem10\"]";
// Simple session variables
let sessionGems = 0;
let totalGemsUsed = 0;
let totalGemsPurchased = 0;
const GEM_COST_PER_LOG = 1;

let availableProducts = {};
let isLoadingProducts = false;
let purchaseTokens = []; // Store purchase tokens for consumption

// Function to add gems (when purchased)
function addGems(amount, fromPurchase = false) {
	sessionGems += amount;
	if (fromPurchase) {
		totalGemsPurchased += amount;
	}
	updateGemDisplay();
	updateDebugInfo();
	showMessage(`${amount} gems added! Total: ${sessionGems}`, 'success');
}

// Function to use gems
function useGems(amount) {
	if (sessionGems >= amount) {
		sessionGems -= amount;
		totalGemsUsed += amount;
		updateGemDisplay();
		updateDebugInfo();
		return true;
	}
	return false;
}

// Update gem display
function updateGemDisplay() {
	const indicator = document.getElementById('gem-count-indicator');
	indicator.textContent = `${sessionGems} Gems`;
	indicator.className = sessionGems > 0 ? 'status-indicator status-premium' : 'status-indicator status-free';

	// Update status text
	document.getElementById('status-text').textContent =
		sessionGems > 0 ? `You have ${sessionGems} gems available for premium features` : 'No gems available - purchase gems to use premium features';

	// Update button states
	const logBtn = document.getElementById('log-btn');
	if (sessionGems >= GEM_COST_PER_LOG) {
		logBtn.disabled = false;
		logBtn.backgroundColor = '#ccc';
		logBtn.textContent = `Print Log (${GEM_COST_PER_LOG} gem)`;
		logBtn.className = 'btn btn-secondary';
	} else {
		logBtn.disabled = true;
		logBtn.backgroundColor = '#55ff55';
		logBtn.textContent = `Print Log (Need ${GEM_COST_PER_LOG} gem)`;
		logBtn.className = 'btn btn-secondary';
	}
}

// Update debug information
function updateDebugInfo() {
	document.getElementById('debug-products-count').textContent = `${Object.keys(availableProducts).length} products loaded`;
	document.getElementById('debug-gem-count').textContent = sessionGems;
	document.getElementById('debug-gems-used').textContent = totalGemsUsed;
	document.getElementById('debug-gems-purchased').textContent = totalGemsPurchased;
	document.getElementById('debug-last-action').textContent = new Date().toLocaleString();
	document.getElementById('debug-purchase-tokens').textContent = purchaseTokens.length > 0 ? `${purchaseTokens.length} tokens available` : 'None';
}

// Create loading placeholder for products
function showLoadingProducts() {
	const container = document.getElementById('gem-packages');
	container.innerHTML = `
<div class="gem-package loading">
<div class="loading-spinner"></div>
<h4>Loading Products...</h4>
<p>Fetching gem packages from App Store</p>
</div>
`;
}

// Display products dynamically
function displayProducts(products) {
	const container = document.getElementById('gem-packages');

	if (!products || products.length === 0) {
		container.innerHTML = `
<div class="gem-package">
<h4>❌ No Products Available</h4>
<p>Unable to load gem packages from App Store</p>
<button class="btn btn-secondary" onclick="loadProducts()">Retry</button>
</div>
`;
		return;
	}

	container.innerHTML = '';

	// Sort products by gem amount for better display
	const sortedProducts = products.sort((a, b) => {
		const aGems = getGemAmountFromProduct(a.productId);
		const bGems = getGemAmountFromProduct(b.productId);
		return aGems - bGems;
	});

	sortedProducts.forEach(product => {
		// Now gem amount is parsed dynamically from the product data
		const gemAmount = getGemAmountFromProduct(product.productId);
		const packageType = getPackageTypeFromProduct(product.productId);
		const isPopular = gemAmount === 10; // Mark 10-gem package as popular

		const productCard = document.createElement('div');
		productCard.className = 'gem-package';
		productCard.innerHTML = `
${isPopular ? '<div class="best-value">BEST VALUE</div>' : ''}
<div class="gem-icon">${getGemIcon(gemAmount)}</div>
<h4>${product.title || `${gemAmount} Gems`}</h4>
<div class="description">${product.description || getDefaultDescription(gemAmount)}</div>
<div class="price">${product.price || 'Loading...'}</div>
<button class="btn btn-gem" onclick="buyGemPackage('${packageType}', '${product.productId}')">
Buy ${gemAmount} Gems
</button>
`;

		container.appendChild(productCard);
	});

	updateDebugInfo();
}

// Get gem icon based on amount
function getGemIcon(amount) {
	if (amount === 1) return '💎';
	if (amount === 3) return '💎💎💎';
	if (amount === 10) return '💎✨💎✨💎';
	return '💎';
}

// Get default description for gem packages
function getDefaultDescription(amount) {
	if (amount === 1) return 'Perfect for trying premium features';
	if (amount === 3) return 'Great for regular users';
	if (amount === 10) return 'Best value for power users';
	return 'Premium gem package';
}

// Buy specific gem package
function buyGemPackage(packageType, productId) {
	if (!productId) {
		showMessage('Invalid gem package selected', 'error');
		return;
	}

	console.log('Initiating purchase for:', productId);
	const gemAmount = getGemAmountFromProduct(productId);
	showMessage(`Processing purchase for ${gemAmount} gems...`, 'info');

	if (typeof AppPurchase !== 'undefined') {
		AppPurchase.purchaseProduct(productId, "purchaseCallback");
	}
}

// Modified print log function - consumes gems and calls AppPurchase.consumePurchase
function printLog() {
	if (!useGems(GEM_COST_PER_LOG)) {
		showMessage(`Not enough gems! You need ${GEM_COST_PER_LOG} gem. Current: ${sessionGems}`, 'error');
		return;
	}

	// Call AppPurchase.consumePurchase with the most recent purchase token
	if (typeof AppPurchase !== 'undefined' && purchaseTokens.length > 0) {
		const tokenToConsume = purchaseTokens[purchaseTokens.length - 1]; // Use the most recent token
		console.log('Consuming purchase token:', tokenToConsume);
		AppPurchase.consumePurchase(tokenToConsume, "consumeCallback");
	} else {
		console.log('No purchase tokens available for consumption or AppPurchase not available');
		showMessage('No purchase tokens available for consumption', 'info');
	}

	console.log('=== PREMIUM LOG ACCESS ===');
	console.log('Gem consumed! Remaining gems:', sessionGems);
	console.log('Total gems used this session:', totalGemsUsed);
	console.log('Total gems purchased this session:', totalGemsPurchased);
	console.log('Available products:', availableProducts);
	console.log('Available purchase tokens:', purchaseTokens);
	console.log('Timestamp:', new Date().toISOString());
	console.log('User Action: PREMIUM LOG PRINTED');
	console.log('========================');

	showMessage(`Log printed! 1 gem used. Remaining: ${sessionGems}`, 'success');

	// Show premium content briefly
	const premiumContent = document.getElementById('premium-content');
	premiumContent.style.display = 'block';
	setTimeout(() => {
		premiumContent.style.display = 'none';
	}, 3000);
}

// Test functions
function addTestGems(amount) {
	addGems(amount, false);
}

function resetGems() {
	sessionGems = 0;
	totalGemsUsed = 0;
	totalGemsPurchased = 0;
	purchaseTokens = [];
	updateGemDisplay();
	updateDebugInfo();
	showMessage('All gem counts and tokens reset', 'info');
}

// Initialize the app
function initializeApp() {
	console.log('Initializing app with product IDs:', PRODUCT_IDS);
	sessionGems = 0;
	totalGemsUsed = 0;
	totalGemsPurchased = 0;
	purchaseTokens = [];
	availableProducts = {};
	updateGemDisplay();
	updateDebugInfo();
	loadProducts();
}

// Load all gem products from AppPurchase
function loadProducts() {
	if (isLoadingProducts) {
		showMessage('Products are already loading...', 'info');
		return;
	}

	console.log('Loading products:', PRODUCT_IDS);
	isLoadingProducts = true;
	showLoadingProducts();

	if (typeof AppPurchase !== 'undefined') {
		AppPurchase.getProducts(PRODUCT_IDS, "productsCallback");
	}
}

// Handle products list from AppPurchase
function productsCallback(result) {
	console.log('Products callback received:', result);
	isLoadingProducts = false;

	if (result.error) {
		console.error("Products error:", result.error);
		showMessage("Failed to load products: " + result.error, 'error');
		displayProducts([]); // Show error state
	} else if (result.products && result.products.length > 0) {
		// Store products
		availableProducts = {};
		result.products.forEach(product => {
			availableProducts[product.productId] = product;
		});
		displayProducts(result.products);
		showMessage(`${result.products.length} gem packages loaded successfully!`, 'success');
	} else {
		showMessage("No gem packages found in App Store", 'error');
		displayProducts([]);
	}
}

// Handle purchase result
function purchaseCallback(result) {
	console.log('Purchase callback received:', result);

	if (result.error) {
		console.error("Purchase error:", result.error);
		showMessage("Purchase failed: " + result.error, 'error');
	} else if (result.success) {
		console.log("Gem purchase successful:", result);

		// Store the purchase token for later consumption
		if (result.purchaseToken) {
			purchaseTokens.push(result.purchaseToken);
			console.log('Purchase token stored:', result.purchaseToken);
		}

		// Add gems based on purchase
		const gemsToAdd = getGemAmountFromProduct(result.productId);
		const packageName = getPackageNameFromProduct(result.productId);
		addGems(gemsToAdd, true);
		showMessage(`${packageName} purchase successful! ${gemsToAdd} gems added!`, 'success');
	}
}

// Handle consume purchase result
function consumeCallback(result) {
	console.log('Consume callback received:', result);

	if (result.error) {
		console.error("Consume error:", result.error);
		showMessage("Consume failed: " + result.error, 'error');
	} else if (result.success && result.consumed) {
		console.log("Purchase consumed successfully:", result);
		showMessage("Purchase consumed successfully!", 'success');
		// Remove the consumed token from our list
		if (purchaseTokens.length > 0) {
			purchaseTokens.pop(); // Remove the last token that was consumed
			updateDebugInfo();
		}
	}
}

// Parse gem amount dynamically from product data
function getGemAmountFromProduct(productId) {
	// First check if we have the product in our availableProducts
	const product = availableProducts[productId];
	if (product) {
		// Try to parse from productId first (e.g., "gem1", "gem3", "gem10")
		const idMatch = productId.match(/gem(\d+)/);
		if (idMatch) {
			return parseInt(idMatch[1]);
		}

		// Try to parse from title (e.g., "Single Gem Pack (1 gem)", "3 gems")
		if (product.title) {
			const titleMatch = product.title.match(/(\d+)\s*gem/i);
			if (titleMatch) {
				return parseInt(titleMatch[1]);
			}
		}

		// Try to parse from description
		if (product.description) {
			const descMatch = product.description.match(/(\d+)\s*gem/i);
			if (descMatch) {
				return parseInt(descMatch[1]);
			}
		}
	}

	// Fallback to hardcoded values if parsing fails
	const gemMap = {
		"com.realtimex.af.appjtzfi.gem1": 1,
		"com.realtimex.af.appjtzfi.gem3": 3,
		"com.realtimex.af.appjtzfi.gem10": 10
	};

	return gemMap[productId] || 1;
}

// Get package type from product ID
function getPackageTypeFromProduct(productId) {
	const typeMap = {
		"com.realtimex.af.appjtzfi.gem1": 'gem1',
		"com.realtimex.af.appjtzfi.gem3": 'gem3',
		"com.realtimex.af.appjtzfi.gem10": 'gem10'
	};
	return typeMap[productId] || 'gem1';
}

// Get package name from product ID
function getPackageNameFromProduct(productId) {
	// Try to get name from actual product data first
	const product = availableProducts[productId];
	if (product && product.title) {
		return product.title;
	}

	// Fallback to hardcoded names
	const nameMap = {
		"com.realtimex.af.appjtzfi.gem1": 'Single Gem Pack (1 gem)',
		"com.realtimex.af.appjtzfi.gem3": 'Small Gem Pack (3 gems)',
		"com.realtimex.af.appjtzfi.gem10": 'Large Gem Pack (10 gems)'
	};
	return nameMap[productId] || 'Gem Pack';
}

// Enhanced message display with auto-dismiss
function showMessage(message, type) {
	const messagesDiv = document.getElementById('messages');
	const messageDiv = document.createElement('div');
	messageDiv.className = `message ${type}`;
	messageDiv.textContent = message;
	messagesDiv.appendChild(messageDiv);

	// Remove message after 4 seconds
	setTimeout(() => {
		if (messagesDiv.contains(messageDiv)) {
			messagesDiv.removeChild(messageDiv);
		}
	}, 4000);
}

function onUpdate(data) {
	initializeApp();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
	initializeApp();
});

