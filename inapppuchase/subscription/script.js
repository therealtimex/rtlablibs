/**
 * In-App Subscription Implementation using AppPurchase Bridge
 * Based on documentation at https://rtgit.rta.vn/rtlab/tech-document/-/issues/285
 */

// Configuration
const premiumFeatureDiv = document.getElementById('premium-feature');
const productsContainer = document.getElementById('products-container');
const messagesDiv = document.getElementById('messages');
const messageP = messagesDiv.querySelector('p');

// Product IDs for subscriptions - update these with your actual product IDs
const productIds = [
  "com.realtimex.af.appjtzfi.1week", 
  "com.realtimex.af.appjtzfi.1month"
];

// Store subscription data
let activeSubscription = null;
let availableProducts = [];

/**
 * Local storage keys
 */
const STORAGE_KEYS = {
  SUBSCRIPTION: 'app_purchase_subscription',
  PRODUCTS: 'app_purchase_products',
  LAST_CHECK: 'app_purchase_last_check'
};

/**
 * Display a message to the user with appropriate styling
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, error, processing, info)
 */
function showMessage(message, type = 'info') {
  messagesDiv.className = 'messages'; // Reset classes
  messagesDiv.classList.add(type);
  messageP.textContent = message;
  
  console.log(`[${type}] ${message}`);
}

/**
 * Show the premium content when subscription is active
 */
function showPremiumFeature() {
  premiumFeatureDiv.style.display = 'block';
  productsContainer.style.display = 'none';
}

/**
 * Hide the premium content when subscription is inactive
 */
function hidePremiumFeature() {
  premiumFeatureDiv.style.display = 'none';
  productsContainer.style.display = 'block';
}

/**
 * Save subscription data to local storage
 * @param {Object} subscription - Subscription data to save
 */
function saveSubscriptionToStorage(subscription) {
  if (!subscription) return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, JSON.stringify(subscription));
    localStorage.setItem(STORAGE_KEYS.LAST_CHECK, Date.now().toString());
    console.log("Subscription data saved to local storage");
  } catch (error) {
    console.error("Error saving subscription to storage:", error);
  }
}

/**
 * Load subscription data from local storage
 * @returns {Object|null} Subscription data or null if not found
 */
function loadSubscriptionFromStorage() {
  try {
    const storedData = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTION);
    if (!storedData) return null;
    
    const subscription = JSON.parse(storedData);
    const lastCheck = parseInt(localStorage.getItem(STORAGE_KEYS.LAST_CHECK) || '0');
    const now = Date.now();
    
    // If data is older than 1 hour, consider it stale
    if (now - lastCheck > 3600000) {
      console.log("Cached subscription data is stale, will verify with server");
      return null;
    }
    
    // Check if subscription has expired
    if (subscription.expiryTime) {
      const expiryTime = new Date(subscription.expiryTime).getTime();
      if (expiryTime <= now) {
        console.log("Cached subscription has expired");
        clearSubscriptionFromStorage();
        return null;
      }
    }
    
    console.log("Loaded subscription from local storage:", subscription);
    return subscription;
  } catch (error) {
    console.error("Error loading subscription from storage:", error);
    return null;
  }
}

/**
 * Clear subscription data from local storage
 */
function clearSubscriptionFromStorage() {
  try {
    localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);
    console.log("Subscription data cleared from local storage");
  } catch (error) {
    console.error("Error clearing subscription from storage:", error);
  }
}

/**
 * Save products data to local storage
 * @param {Array} products - Products data to save
 */
function saveProductsToStorage(products) {
  if (!products || !Array.isArray(products)) return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    console.log("Products data saved to local storage");
  } catch (error) {
    console.error("Error saving products to storage:", error);
  }
}

/**
 * Load products data from local storage
 * @returns {Array|null} Products data or null if not found
 */
function loadProductsFromStorage() {
  try {
    const storedData = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!storedData) return null;
    
    const products = JSON.parse(storedData);
    if (!Array.isArray(products)) return null;
    
    console.log("Loaded products from local storage:", products);
    return products;
  } catch (error) {
    console.error("Error loading products from storage:", error);
    return null;
  }
}

/**
 * Format date for display
 * @param {string|number} dateString - Date string or timestamp
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  if (!dateString) return 'Unknown date';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch (e) {
    return dateString;
  }
}

/**
 * Schedule a check for subscription expiration
 * @param {string|number} expiryTime - Expiration date or timestamp
 */
function scheduleExpirationCheck(expiryTime) {
  try {
    const expiryDate = new Date(expiryTime).getTime();
    const now = Date.now();
    
    if (expiryDate > now) {
      const timeUntilExpiry = expiryDate - now;
      console.log(`Scheduling expiration check in ${Math.floor(timeUntilExpiry/1000/60)} minutes`);
      
      // Set timeout to check again after expiry
      setTimeout(() => {
        checkSubscriptionStatus();
      }, timeUntilExpiry + 1000); // Add 1 second buffer
    }
  } catch (error) {
    console.error("Error scheduling expiration check:", error);
  }
}

/**
 * Check for cached subscription on startup
 * This runs before making any network calls
 */
function checkCachedSubscription() {
  // First try to load from local storage
  const cachedSubscription = loadSubscriptionFromStorage();
  
  if (cachedSubscription && cachedSubscription.success) {
    // We have a valid cached subscription
    console.log("Found valid cached subscription:", cachedSubscription);
    activeSubscription = cachedSubscription;
    
    // Show premium content
    showPremiumFeature();
    showMessage(`Welcome back! Your subscription is active until ${formatDate(cachedSubscription.expiryTime)}.`, 'success');
    
    // Schedule expiration check
    if (cachedSubscription.expiryTime) {
      scheduleExpirationCheck(cachedSubscription.expiryTime);
    }
    
    // Still verify with server in the background
    setTimeout(() => {
      if (typeof AppPurchase !== 'undefined') {
        getPurchaseStatus();
      }
    }, 1000);
    
    return true;
  }
  
  // No valid cached subscription
  console.log("No valid cached subscription found");
  hidePremiumFeature();
  
  // Try to load cached products while we wait for server response
  const cachedProducts = loadProductsFromStorage();
  if (cachedProducts && cachedProducts.length > 0) {
    console.log("Using cached products while loading from server");
    displayProducts(cachedProducts);
    showMessage("Choose a subscription plan below:", 'info');
  } else {
    // Make sure products container is visible
    productsContainer.style.display = 'block';
    showMessage("Loading subscription options...", 'processing');
  }
  
  return false;
}

/**
 * Check current purchase status
 */
function getPurchaseStatus() {
  if (typeof AppPurchase !== 'undefined' && AppPurchase.getPurchaseStatus) {
    showMessage("Checking subscription status...", 'processing');
    
    try {
      AppPurchase.getPurchaseStatus("statusCallback");
    } catch (error) {
      console.error("Error checking purchase status:", error);
      showMessage("Failed to check subscription status.", 'error');
      getProducts(); // Fall back to showing products
    }
  } else {
    console.warn("AppPurchase.getPurchaseStatus not available");
    // If bridge is not available, try to load products directly
    getProducts();
  }
}

/**
 * Callback for purchase status check
 * @param {Object|string} status - Purchase status information
 */
function statusCallback(status) {
  try {
    const parsedStatus = typeof status === 'string' ? JSON.parse(status) : status;
    
    if (parsedStatus.error) {
      console.error("Status error:", parsedStatus.error);
      showMessage("Failed to verify subscription status.", 'error');
      getProducts(); // Fall back to showing products
      return;
    }
    
    console.log("Purchase status:", parsedStatus);
    
    // Check if user has any active subscriptions
    if (parsedStatus.activeSubscriptions && 
        parsedStatus.activeSubscriptions.length > 0 &&
        parsedStatus.subscriptionStatus) {
      
      // Get the first active subscription
      const subId = parsedStatus.activeSubscriptions[0];
      const subStatus = parsedStatus.subscriptionStatus[subId];
      
      if (subStatus && subStatus.active) {
        // User has an active subscription
        activeSubscription = {
          success: true,
          subscriptionId: subId,
          expiryTime: subStatus.expiryTime,
          autoRenewing: subStatus.autoRenewing
        };
        
        // Save subscription to local storage
        saveSubscriptionToStorage(activeSubscription);
        
        showMessage(`Welcome back! Your subscription is active until ${formatDate(subStatus.expiryTime)}.`, 'success');
        showPremiumFeature();
        
        // Schedule expiration check
        scheduleExpirationCheck(subStatus.expiryTime);
        return;
      }
    }
    
    // No active subscription found
    console.log("User is not subscribed");
    activeSubscription = null;
    clearSubscriptionFromStorage();
    hidePremiumFeature();
    showMessage("Subscribe to unlock premium features.", 'info');
    getProducts();
    
  } catch (error) {
    console.error("Error in status callback:", error);
    showMessage("Failed to verify subscription status.", 'error');
    getProducts(); // Fall back to showing products
  }
}

/**
 * Fetch available subscription products
 */
function getProducts() {
  if (typeof AppPurchase !== 'undefined' && AppPurchase.getProducts) {
    showMessage("Loading subscription options...", 'processing');
    
    try {
      AppPurchase.getProducts(JSON.stringify(productIds), "productsCallback");
    } catch (error) {
      console.error("Error getting products:", error);
      showMessage("Failed to load subscription options.", 'error');
      
      // Try to use cached products
      const cachedProducts = loadProductsFromStorage();
      if (cachedProducts && cachedProducts.length > 0) {
        displayProducts(cachedProducts);
      }
    }
  } else {
    console.warn("AppPurchase.getProducts not available");
    showMessage("Subscription options could not be loaded on this device.", 'error');
    
    // For development/testing
    simulateProductsForTesting();
  }
}

/**
 * Callback for product retrieval
 * @param {Object|string} result - Product retrieval result
 */
function productsCallback(result) {
  try {
    const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
    
    if (parsedResult.error) {
      console.error("Products error:", parsedResult.error);
      showMessage("Could not load subscription options: " + parsedResult.error, 'error');
      
      // Try to use cached products if available
      const cachedProducts = loadProductsFromStorage();
      if (cachedProducts && cachedProducts.length > 0) {
        console.log("Using cached products due to error");
        displayProducts(cachedProducts);
      }
    } else if (parsedResult.products && Array.isArray(parsedResult.products)) {
      console.log("Available products:", parsedResult.products);
      availableProducts = parsedResult.products;
      
      // Save products to local storage for future use
      saveProductsToStorage(parsedResult.products);
      
      if (parsedResult.products.length === 0) {
        showMessage("No subscription options are currently available.", 'info');
      } else {
        showMessage("Choose a subscription plan below:", 'info');
        displayProducts(parsedResult.products);
      }
    } else {
      console.error("Invalid products response:", parsedResult);
      showMessage("Received invalid subscription data.", 'error');
      
      // Try to use cached products if available
      const cachedProducts = loadProductsFromStorage();
      if (cachedProducts && cachedProducts.length > 0) {
        console.log("Using cached products due to invalid response");
        displayProducts(cachedProducts);
      }
    }
  } catch (error) {
    console.error("Error in products callback:", error);
    showMessage("Failed to process subscription options.", 'error');
    
    // Try to use cached products if available
    const cachedProducts = loadProductsFromStorage();
    if (cachedProducts && cachedProducts.length > 0) {
      console.log("Using cached products due to error");
      displayProducts(cachedProducts);
    }
  }
}

/**
 * Display available subscription products
 * @param {Array} products - List of available products
 */
function displayProducts(products) {
  productsContainer.innerHTML = '';
  
  if (!products || products.length === 0) {
    const noProductsDiv = document.createElement('div');
    noProductsDiv.className = 'no-products';
    noProductsDiv.textContent = 'No subscription options available at this time.';
    productsContainer.appendChild(noProductsDiv);
    return;
  }
  
  // Filter for subscription products only
  const subscriptionProducts = products.filter(product => 
    product.type === 'subs' || product.subscriptionPeriod
  );
  
  // If no subscription products found, show all products
  const productsToDisplay = subscriptionProducts.length > 0 ? subscriptionProducts : products;
  
  // Sort products by price (lowest first)
  productsToDisplay.sort((a, b) => {
    const priceA = parseFloat(a.price.replace(/[^0-9.]/g, ''));
    const priceB = parseFloat(b.price.replace(/[^0-9.]/g, ''));
    return priceA - priceB;
  });
  
  productsToDisplay.forEach(product => {
    const productDiv = document.createElement('div');
    productDiv.className = 'product-item';
    
    // Create a more attractive product display
    productDiv.innerHTML = `
      <h3>${product.title}</h3>
      <p>${product.description || 'Premium subscription plan'}</p>
      <p class="price">${product.price}</p>
      <button onclick="buySubscription('${product.productId}')">Subscribe Now</button>
    `;
    
    productsContainer.appendChild(productDiv);
  });
}

/**
 * Initiate subscription purchase
 * @param {string} subscriptionId - ID of the subscription to purchase
 */
function buySubscription(subscriptionId) {
  if (typeof AppPurchase !== 'undefined' && AppPurchase.purchaseSubscription) {
    showMessage("Processing your subscription...", 'processing');
    
    try {
      AppPurchase.purchaseSubscription(subscriptionId, "subscriptionCallback");
    } catch (error) {
      console.error("Error purchasing subscription:", error);
      showMessage("Failed to process subscription purchase.", 'error');
    }
  } else {
    console.error("AppPurchase.purchaseSubscription not available");
    showMessage("Subscription purchases are not available on this device.", 'error');
    
    // For development/testing
    simulatePurchaseForTesting(subscriptionId);
  }
}

/**
 * Callback for subscription purchase result
 * @param {Object|string} result - Purchase result
 */
function subscriptionCallback(result) {
  try {
    const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
    
    if (parsedResult.error) {
      console.error("Subscription error:", parsedResult.error);
      
      // Handle specific error cases
      if (parsedResult.error.includes('cancelled')) {
        showMessage("Purchase cancelled.", 'info');
      } else if (parsedResult.error.includes('already owned')) {
        showMessage("You already own this subscription. Refreshing status...", 'info');
        getPurchaseStatus();
      } else {
        showMessage("Subscription failed: " + parsedResult.error, 'error');
      }
    } else if (parsedResult.success) {
      console.log("Subscription successful:", parsedResult);
      
      // Store subscription details
      activeSubscription = parsedResult;
      
      // Save to local storage
      saveSubscriptionToStorage(parsedResult);
      
      showMessage("Subscription successful! Thank you for subscribing.", 'success');
      showPremiumFeature();
      
      // Set up expiration check if needed
      if (parsedResult.expiryTime) {
        scheduleExpirationCheck(parsedResult.expiryTime);
      }
    } else {
      console.error("Invalid subscription response:", parsedResult);
      showMessage("Received invalid purchase response.", 'error');
    }
  } catch (error) {
    console.error("Error in subscription callback:", error);
    showMessage("Failed to process subscription result.", 'error');
  }
}

/**
 * Restore previous purchases
 */
function restorePurchases() {
  if (typeof AppPurchase !== 'undefined' && AppPurchase.getPurchaseHistory) {
    showMessage("Restoring your purchases...", 'processing');
    
    try {
      AppPurchase.getPurchaseHistory("historyCallback");
    } catch (error) {
      console.error("Error restoring purchases:", error);
      showMessage("Failed to restore purchases.", 'error');
    }
  } else {
    console.error("AppPurchase.getPurchaseHistory not available");
    showMessage("Restore purchases is not available on this device.", 'error');
  }
}

/**
 * Callback for purchase history
 * @param {Object|string} result - Purchase history result
 */
function historyCallback(result) {
  try {
    const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
    
    if (parsedResult.error) {
      console.error("History error:", parsedResult.error);
      showMessage("Failed to restore purchases: " + parsedResult.error, 'error');
    } else {
      console.log("Purchase history:", parsedResult);
      
      // Check for active subscriptions
      if (parsedResult.subscriptions && parsedResult.subscriptions.length > 0) {
        // Find the most recent active subscription
        const activeSubscriptions = parsedResult.subscriptions.filter(sub => {
          const expiryTime = new Date(sub.expiryTime).getTime();
          return expiryTime > Date.now();
        });
        
        if (activeSubscriptions.length > 0) {
          // Sort by expiry time (latest first)
          activeSubscriptions.sort((a, b) => {
            return new Date(b.expiryTime).getTime() - new Date(a.expiryTime).getTime();
          });
          
          const latestSub = activeSubscriptions[0];
          
          // Store subscription details
          activeSubscription = {
            success: true,
            subscriptionId: latestSub.subscriptionId,
            purchaseToken: latestSub.purchaseToken,
            purchaseTime: latestSub.purchaseTime,
            expiryTime: latestSub.expiryTime,
            autoRenewing: latestSub.autoRenewing
          };
          
          // Save to local storage
          saveSubscriptionToStorage(activeSubscription);
          
          showMessage("Your subscription has been restored successfully!", 'success');
          showPremiumFeature();
          
          // Set up expiration check
          scheduleExpirationCheck(latestSub.expiryTime);
          return;
        }
      }
      
      // No active subscriptions found
      showMessage("No active subscriptions found to restore.", 'info');
    }
  } catch (error) {
    console.error("Error in history callback:", error);
    showMessage("Failed to process restore result.", 'error');
  }
}

/**
 * Handle app coming to foreground
 * Re-check subscription status
 */
function handleAppForeground() {
  console.log("App came to foreground, checking subscription status");
  getPurchaseStatus();
}

/**
 * For development/testing only - simulate products
 */
function simulateProductsForTesting() {
  console.warn("Using simulated products for testing");
  
  const testProducts = [
    {
      productId: "com.realtimex.af.appjtzfi.1week",
      type: "subs",
      title: "Weekly Premium",
      description: "Access premium features for one week",
      price: "$1.99",
      subscriptionPeriod: "P1W"
    },
    {
      productId: "com.realtimex.af.appjtzfi.1month",
      type: "subs",
      title: "Monthly Premium",
      description: "Access premium features for one month at a discounted rate",
      price: "$4.99",
      subscriptionPeriod: "P1M"
    }
  ];
  
  setTimeout(() => {
    displayProducts(testProducts);
    showMessage("Test mode: Subscription options loaded", 'info');
  }, 1000);
}

/**
 * For development/testing only - simulate purchase
 * @param {string} subscriptionId - ID of the subscription to simulate purchase for
 */
function simulatePurchaseForTesting(subscriptionId) {
  console.warn("Simulating purchase for testing:", subscriptionId);
  
  showMessage("Test mode: Processing purchase...", 'processing');
  
  setTimeout(() => {
    const now = new Date();
    const expiryDate = new Date();
    
    // Set expiry date based on subscription period
    if (subscriptionId.includes('1week')) {
      expiryDate.setDate(now.getDate() + 7);
    } else if (subscriptionId.includes('1month')) {
      expiryDate.setMonth(now.getMonth() + 1);
    } else {
      expiryDate.setDate(now.getDate() + 3); // Default 3 days
    }
    
    const mockResult = {
      success: true,
      purchaseToken: 'test-token-' + Math.floor(Math.random() * 1000000),
      subscriptionId: subscriptionId,
      orderId: 'test-order-' + Math.floor(Math.random() * 1000000),
      purchaseTime: now.getTime(),
      expiryTime: expiryDate.getTime(),
      autoRenewing: true,
      purchaseState: 1
    };
    
    subscriptionCallback(mockResult);
  }, 2000);
}

// Add a restore purchases button to the page
function addRestoreButton() {
  const container = document.querySelector('.container');
  const messagesDiv = document.getElementById('messages');
  
  // Create restore button if it doesn't exist
  if (!document.getElementById('restore-button')) {
    const restoreButton = document.createElement('button');
    restoreButton.id = 'restore-button';
    restoreButton.className = 'restore-button';
    restoreButton.textContent = 'Restore Purchases';
    restoreButton.onclick = restorePurchases;
    restoreButton.style.marginTop = '20px';
    restoreButton.style.backgroundColor = '#6c757d';
    
    // Insert before messages div
    container.insertBefore(restoreButton, messagesDiv);
  }
}

// Set up event listeners
window.addEventListener('load', () => {
  // Add restore button
  addRestoreButton();
  
  // First check for cached subscription
  const hasValidSubscription = checkCachedSubscription();
  
  // If no valid subscription found, check purchase status
  if (!hasValidSubscription) {
    getPurchaseStatus();
  }
  
  // Set up visibility change listener to detect app coming to foreground
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      handleAppForeground();
    }
  });
});

// Expose necessary functions to global scope
window.buySubscription = buySubscription;
window.restorePurchases = restorePurchases;