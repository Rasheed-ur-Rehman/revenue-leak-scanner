import { useState } from "react";

/* ---------------- TYPES ---------------- */
type CartAnalytics = {
  totalCarts: number;
  abandonedCarts: number;
  completedCarts: number;
  abandonmentRate: string;
  completionRate: string;
  potentialRevenue: number;
  completedRevenue: number;
  recoverableRevenue: number;
  abandonedCartsList: {
    id: string;
    cartUrl?: string;
    customerEmail: string | null;
    customerFirstName: string | null;
    customerLastName: string | null;
    isLoggedIn: boolean;
    abandonedAt: string;
    totalPrice: number;
    lineItems: {
      productId: string | null;
      productName: string;
      quantity: number;
      price: number;
    }[];
    lineItemsCount: number;
  }[];
  completedOrdersList: {
    id: string;
    name: string;
    customerEmail: string | null;
    customerFirstName: string | null;
    customerLastName: string | null;
    isLoggedIn: boolean;
    processedAt: string;
    totalPrice: number;
    lineItems: {
      productId: string | null;
      productName: string;
      quantity: number;
      price: number;
    }[];
    lineItemsCount: number;
  }[];
  guestAbandonedCarts: {
    id: string;
    cartUrl?: string;
    customerEmail: string | null;
    customerFirstName: string | null;
    customerLastName: string | null;
    isLoggedIn: boolean;
    abandonedAt: string;
    totalPrice: number;
    lineItems: {
      productId: string | null;
      productName: string;
      quantity: number;
      price: number;
    }[];
    lineItemsCount: number;
  }[];
  topAbandonedProducts: {
    productName: string;
    abandonCount: number;
    totalValue: number;
  }[];
  productConversions?: {
    productId: string;
    productName: string;
    addedToCart: number;
    purchased: number;
    conversionRate: string;
  }[];
  missingPages?: {
    pageType: string;
    isMissing: boolean;
    severity: string;
    recommendation: string;
  }[];
  missingProducts?: {
    productId: string;
    productName: string;
    missingImages: boolean;
    missingDescription: boolean;
    missingPrice: boolean;
    missingVariant: boolean;
  }[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
};

type CheckoutFunnel = {
  totalCheckoutStarts: number;
  checkoutsCompleted: number;
  checkoutsAbandoned: number;
  completionRate: string;
  abandonmentRate: string;
  averageOrderValue: number;
  purchasesAfterReminder: number;
  conversionRate: string;
  purchasesAfterCheckout?: number;
  checkoutSteps?: any[];
  dailyFunnel?: any[];
};

type Props = {
  cartAnalytics: CartAnalytics;
  checkoutFunnel: CheckoutFunnel;
  shopUrl?: string;
};

export function CartAbandonmentDashboard({ cartAnalytics, checkoutFunnel, shopUrl }: Props) {
  const [activeTab, setActiveTab] = useState<"abandoned" | "completed" | "emails" | "guest" | "funnel">("abandoned");
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [reminderResult, setReminderResult] = useState<any>(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedCart, setSelectedCart] = useState<any>(null);
  const [discountPercentage, setDiscountPercentage] = useState("15");
  const [reminderMessage, setReminderMessage] = useState(
    "Hi {name}, we noticed you left some items in your cart. Complete your purchase now and enjoy {discount} off!"
  );

  const abandonedCarts = cartAnalytics.abandonedCartsList || [];
  const completedOrders = cartAnalytics.completedOrdersList || [];
  const guestCarts = cartAnalytics.guestAbandonedCarts || [];
  const topProducts = cartAnalytics.topAbandonedProducts || [];

  // Count emails
  const abandonedWithEmail = abandonedCarts.filter(c => c.customerEmail).length;
  const completedWithEmail = completedOrders.filter(c => c.customerEmail).length;
  const guestWithEmail = guestCarts.filter(c => c.customerEmail).length;

  // Send reminder
  const handleSendReminder = async (cart: any) => {
    if (!cart.customerEmail) {
      alert("This cart has no email address");
      return;
    }
    
    setSendingReminder(cart.id);
    setReminderResult(null);
    
    const formData = new FormData();
    formData.append("cartId", cart.id);
    formData.append("email", cart.customerEmail);
    formData.append("name", cart.customerFirstName || "Customer");
    formData.append("total", cart.totalPrice.toString());
    formData.append("discount", discountPercentage);
    formData.append("message", reminderMessage);
    formData.append("shopUrl", shopUrl || "");
    
    try {
      console.log("📧 Sending reminder to:", cart.customerEmail);
      console.log("📧 Using shop URL:", shopUrl);
      
      const response = await fetch(`/app?index&action=send_reminder`, {
        method: "POST",
        body: formData
      });
      
      // Check content type
      const contentType = response.headers.get("content-type");
      
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("❌ Non-JSON response:", text.substring(0, 200));
        
        // Check if it's an HTML error page
        if (text.includes("<!DOCTYPE html>")) {
          // Email might have sent successfully despite HTML response
          setReminderResult({
            success: true,
            message: "✅ Email was sent successfully! (Server returned HTML instead of JSON)"
          });
          setTimeout(() => setReminderResult(null), 5000);
          return;
        }
        
        throw new Error(`Server returned ${response.status}: ${text.substring(0, 100)}`);
      }
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error("❌ Server error:", result);
        throw new Error(result.message || `Server error: ${response.status}`);
      }
      
      console.log("📧 Reminder result:", result);
      setReminderResult(result);
      
      setTimeout(() => setReminderResult(null), 5000);
      
    } catch (error) {
      console.error("❌ Failed to send reminder:", error);
      
      setReminderResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to send reminder. Please try again."
      });
      
      setTimeout(() => setReminderResult(null), 5000);
    } finally {
      setSendingReminder(null);
    }
  };

  // Open discount modal
  const handleOpenDiscountModal = (cart: any) => {
    setSelectedCart(cart);
    setShowDiscountModal(true);
  };

  // Generate and send with discount
  const handleSendWithDiscount = async () => {
    if (!selectedCart) return;
    
    setShowDiscountModal(false);
    await handleSendReminder(selectedCart);
  };

  return (
    <div>
      {/* Success/Error Message */}
      {reminderResult && (
        <div style={{ 
          position: 'fixed', 
          top: 20, 
          right: 20, 
          background: reminderResult.success ? '#EFF7F5' : '#FFF4F4',
          padding: '1rem 2rem', 
          borderRadius: '8px', 
          border: reminderResult.success ? '1px solid #50B83C' : '1px solid #D82C0D',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxWidth: '400px'
        }}>
          <p style={{ 
            color: reminderResult.success ? '#006E52' : '#D82C0D', 
            fontWeight: '600',
            marginBottom: reminderResult.discountCode ? '0.5rem' : 0
          }}>
            {reminderResult.success ? '✅' : '❌'} {reminderResult.message}
          </p>
          {reminderResult.discountCode && (
            <p style={{ fontSize: '0.9rem', color: '#008060' }}>
              Discount code: <strong>{reminderResult.discountCode}</strong> ({reminderResult.discountValue})
            </p>
          )}
        </div>
      )}

      {/* Discount Modal */}
      {showDiscountModal && selectedCart && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem', color: '#008060' }}>
              🎁 Send Reminder with Discount
            </h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Customer:</p>
              <p>{selectedCart.customerFirstName || 'Customer'} {selectedCart.customerLastName}</p>
              <p style={{ color: '#008060' }}>{selectedCart.customerEmail}</p>
              <p>Cart Value: <strong>${selectedCart.totalPrice.toFixed(2)}</strong></p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
                Discount Percentage:
              </label>
              <select
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #8A9199',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              >
                <option value="10">10% OFF</option>
                <option value="15">15% OFF</option>
                <option value="20">20% OFF</option>
                <option value="25">25% OFF</option>
                <option value="30">30% OFF</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
                Reminder Message:
              </label>
              <textarea
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #8A9199',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  minHeight: '100px'
                }}
              />
              <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginTop: '0.25rem' }}>
                Use {'{name}'} for customer name and {'{discount}'} for discount code
              </p>
            </div>

            <div style={{ 
              background: '#F6F6F7', 
              padding: '1rem', 
              borderRadius: '8px', 
              marginBottom: '1.5rem' 
            }}>
              <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Preview:</p>
              <p style={{ fontSize: '0.9rem' }}>
                {reminderMessage
                  .replace('{name}', selectedCart.customerFirstName || 'Customer')
                  .replace('{discount}', `${discountPercentage}% off`)}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowDiscountModal(false);
                  setSelectedCart(null);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'white',
                  color: '#212B36',
                  border: '1px solid #8A9199',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendWithDiscount}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#008060',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Send Reminder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <TabButton active={activeTab === "abandoned"} onClick={() => setActiveTab("abandoned")}>
          🛒 Abandoned ({abandonedCarts.length})
        </TabButton>
        <TabButton active={activeTab === "completed"} onClick={() => setActiveTab("completed")}>
          ✅ Completed ({completedOrders.length})
        </TabButton>
        <TabButton active={activeTab === "guest"} onClick={() => setActiveTab("guest")}>
          👤 Guest ({guestCarts.length})
        </TabButton>
        <TabButton active={activeTab === "emails"} onClick={() => setActiveTab("emails")}>
          📧 Emails ({abandonedWithEmail + completedWithEmail})
        </TabButton>
        <TabButton active={activeTab === "funnel"} onClick={() => setActiveTab("funnel")}>
          📊 Funnel
        </TabButton>
      </div>

      {/* EMAILS TAB */}
      {activeTab === "emails" && (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E5E7', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>📧 Customer Emails</h2>
          
          {/* Abandoned Cart Emails */}
          {abandonedWithEmail > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#D82C0D', marginBottom: '1rem' }}>
                🛒 Abandoned Checkouts ({abandonedWithEmail})
              </h3>
              {abandonedCarts
                .filter(c => c.customerEmail)
                .map((cart, i) => (
                  <div key={i} style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    background: '#FFF4F4',
                    borderRadius: '8px',
                    marginBottom: '0.75rem',
                    border: '1px solid #E0B3B2'
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '600' }}>
                        {cart.customerFirstName || cart.customerLastName ? 
                          `${cart.customerFirstName || ''} ${cart.customerLastName || ''}`.trim() : 
                          'Customer'}
                      </p>
                      <p style={{ color: '#008060' }}>📧 {cart.customerEmail}</p>
                      <p style={{ fontSize: '0.9rem', color: '#5C5F62' }}>
                        ${cart.totalPrice.toFixed(2)} • {cart.lineItemsCount} items • {new Date(cart.abandonedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleOpenDiscountModal(cart)}
                        disabled={sendingReminder === cart.id}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: 'white',
                          color: '#008060',
                          border: '1px solid #008060',
                          borderRadius: '30px',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          cursor: sendingReminder === cart.id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        🎁 Add Discount
                      </button>
                      <button
                        onClick={() => handleSendReminder(cart)}
                        disabled={sendingReminder === cart.id}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: sendingReminder === cart.id ? '#8A9199' : '#008060',
                          color: 'white',
                          border: 'none',
                          borderRadius: '30px',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          cursor: sendingReminder === cart.id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {sendingReminder === cart.id ? '⏳ Sending...' : '✉️ Send Reminder'}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Completed Order Emails */}
          {completedWithEmail > 0 && (
            <div>
              <h3 style={{ color: '#008060', marginBottom: '1rem' }}>
                ✅ Completed Orders ({completedWithEmail})
              </h3>
              {completedOrders
                .filter(c => c.customerEmail)
                .map((order, i) => (
                  <div key={i} style={{ 
                    padding: '1rem',
                    background: '#F6F6F7',
                    borderRadius: '8px',
                    marginBottom: '0.75rem',
                    border: '1px solid #E4E5E7'
                  }}>
                    <p style={{ fontWeight: '600' }}>
                      {order.customerFirstName || order.customerLastName ? 
                        `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim() : 
                        'Customer'}
                    </p>
                    <p style={{ color: '#008060' }}>📧 {order.customerEmail}</p>
                    <p style={{ fontSize: '0.9rem', color: '#5C5F62' }}>
                      Order #{order.name} • ${order.totalPrice.toFixed(2)} • {new Date(order.processedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
            </div>
          )}

          {(abandonedWithEmail + completedWithEmail) === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#5C5F62' }}>
              <p>No customer emails found in the selected date range</p>
            </div>
          )}
        </div>
      )}

      {/* GUEST ABANDONED CARTS TAB */}
      {activeTab === "guest" && (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E5E7', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>👤 Guest Abandoned Carts</h2>
          
          {guestCarts.length > 0 ? (
            <>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '1rem', 
                marginBottom: '2rem' 
              }}>
                <StatCard label="Total Guest Carts" value={guestCarts.length} />
                <StatCard label="With Email" value={guestWithEmail} color="#008060" />
                <StatCard label="Lost Revenue" value={`$${guestCarts.reduce((sum, c) => sum + c.totalPrice, 0).toLocaleString()}`} color="#D82C0D" />
              </div>

              {guestCarts.map((cart, i) => (
                <div key={i} style={{ 
                  padding: '1rem',
                  background: '#F6F6F7',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  border: '1px solid #E4E5E7'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ fontWeight: '600' }}>
                        Guest Customer
                      </span>
                    </div>
                    <span style={{ fontWeight: '700', color: '#D82C0D' }}>${cart.totalPrice.toFixed(2)}</span>
                  </div>
                  
                  {cart.customerEmail && <p style={{ color: '#008060', marginBottom: '0.25rem' }}>📧 {cart.customerEmail}</p>}
                  
                  <p style={{ fontSize: '0.9rem', color: '#5C5F62', marginBottom: '0.5rem' }}>
                    {new Date(cart.abandonedAt).toLocaleString()}
                  </p>
                  
                  <details style={{ marginBottom: '0.5rem' }}>
                    <summary style={{ cursor: 'pointer', color: '#008060' }}>
                      Items ({cart.lineItemsCount})
                    </summary>
                    {cart.lineItems.map((item, idx) => (
                      <p key={idx} style={{ fontSize: '0.9rem', marginLeft: '1rem', marginTop: '0.25rem' }}>
                        • {item.quantity}x {item.productName}
                      </p>
                    ))}
                  </details>

                  {cart.customerEmail && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        onClick={() => handleOpenDiscountModal(cart)}
                        disabled={sendingReminder === cart.id}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'white',
                          color: '#008060',
                          border: '1px solid #008060',
                          borderRadius: '30px',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          cursor: sendingReminder === cart.id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        🎁 Add Discount
                      </button>
                      <button
                        onClick={() => handleSendReminder(cart)}
                        disabled={sendingReminder === cart.id}
                        style={{
                          padding: '0.5rem 1rem',
                          background: sendingReminder === cart.id ? '#8A9199' : '#008060',
                          color: 'white',
                          border: 'none',
                          borderRadius: '30px',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          cursor: sendingReminder === cart.id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {sendingReminder === cart.id ? '⏳ Sending...' : '✉️ Send Reminder'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <p style={{ textAlign: 'center', padding: '3rem', color: '#5C5F62' }}>
              No guest abandoned carts found in the selected date range
            </p>
          )}
        </div>
      )}

      {/* ABANDONED CARTS TAB */}
      {activeTab === "abandoned" && (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E5E7', padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem' }}>🛒 Abandoned Checkouts</h2>
            <span style={{ 
              padding: '0.5rem 1rem', 
              background: '#FFF4F4',
              borderRadius: '30px',
              color: '#D82C0D',
              fontWeight: '600'
            }}>
              {cartAnalytics.abandonmentRate} abandonment rate
            </span>
          </div>
          
          {abandonedCarts.length > 0 ? (
            <>
              {/* Stats */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '1rem', 
                marginBottom: '2rem' 
              }}>
                <StatCard label="Total Abandoned" value={abandonedCarts.length} />
                <StatCard label="With Email" value={abandonedWithEmail} color="#008060" />
                <StatCard label="Lost Revenue" value={`$${cartAnalytics.potentialRevenue.toLocaleString()}`} color="#D82C0D" />
              </div>

              {/* Top Abandoned Products */}
              {topProducts.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>📦 Most Abandoned Products</h3>
                  {topProducts.map((product, i) => (
                    <div key={i} style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      background: '#F6F6F7',
                      borderRadius: '8px',
                      marginBottom: '0.5rem'
                    }}>
                      <span>{product.productName}</span>
                      <span style={{ fontWeight: '600', color: '#D82C0D' }}>
                        {product.abandonCount}x
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* List of abandoned carts */}
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Recent Abandoned Carts</h3>
              {abandonedCarts.map((cart, i) => (
                <div key={i} style={{ 
                  padding: '1rem',
                  background: cart.isLoggedIn ? '#EFF7F5' : '#F6F6F7',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  border: cart.isLoggedIn ? '1px solid #50B83C' : '1px solid #E4E5E7'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ fontWeight: '600' }}>
                        {cart.customerFirstName || cart.customerLastName ? 
                          `${cart.customerFirstName || ''} ${cart.customerLastName || ''}`.trim() : 
                          'Guest Customer'}
                      </span>
                      {cart.isLoggedIn && <span style={{ marginLeft: '0.5rem', color: '#50B83C' }}>🔐 Logged in</span>}
                    </div>
                    <span style={{ fontWeight: '700', color: '#D82C0D' }}>${cart.totalPrice.toFixed(2)}</span>
                  </div>
                  
                  {cart.customerEmail && <p style={{ color: '#008060', marginBottom: '0.25rem' }}>📧 {cart.customerEmail}</p>}
                  
                  <p style={{ fontSize: '0.9rem', color: '#5C5F62', marginBottom: '0.5rem' }}>
                    {new Date(cart.abandonedAt).toLocaleString()}
                  </p>
                  
                  <details style={{ marginBottom: '0.5rem' }}>
                    <summary style={{ cursor: 'pointer', color: '#008060' }}>
                      Items ({cart.lineItemsCount})
                    </summary>
                    {cart.lineItems.map((item, idx) => (
                      <p key={idx} style={{ fontSize: '0.9rem', marginLeft: '1rem', marginTop: '0.25rem' }}>
                        • {item.quantity}x {item.productName}
                      </p>
                    ))}
                  </details>

                  {cart.customerEmail && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        onClick={() => handleOpenDiscountModal(cart)}
                        disabled={sendingReminder === cart.id}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'white',
                          color: '#008060',
                          border: '1px solid #008060',
                          borderRadius: '30px',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          cursor: sendingReminder === cart.id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        🎁 Add Discount
                      </button>
                      <button
                        onClick={() => handleSendReminder(cart)}
                        disabled={sendingReminder === cart.id}
                        style={{
                          padding: '0.5rem 1rem',
                          background: sendingReminder === cart.id ? '#8A9199' : '#008060',
                          color: 'white',
                          border: 'none',
                          borderRadius: '30px',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          cursor: sendingReminder === cart.id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {sendingReminder === cart.id ? '⏳ Sending...' : '✉️ Send Reminder'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <p style={{ textAlign: 'center', padding: '3rem', color: '#5C5F62' }}>
              No abandoned checkouts found in the selected date range
            </p>
          )}
        </div>
      )}

      {/* COMPLETED ORDERS TAB */}
      {activeTab === "completed" && (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E5E7', padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem' }}>✅ Completed Orders</h2>
            <span style={{ 
              padding: '0.5rem 1rem', 
              background: '#EFF7F5',
              borderRadius: '30px',
              color: '#006E52',
              fontWeight: '600'
            }}>
              ${cartAnalytics.completedRevenue.toLocaleString()} revenue
            </span>
          </div>
          
          {completedOrders.length > 0 ? (
            <>
              {/* Stats */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '1rem', 
                marginBottom: '2rem' 
              }}>
                <StatCard label="Total Orders" value={completedOrders.length} />
                <StatCard label="With Email" value={completedWithEmail} color="#008060" />
                <StatCard label="Avg Order Value" value={`$${checkoutFunnel.averageOrderValue.toFixed(2)}`} />
              </div>

              {/* List of completed orders */}
              {completedOrders.map((order, i) => (
                <div key={i} style={{ 
                  padding: '1rem',
                  background: '#F6F6F7',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  border: '1px solid #E4E5E7'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ fontWeight: '600' }}>
                        {order.customerFirstName || order.customerLastName ? 
                          `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim() : 
                          'Customer'}
                      </span>
                      <span style={{ marginLeft: '0.5rem', color: '#008060' }}>Order #{order.name}</span>
                    </div>
                    <span style={{ fontWeight: '700', color: '#008060' }}>${order.totalPrice.toFixed(2)}</span>
                  </div>
                  
                  {order.customerEmail && <p style={{ color: '#008060', marginBottom: '0.25rem' }}>📧 {order.customerEmail}</p>}
                  
                  <p style={{ fontSize: '0.9rem', color: '#5C5F62', marginBottom: '0.5rem' }}>
                    {new Date(order.processedAt).toLocaleString()}
                  </p>
                  
                  <details>
                    <summary style={{ cursor: 'pointer', color: '#008060' }}>
                      Items ({order.lineItemsCount})
                    </summary>
                    {order.lineItems.map((item, idx) => (
                      <p key={idx} style={{ fontSize: '0.9rem', marginLeft: '1rem', marginTop: '0.25rem' }}>
                        • {item.quantity}x {item.productName} (${(item.price * item.quantity).toFixed(2)})
                      </p>
                    ))}
                  </details>
                </div>
              ))}
            </>
          ) : (
            <p style={{ textAlign: 'center', padding: '3rem', color: '#5C5F62' }}>
              No completed orders found in the selected date range
            </p>
          )}
        </div>
      )}

      {/* FUNNEL TAB */}
      {activeTab === "funnel" && (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E5E7', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>📊 Checkout Funnel</h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '1rem', 
            marginBottom: '2rem' 
          }}>
            <StatCard label="Started" value={checkoutFunnel.totalCheckoutStarts} />
            <StatCard label="Completed" value={checkoutFunnel.checkoutsCompleted} color="#008060" />
            <StatCard label="Abandoned" value={checkoutFunnel.checkoutsAbandoned} color="#D82C0D" />
            <StatCard label="Completion Rate" value={checkoutFunnel.completionRate} />
          </div>

          {/* Simple funnel visualization */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Started Checkout</span>
                <span>{checkoutFunnel.totalCheckoutStarts}</span>
              </div>
              <div style={{ height: '20px', background: '#E4E5E7', borderRadius: '10px' }}>
                <div style={{ width: '100%', height: '100%', background: '#008060', borderRadius: '10px' }} />
              </div>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Completed</span>
                <span>{checkoutFunnel.checkoutsCompleted}</span>
              </div>
              <div style={{ height: '20px', background: '#E4E5E7', borderRadius: '10px' }}>
                <div style={{ 
                  width: `${checkoutFunnel.totalCheckoutStarts > 0 ? (checkoutFunnel.checkoutsCompleted / checkoutFunnel.totalCheckoutStarts) * 100 : 0}%`, 
                  height: '100%', 
                  background: '#50B83C', 
                  borderRadius: '10px' 
                }} />
              </div>
            </div>
          </div>

          {/* Recovery opportunity */}
          {checkoutFunnel.checkoutsAbandoned > 0 && (
            <div style={{ 
              background: 'linear-gradient(135deg, #F6F6F7, #F1F2F3)',
              padding: '1.5rem',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <div>
                <p style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                  Recovery Opportunity
                </p>
                <p style={{ color: '#5C5F62' }}>
                  {checkoutFunnel.purchasesAfterReminder} additional purchases possible
                </p>
              </div>
              <p style={{ fontSize: '2rem', fontWeight: '700', color: '#008060' }}>
                ${cartAnalytics.recoverableRevenue.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Helper Components */
function TabButton({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.75rem 1.5rem',
        background: active ? '#008060' : 'white',
        color: active ? 'white' : '#212B36',
        border: active ? 'none' : '1px solid #8A9199',
        borderRadius: '30px',
        fontSize: '0.95rem',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, color }: any) {
  return (
    <div style={{ 
      padding: '1rem', 
      background: '#F6F6F7', 
      borderRadius: '8px',
      textAlign: 'center'
    }}>
      <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginBottom: '0.25rem' }}>{label}</p>
      <p style={{ fontSize: '1.5rem', fontWeight: '700', color: color || '#212B36' }}>{value}</p>
    </div>
  );
}