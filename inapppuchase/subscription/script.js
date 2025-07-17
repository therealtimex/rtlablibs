const premiumFeatureDiv = document.getElementById('premium-feature');
const productsContainer = document.getElementById('products-container');
const productIds = ["com.realtimex.af.appjtzfi.1week", "com.realtimex.af.appjtzfi.1month"];

function showMessage(message, type) {
	const messagesDiv = document.getElementById('messages');
	const messageP = messagesDiv.querySelector('p');

	messagesDiv.className = 'messages'; // Reset classes
	messagesDiv.classList.add(type);
	messageP.textContent = message;
}

function showPremiumFeature() {
	premiumFeatureDiv.style.display = 'block';
	productsContainer.style.display = 'none';
}

function subscriptionStatusCallback(status) {
	if (status && status.isSubscribed) {
		console.log("User is subscribed.");
		showMessage("Welcome back! Your subscription is active.", 'success');
		showPremiumFeature();
	} else {
		console.log("User is not subscribed.");
		showMessage("Subscribe to unlock premium features.", 'processing');
		getProducts();
	}
}

function productsCallback(result) {
	if (result.error) {
		console.error("Products error:", result.error);
		showMessage("Could not load products: " + result.error, 'error');
	} else if (result.products) {
		console.log("Available products:", result.products);
		displayProducts(result.products);
	}
}

function displayProducts(products) {
	productsContainer.innerHTML = '';
	if (products.length === 0) {
		showMessage("No products found.", 'error');
		return;
	}
	products.forEach(product => {
		const productDiv = document.createElement('div');
		productDiv.className = 'product-item';
		productDiv.innerHTML = `
					<h3>${product.title}</h3>
					<p>${product.description}</p>
					<p class="price">${product.price}</p>
					<button onclick="buySubscription('${product.productId}')">Subscribe</button>
				`;
		productsContainer.appendChild(productDiv);
	});
}

function subscriptionCallback(result) {
	if (result.error) {
		console.error("Subscription error:", result.error);
		showMessage("Subscription failed: " + result.error, 'error');
	} else if (result.success) {
		console.log("Subscription successful:", result);
		showMessage("Subscription successful! Thank you for subscribing to " + result.subscriptionId + "!", 'success');
		showPremiumFeature();
	}
}

function getProducts() {
	if (typeof AppPurchase !== 'undefined' && AppPurchase.getProducts) {
		showMessage("Loading products...", 'processing');
		AppPurchase.getProducts(JSON.stringify(productIds), "productsCallback");
	} else {
		showMessage("AppPurchase interface not found.", 'error');
		console.error("AppPurchase.getProducts not found.");
	}
}

function buySubscription(subscriptionId) {
	if (typeof AppPurchase !== 'undefined' && AppPurchase.purchaseSubscription) {
		showMessage("Processing subscription for: " + subscriptionId + "...", 'processing');
		AppPurchase.purchaseSubscription(subscriptionId, "subscriptionCallback");
	} else {
		showMessage("AppPurchase interface not found.", 'error');
		console.error("AppPurchase interface not found.");
	}
}

function checkSubscriptionStatus() {
	if (typeof AppPurchase !== 'undefined' && AppPurchase.getSubscriptionStatus) {
		AppPurchase.getSubscriptionStatus("subscriptionStatusCallback");
	} else {
		console.error("AppPurchase.getSubscriptionStatus not found.");
		// If bridge is not available, try to load products directly
		getProducts();
	}
}

// Check subscription status when the page loads
window.addEventListener('load', checkSubscriptionStatus);

