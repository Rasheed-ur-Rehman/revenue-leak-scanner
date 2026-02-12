import { useState } from "react";
import { useFetcher } from "react-router";

/* ---------------- TYPES ---------------- */
type CartAbandonmentData = {
  totalCarts: number;
  cartsWithCheckout: number;
  cartsWithoutCheckout: number;
  abandonedCarts: number;
  recoveryRate: string;
  abandonmentRate: string;
  potentialRevenue: number;
  recoverableRevenue: number;
  topAbandonedProducts: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    totalValue: number;
    abandonCount: number;
  }[];
  recentAbandonedCarts: {
    cartId: string;
    customerEmail: string | null;
    customerName: string | null;
    isLoggedIn: boolean;
    abandonedAt: string;
    totalPrice: number;
    itemCount: number;
    items: {
      productId: string;
      productName: string;
      quantity: number;
      price: number;
    }[];
  }[];
};

type CheckoutFunnelData = {
  totalCheckoutStarts: number;
  checkoutsCompleted: number;
  checkoutsAbandoned: number;
  completionRate: string;
  abandonmentRate: string;
  purchasesAfterCheckout: number;
  purchasesAfterReminder: number;
  conversionRate: string;
  averageOrderValue: number;
  checkoutSteps: {
    step: string;
    entered: number;
    completed: number;
    dropoffRate: string;
  }[];
  dailyFunnel: {
    date: string;
    started: number;
    completed: number;
    abandoned: number;
  }[];
};

type EmailReminderResult = {
  success: boolean;
  message: string;
  sentTo: string;
  cartId: string;
  discountCode?: string;
  discountValue?: string;
};

type Props = {
  cartAnalytics: CartAbandonmentData;
  checkoutFunnel: CheckoutFunnelData;
};

/* ---------------- CART ABANDONMENT DASHBOARD ---------------- */
export function CartAbandonmentDashboard({ cartAnalytics, checkoutFunnel }: Props) {
  const fetcher = useFetcher();
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [reminderResult, setReminderResult] = useState<EmailReminderResult | null>(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedCart, setSelectedCart] = useState<any>(null);
  const [discountPercentage, setDiscountPercentage] = useState("15");
  const [activeTab, setActiveTab] = useState<"carts" | "funnel">("carts");

  // Send reminder email
  const handleSendReminder = async (cart: any) => {
    setSendingReminder(cart.cartId);
    setReminderResult(null);
    
    const formData = new FormData();
    formData.append("cartId", cart.cartId);
    formData.append("email", cart.customerEmail || "");
    formData.append("name", cart.customerName || "Customer");
    formData.append("total", cart.totalPrice.toString());
    
    try {
      const response = await fetch(`${window.location.pathname}?action=send_reminder&t=${Date.now()}`, {
        method: "POST",
        body: formData
      });
      
      const result = await response.json();
      setReminderResult(result);
      
      setTimeout(() => {
        setReminderResult(null);
      }, 5000);
      
    } catch (error) {
      console.error("Failed to send reminder:", error);
    } finally {
      setSendingReminder(null);
    }
  };

  // Generate discount code
  const handleGenerateDiscount = async (cart: any) => {
    setSelectedCart(cart);
    setShowDiscountModal(true);
  };

  const handleCreateDiscount = async () => {
    if (!selectedCart) return;
    
    const formData = new FormData();
    formData.append("cartId", selectedCart.cartId);
    formData.append("discount", discountPercentage);
    
    try {
      const response = await fetch(`${window.location.pathname}?action=generate_discount&t=${Date.now()}`, {
        method: "POST",
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ Discount code created: ${result.discountCode}\nValue: ${result.discountValue}\nExpires: ${result.expiresAt}`);
        setShowDiscountModal(false);
        setSelectedCart(null);
      }
      
    } catch (error) {
      console.error("Failed to create discount:", error);
    }
  };

  // If no abandoned carts, show empty state
  const hasAbandonedCarts = cartAnalytics.abandonedCarts > 0 && cartAnalytics.recentAbandonedCarts.length > 0;

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Success Message */}
      {reminderResult && reminderResult.success && (
        <div style={{ 
          position: 'fixed', 
          top: '20px', 
          right: '20px', 
          background: '#EFF7F5', 
          border: '1px solid #50B83C', 
          borderRadius: '8px', 
          padding: '1rem 2rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 1000
        }}>
          <p style={{ color: '#006E52', fontWeight: '600' }}>✅ {reminderResult.message}</p>
          {reminderResult.discountCode && (
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Discount: <strong style={{ color: '#008060' }}>{reminderResult.discountCode}</strong> ({reminderResult.discountValue})
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
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
              🎁 Create Discount Code
            </h3>
            <p style={{ marginBottom: '1rem', color: '#5C5F62' }}>
              For: {selectedCart.customerName || 'Guest Customer'}
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                Discount Percentage
              </label>
              <select
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #8A9199',
                  borderRadius: '6px',
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
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowDiscountModal(false);
                  setSelectedCart(null);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'white',
                  border: '1px solid #8A9199',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDiscount}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#008060',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Create Discount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab("carts")}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === "carts" ? '#008060' : 'white',
            color: activeTab === "carts" ? 'white' : '#212B36',
            border: activeTab === "carts" ? 'none' : '1px solid #8A9199',
            borderRadius: '30px',
            fontSize: '0.95rem',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          🛒 Cart Abandonment {cartAnalytics.abandonedCarts > 0 && `(${cartAnalytics.abandonedCarts})`}
        </button>
        <button
          onClick={() => setActiveTab("funnel")}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === "funnel" ? '#008060' : 'white',
            color: activeTab === "funnel" ? 'white' : '#212B36',
            border: activeTab === "funnel" ? 'none' : '1px solid #8A9199',
            borderRadius: '30px',
            fontSize: '0.95rem',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          📊 Checkout Funnel {checkoutFunnel.checkoutsAbandoned > 0 && `(${checkoutFunnel.checkoutsAbandoned})`}
        </button>
      </div>

      {/* CART ABANDONMENT TAB */}
      {activeTab === "carts" && (
        <div style={{ 
          background: 'white', 
          borderRadius: '16px', 
          border: '1px solid #E4E5E7', 
          padding: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>🛒 Cart Abandonment Recovery</h2>
            <span style={{ 
              padding: '0.5rem 1rem', 
              background: parseFloat(cartAnalytics.abandonmentRate) > 50 ? '#FFF4F4' : '#EFF7F5',
              borderRadius: '20px',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: parseFloat(cartAnalytics.abandonmentRate) > 50 ? '#D82C0D' : '#006E52'
            }}>
              Abandonment Rate: {cartAnalytics.abandonmentRate || '0%'}
            </span>
          </div>
          
          {/* Cart Stats Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem', 
            marginBottom: '2rem' 
          }}>
            <div style={{ padding: '1.25rem', background: '#F6F6F7', borderRadius: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginBottom: '0.25rem' }}>Total Checkouts</p>
              <p style={{ fontSize: '1.75rem', fontWeight: '600' }}>{cartAnalytics.totalCarts || 0}</p>
              <p style={{ fontSize: '0.8rem', color: '#5C5F62' }}>
                {cartAnalytics.cartsWithCheckout || 0} completed • {cartAnalytics.cartsWithoutCheckout || 0} abandoned
              </p>
            </div>
            
            <div style={{ padding: '1.25rem', background: '#F6F6F7', borderRadius: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginBottom: '0.25rem' }}>Abandoned Revenue</p>
              <p style={{ fontSize: '1.75rem', fontWeight: '600', color: cartAnalytics.potentialRevenue > 0 ? '#D82C0D' : '#5C5F62' }}>
                ${cartAnalytics.potentialRevenue.toLocaleString() || 0}
              </p>
              <p style={{ fontSize: '0.8rem', color: '#5C5F62' }}>
                💰 ${cartAnalytics.recoverableRevenue.toLocaleString() || 0} recoverable
              </p>
            </div>
            
            <div style={{ padding: '1.25rem', background: '#F6F6F7', borderRadius: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginBottom: '0.25rem' }}>Recovery Rate</p>
              <p style={{ fontSize: '1.75rem', fontWeight: '600' }}>{cartAnalytics.recoveryRate || '0%'}</p>
              <p style={{ fontSize: '0.8rem', color: '#5C5F62' }}>
                Industry avg: 15-20%
              </p>
            </div>
            
            <div style={{ padding: '1.25rem', background: '#F6F6F7', borderRadius: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginBottom: '0.25rem' }}>Recoverable Customers</p>
              <p style={{ fontSize: '1.75rem', fontWeight: '600' }}>
                {cartAnalytics.recentAbandonedCarts.filter(c => c.isLoggedIn).length || 0}
              </p>
              <p style={{ fontSize: '0.8rem', color: '#5C5F62' }}>
                {cartAnalytics.recentAbandonedCarts.filter(c => c.isLoggedIn).length > 0 
                  ? 'Ready for email reminders' 
                  : 'No email addresses available'}
              </p>
            </div>
          </div>
          
          {/* Top Abandoned Products */}
          {cartAnalytics.topAbandonedProducts.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
                📦 Most Abandoned Products
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {cartAnalytics.topAbandonedProducts.map((product, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '0.75rem',
                    background: '#F6F6F7',
                    borderRadius: '8px'
                  }}>
                    <div>
                      <p style={{ fontWeight: '500' }}>{product.productName}</p>
                      <p style={{ fontSize: '0.8rem', color: '#5C5F62' }}>
                        Abandoned {product.abandonCount} times • {product.quantity} units
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: '600', color: '#D82C0D' }}>
                        ${Math.round(product.totalValue).toLocaleString()}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: '#5C5F62' }}>
                        ${Math.round(product.price)} each
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Recent Abandoned Carts - Recovery Actions */}
          {cartAnalytics.recentAbandonedCarts.length > 0 ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                  🕐 Recent Abandoned Checkouts
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#5C5F62' }}>
                  {cartAnalytics.recentAbandonedCarts.filter(c => c.customerEmail).length} with email
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {cartAnalytics.recentAbandonedCarts.slice(0, 5).map((cart, idx) => (
                  <div key={idx} style={{ 
                    padding: '1rem',
                    background: cart.isLoggedIn ? '#EFF7F5' : '#F6F6F7',
                    borderRadius: '8px',
                    border: cart.isLoggedIn ? '1px solid #50B83C' : '1px solid #E4E5E7'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: '600' }}>
                            {cart.customerName || 'Guest Customer'}
                          </span>
                          {cart.isLoggedIn && (
                            <span style={{ 
                              padding: '0.25rem 0.75rem', 
                              background: '#50B83C', 
                              color: 'white', 
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: '600'
                            }}>
                              LOGGED IN
                            </span>
                          )}
                          {cart.customerEmail && (
                            <span style={{ 
                              padding: '0.25rem 0.75rem', 
                              background: '#008060', 
                              color: 'white', 
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: '600'
                            }}>
                              HAS EMAIL
                            </span>
                          )}
                        </div>
                        
                        {cart.customerEmail && (
                          <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginBottom: '0.25rem' }}>
                            📧 {cart.customerEmail}
                          </p>
                        )}
                        
                        <p style={{ fontSize: '0.8rem', color: '#5C5F62' }}>
                          Abandoned: {new Date(cart.abandonedAt).toLocaleString()}
                        </p>
                        
                        <div style={{ marginTop: '0.5rem' }}>
                          <p style={{ fontSize: '0.8rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                            Items ({cart.itemCount}):
                          </p>
                          {cart.items.slice(0, 2).map((item, itemIdx) => (
                            <p key={itemIdx} style={{ fontSize: '0.75rem', color: '#5C5F62' }}>
                              • {item.quantity}x {item.productName} (${Math.round(item.price * item.quantity)})
                            </p>
                          ))}
                          {cart.items.length > 2 && (
                            <p style={{ fontSize: '0.75rem', color: '#5C5F62' }}>
                              • ...and {cart.items.length - 2} more items
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '1.25rem', fontWeight: '700', color: '#D82C0D', marginBottom: '0.5rem' }}>
                          ${Math.round(cart.totalPrice).toLocaleString()}
                        </p>
                        
                        {cart.customerEmail && (
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                              onClick={() => handleSendReminder(cart)}
                              disabled={sendingReminder === cart.cartId}
                              style={{
                                padding: '0.5rem 1rem',
                                background: sendingReminder === cart.cartId ? '#8A9199' : '#008060',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: '500',
                                cursor: sendingReminder === cart.cartId ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              {sendingReminder === cart.cartId ? '⏳ Sending...' : '✉️ Send Reminder'}
                            </button>
                            
                            <button
                              onClick={() => handleGenerateDiscount(cart)}
                              style={{
                                padding: '0.5rem 1rem',
                                background: 'white',
                                color: '#008060',
                                border: '1px solid #008060',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              🎁 Add Discount
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ 
              padding: '3rem', 
              background: '#F6F6F7', 
              borderRadius: '12px', 
              textAlign: 'center' 
            }}>
              <span style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }}>🛒</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#5C5F62', marginBottom: '0.5rem' }}>
                No Abandoned Checkouts Found
              </h3>
              <p style={{ color: '#8A9199' }}>
                When customers start checkout but don't complete it, they'll appear here for recovery.
              </p>
            </div>
          )}
        </div>
      )}

      {/* CHECKOUT FUNNEL TAB */}
      {activeTab === "funnel" && (
        <div style={{ 
          background: 'white', 
          borderRadius: '16px', 
          border: '1px solid #E4E5E7', 
          padding: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>📊 Checkout Funnel Analytics</h2>
            <span style={{ 
              padding: '0.5rem 1rem', 
              background: '#EFF7F5',
              borderRadius: '20px',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#006E52'
            }}>
              AOV: ${checkoutFunnel.averageOrderValue.toLocaleString() || 0}
            </span>
          </div>
          
          {/* Funnel Stats Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem', 
            marginBottom: '2rem' 
          }}>
            <div style={{ padding: '1.25rem', background: '#F6F6F7', borderRadius: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginBottom: '0.25rem' }}>Checkout Started</p>
              <p style={{ fontSize: '1.75rem', fontWeight: '600' }}>{checkoutFunnel.totalCheckoutStarts || 0}</p>
            </div>
            
            <div style={{ padding: '1.25rem', background: '#F6F6F7', borderRadius: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginBottom: '0.25rem' }}>Completed</p>
              <p style={{ fontSize: '1.75rem', fontWeight: '600', color: checkoutFunnel.checkoutsCompleted > 0 ? '#50B83C' : '#5C5F62' }}>
                {checkoutFunnel.checkoutsCompleted || 0}
              </p>
            </div>
            
            <div style={{ padding: '1.25rem', background: '#F6F6F7', borderRadius: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginBottom: '0.25rem' }}>Abandoned</p>
              <p style={{ fontSize: '1.75rem', fontWeight: '600', color: checkoutFunnel.checkoutsAbandoned > 0 ? '#D82C0D' : '#5C5F62' }}>
                {checkoutFunnel.checkoutsAbandoned || 0}
              </p>
            </div>
            
            <div style={{ padding: '1.25rem', background: '#F6F6F7', borderRadius: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginBottom: '0.25rem' }}>Conversion Rate</p>
              <p style={{ fontSize: '1.75rem', fontWeight: '600' }}>
                {checkoutFunnel.completionRate || '0%'}
              </p>
            </div>
          </div>
          
          {/* Checkout Steps Drop-off */}
          {checkoutFunnel.totalCheckoutStarts > 0 ? (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
                🚶 Where Customers Leave
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {checkoutFunnel.checkoutSteps.map((step, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '500' }}>{step.step}</span>
                      <span style={{ color: step.dropoffRate.includes('0%') ? '#50B83C' : '#D82C0D', fontWeight: '600' }}>
                        {step.completed} / {step.entered} ({step.dropoffRate} drop-off)
                      </span>
                    </div>
                    <div style={{ height: '8px', background: '#E4E5E7', borderRadius: '4px' }}>
                      <div style={{ 
                        width: `${(step.completed / step.entered) * 100}%`, 
                        height: '100%', 
                        background: step.dropoffRate.includes('0%') ? '#50B83C' : '#008060', 
                        borderRadius: '4px' 
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ 
              padding: '2rem', 
              background: '#F6F6F7', 
              borderRadius: '12px', 
              textAlign: 'center',
              marginBottom: '2rem'
            }}>
              <p style={{ color: '#5C5F62' }}>
                No checkout data available yet. When customers start checkout, you'll see the funnel here.
              </p>
            </div>
          )}
          
          {/* Recovery Impact */}
          {checkoutFunnel.checkoutsAbandoned > 0 && (
            <div style={{ 
              padding: '1.5rem', 
              background: 'linear-gradient(135deg, #F6F6F7, #F1F2F3)',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <div>
                <p style={{ fontSize: '0.9rem', color: '#5C5F62', marginBottom: '0.25rem' }}>
                  Estimated Impact of Cart Recovery
                </p>
                <p style={{ fontSize: '1.25rem', fontWeight: '600', color: '#006E52' }}>
                  +{checkoutFunnel.purchasesAfterReminder || 0} additional purchases per month
                </p>
                <p style={{ fontSize: '0.8rem', color: '#5C5F62', marginTop: '0.25rem' }}>
                  Based on 18% industry average recovery rate
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.9rem', color: '#5C5F62' }}>Potential Revenue</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#008060' }}>
                  ${cartAnalytics.recoverableRevenue.toLocaleString() || 0}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}