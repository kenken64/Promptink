# TRMNL Photo Frame Purchase Flow - Implementation Plan

## Overview

This document outlines the implementation plan for adding a purchase flow for the TRMNL e-ink photo frame display after user login.

### Business Model

| Item | Price | Type |
|------|-------|------|
| TRMNL Photo Frame | $120.00 | One-time purchase |
| PromptInk Service | $5.99/month | Recurring subscription |

- **First purchase** unlocks the monthly subscription
- **Subsequent purchases** do not create new subscriptions
- Users can order **multiple frames** (for gifts, multiple rooms, etc.)
- One subscription covers all frames for the account

---

## User Flow

### Post-Login Flow

```
Login Success → Check subscription status
      │
      ├─ NO orders ever → Redirect to /purchase
      │     "Get your first TRMNL frame to unlock PromptInk"
      │
      ├─ Has order + Active subscription → Dashboard
      │     • Full access to image generation
      │     • "Order Another Frame" button visible
      │     • "My Orders" link in navigation
      │
      └─ Has order + Subscription lapsed → /reactivate
            "Reactivate your subscription to continue"
```

### Purchase Flow

```
/purchase → Fill shipping & gift details → Razorpay Payment
      │
      ├─ First order → Payment success → Create subscription → /order-confirmation
      │
      └─ Subsequent orders → Payment success → /order-confirmation
```

---

## Database Schema

### New Tables

#### `orders` - Stores all frame purchases

```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_number TEXT UNIQUE NOT NULL,          -- ORD-20240115-XXXX (human readable)
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,

  -- Pricing
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,                -- 12000 (in paise/cents)
  total_amount INTEGER NOT NULL,              -- quantity * unit_price
  currency TEXT DEFAULT 'USD',

  -- Order status
  status TEXT DEFAULT 'pending',              -- pending, paid, processing, shipped, delivered, cancelled

  -- Shipping details
  shipping_name TEXT NOT NULL,
  shipping_email TEXT,
  shipping_phone TEXT NOT NULL,
  shipping_address_line1 TEXT NOT NULL,
  shipping_address_line2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_postal_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL,

  -- Gift details
  is_gift BOOLEAN DEFAULT FALSE,
  gift_recipient_name TEXT,
  gift_message TEXT,

  -- Tracking
  tracking_number TEXT,
  carrier TEXT,                               -- FedEx, UPS, DHL, USPS, etc.
  tracking_url TEXT,

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME,
  shipped_at DATETIME,
  delivered_at DATETIME,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
```

#### `order_devices` - Individual devices for each order (for future device linking)

```sql
CREATE TABLE order_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  serial_number TEXT,
  mac_address TEXT,
  activation_status TEXT DEFAULT 'pending',   -- pending, activated
  activated_at DATETIME,

  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX idx_order_devices_order_id ON order_devices(order_id);
CREATE INDEX idx_order_devices_serial ON order_devices(serial_number);
```

### Modifications to Existing Tables

#### `users` - Add subscription fields

```sql
ALTER TABLE users ADD COLUMN razorpay_customer_id TEXT;
ALTER TABLE users ADD COLUMN subscription_id TEXT;
ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'none';  -- none, active, paused, cancelled, past_due
ALTER TABLE users ADD COLUMN subscription_current_period_end DATETIME;
ALTER TABLE users ADD COLUMN first_order_id INTEGER REFERENCES orders(id);
```

---

## API Endpoints

### Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/orders` | Yes | Create new order with Razorpay |
| `POST` | `/api/orders/verify` | Yes | Verify Razorpay payment signature |
| `GET` | `/api/orders` | Yes | Get all orders for current user |
| `GET` | `/api/orders/:id` | Yes | Get specific order details |
| `GET` | `/api/orders/:id/tracking` | Yes | Get tracking information |

### Subscription

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/subscription/status` | Yes | Get current subscription status |
| `POST` | `/api/subscription/cancel` | Yes | Cancel subscription |
| `POST` | `/api/subscription/reactivate` | Yes | Reactivate cancelled subscription |

### Razorpay Webhooks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/razorpay/webhook` | Signature | Handle Razorpay webhook events |

---

## API Request/Response Examples

### POST /api/orders - Create Order

**Request:**
```json
{
  "quantity": 2,
  "shipping": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "addressLine1": "123 Main Street",
    "addressLine2": "Apt 4B",
    "city": "Singapore",
    "state": "Singapore",
    "postalCode": "123456",
    "country": "Singapore"
  },
  "gift": {
    "isGift": true,
    "recipientName": "Mom",
    "message": "Happy Birthday! Enjoy your new display!"
  }
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": 1,
    "orderNumber": "ORD-20240115-A1B2",
    "quantity": 2,
    "unitPrice": 12000,
    "totalAmount": 24000,
    "currency": "USD",
    "status": "pending"
  },
  "razorpay": {
    "orderId": "order_ABC123",
    "amount": 24000,
    "currency": "USD",
    "keyId": "rzp_live_xxxxx"
  }
}
```

### POST /api/orders/verify - Verify Payment

**Request:**
```json
{
  "orderId": 1,
  "razorpay_order_id": "order_ABC123",
  "razorpay_payment_id": "pay_XYZ789",
  "razorpay_signature": "signature_hash"
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": 1,
    "orderNumber": "ORD-20240115-A1B2",
    "status": "paid",
    "paidAt": "2024-01-15T10:30:00Z"
  },
  "subscription": {
    "id": "sub_ABC123",
    "status": "active",
    "currentPeriodEnd": "2024-02-15T10:30:00Z"
  }
}
```

### GET /api/orders - List Orders

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": 2,
      "orderNumber": "ORD-20240115-A1B2",
      "quantity": 2,
      "totalAmount": 24000,
      "currency": "USD",
      "status": "shipped",
      "shipping": {
        "name": "John Doe",
        "city": "Singapore",
        "country": "Singapore"
      },
      "isGift": true,
      "giftRecipientName": "Mom",
      "tracking": {
        "number": "1Z999AA10123456784",
        "carrier": "UPS",
        "url": "https://ups.com/track?num=1Z999AA10123456784"
      },
      "createdAt": "2024-01-15T10:00:00Z",
      "paidAt": "2024-01-15T10:30:00Z",
      "shippedAt": "2024-01-16T14:00:00Z"
    },
    {
      "id": 1,
      "orderNumber": "ORD-20240110-X9Y8",
      "quantity": 1,
      "totalAmount": 12000,
      "currency": "USD",
      "status": "delivered",
      "shipping": {
        "name": "John Doe",
        "city": "Singapore",
        "country": "Singapore"
      },
      "isGift": false,
      "createdAt": "2024-01-10T09:00:00Z",
      "paidAt": "2024-01-10T09:15:00Z",
      "shippedAt": "2024-01-11T10:00:00Z",
      "deliveredAt": "2024-01-14T16:00:00Z"
    }
  ]
}
```

### GET /api/subscription/status

**Response:**
```json
{
  "success": true,
  "subscription": {
    "status": "active",
    "currentPeriodEnd": "2024-02-15T10:30:00Z",
    "cancelAtPeriodEnd": false
  },
  "hasCompletedOrder": true,
  "totalOrdersCount": 2
}
```

---

## Razorpay Integration

### Environment Variables

```env
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
RAZORPAY_PLAN_ID=plan_xxxxx          # $5.99/month subscription plan
```

### Razorpay Dashboard Setup

1. **Create Product**: TRMNL Photo Frame - $120
2. **Create Plan**: PromptInk Monthly - $5.99/month
3. **Configure Webhook URL**: `https://yourdomain.com/api/razorpay/webhook`
4. **Enable Webhook Events**:
   - `payment.captured`
   - `payment.failed`
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.cancelled`
   - `subscription.paused`
   - `subscription.resumed`

### Webhook Events to Handle

| Event | Action |
|-------|--------|
| `payment.captured` | Update order status to `paid`, create subscription if first order |
| `payment.failed` | Update order status, notify user |
| `subscription.activated` | Update user subscription status to `active` |
| `subscription.charged` | Update `subscription_current_period_end` |
| `subscription.cancelled` | Update user subscription status to `cancelled` |
| `subscription.paused` | Update user subscription status to `paused` |

---

## Frontend Pages & Components

### New Pages

#### 1. PurchasePage (`/purchase`)

```
┌──────────────────────────────────────────────────────────────┐
│  TRMNL Photo Frame                                           │
│  AI-powered e-ink display for your space                     │
│                                                              │
│  $120.00 each                                                │
│                                                              │
│  Quantity:  [ - ]  2  [ + ]                                  │
│                                                              │
│  ☐ This is a gift                                            │
│                                                              │
│  ── Shipping Address ──────────────────────────────────────  │
│  Full Name:     [_______________________________]            │
│  Email:         [_______________________________]            │
│  Phone:         [_______________________________]            │
│  Address:       [_______________________________]            │
│  Address 2:     [_______________________________]            │
│  City:          [_______________] State: [_____]             │
│  Postal Code:   [________] Country: [__________]             │
│                                                              │
│  ── Gift Card (optional) ──────────────────────────────────  │
│  Recipient:     [_______________________________]            │
│  Message:       [_______________________________]            │
│                 [_______________________________]            │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│  Subtotal (2 frames):                    $240.00             │
│  Monthly subscription:                   + $5.99/mo          │
│  (subscription starts after first order)                     │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  [ Pay $240.00 with Razorpay ]                               │
└──────────────────────────────────────────────────────────────┘
```

#### 2. OrderConfirmationPage (`/order-confirmation/:orderId`)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ✓ Order Confirmed!                                          │
│                                                              │
│  Order #ORD-20240115-A1B2                                    │
│                                                              │
│  Thank you for your purchase! We'll send you an email        │
│  with tracking information once your order ships.            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Order Summary                                          │  │
│  │                                                        │  │
│  │ 2x TRMNL Photo Frame                       $240.00     │  │
│  │                                                        │  │
│  │ Shipping to:                                           │  │
│  │ John Doe                                               │  │
│  │ 123 Main Street, Apt 4B                                │  │
│  │ Singapore, 123456                                      │  │
│  │                                                        │  │
│  │ 🎁 Gift for: Mom                                       │  │
│  │ "Happy Birthday! Enjoy your new display!"              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Your subscription ($5.99/month) is now active!              │
│                                                              │
│  [ View My Orders ]        [ Start Creating Images → ]       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 3. OrdersPage (`/orders`)

```
┌──────────────────────────────────────────────────────────────┐
│  My Orders                        [ Order Another Frame ]    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Order #ORD-20240115-A1B2                               │  │
│  │ Placed: Jan 15, 2024                                   │  │
│  │ Status: 🚚 Shipped                                     │  │
│  │                                                        │  │
│  │ 2x TRMNL Photo Frame              $240.00              │  │
│  │                                                        │  │
│  │ Shipping to:                                           │  │
│  │ John Doe                                               │  │
│  │ 123 Main St, Singapore 123456                          │  │
│  │                                                        │  │
│  │ Tracking: 1Z999AA10123456784 (UPS)                     │  │
│  │ [ Track Package ]                                      │  │
│  │                                                        │  │
│  │ 🎁 Gift for: Mom                                       │  │
│  │ "Happy Birthday! Enjoy your new display!"              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Order #ORD-20240110-X9Y8                               │  │
│  │ Placed: Jan 10, 2024                                   │  │
│  │ Status: ✅ Delivered                                   │  │
│  │                                                        │  │
│  │ 1x TRMNL Photo Frame              $120.00              │  │
│  │                                                        │  │
│  │ Delivered: Jan 14, 2024                                │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

#### 4. SubscriptionPage (`/subscription`)

```
┌──────────────────────────────────────────────────────────────┐
│  Subscription                                                │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ PromptInk Monthly                                      │  │
│  │                                                        │  │
│  │ Status: ✓ Active                                       │  │
│  │ Price: $5.99/month                                     │  │
│  │ Next billing date: Feb 15, 2024                        │  │
│  │                                                        │  │
│  │ [ Cancel Subscription ]                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Billing History                                             │
│                                                              │
│  Jan 15, 2024    $5.99    ✓ Paid                            │
│  Dec 15, 2023    $5.99    ✓ Paid                            │
│  Nov 15, 2023    $5.99    ✓ Paid                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 5. ReactivateSubscriptionPage (`/reactivate`)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Your subscription has expired                               │
│                                                              │
│  Reactivate your subscription to continue creating           │
│  AI-powered images for your TRMNL display.                   │
│                                                              │
│  $5.99/month                                                 │
│                                                              │
│  [ Reactivate Subscription ]                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Updated Components

#### AuthGuard.tsx

Update to check both authentication AND subscription status:

```tsx
// Pseudocode for AuthGuard logic
const user = useAuth();
const { hasCompletedOrder, subscriptionStatus } = useSubscription();

if (!user) {
  return <Navigate to="/login" />;
}

if (!hasCompletedOrder) {
  return <Navigate to="/purchase" />;
}

if (subscriptionStatus === 'cancelled' || subscriptionStatus === 'past_due') {
  return <Navigate to="/reactivate" />;
}

return children;
```

#### Navigation Updates

Add to main navigation:
- "My Orders" link
- "Subscription" link
- "Order Another Frame" button (on dashboard)

### New Hooks

#### useOrders.ts

```typescript
interface UseOrders {
  orders: Order[];
  loading: boolean;
  error: string | null;
  createOrder: (data: CreateOrderData) => Promise<CreateOrderResponse>;
  verifyPayment: (data: VerifyPaymentData) => Promise<VerifyPaymentResponse>;
  refetch: () => void;
}
```

#### useSubscription.ts

```typescript
interface UseSubscription {
  status: 'none' | 'active' | 'cancelled' | 'paused' | 'past_due';
  currentPeriodEnd: Date | null;
  hasCompletedOrder: boolean;
  loading: boolean;
  cancel: () => Promise<void>;
  reactivate: () => Promise<void>;
}
```

---

## Order Status Flow

```
pending → paid → processing → shipped → delivered
    │
    └→ cancelled (can happen at pending or paid stage)
```

| Status | Description |
|--------|-------------|
| `pending` | Order created, awaiting payment |
| `paid` | Payment received, awaiting fulfillment |
| `processing` | Order being prepared for shipment |
| `shipped` | Order shipped, tracking available |
| `delivered` | Order delivered to customer |
| `cancelled` | Order cancelled (refund if applicable) |

---

## Subscription Status Flow

```
none → active → cancelled
         │          │
         └→ paused ←┘
              │
              └→ active (resumed)
```

| Status | Description | App Access |
|--------|-------------|------------|
| `none` | No subscription yet | No access (redirect to purchase) |
| `active` | Subscription active | Full access |
| `paused` | Temporarily paused | Limited access |
| `cancelled` | Subscription cancelled | No access (redirect to reactivate) |
| `past_due` | Payment failed | No access (redirect to update payment) |

---

## File Structure

### Backend

```
backend/src/
├── routes/
│   ├── orders.ts              # Order CRUD endpoints
│   ├── subscription.ts        # Subscription management
│   └── razorpay-webhook.ts    # Webhook handler
├── services/
│   ├── order-service.ts       # Order business logic
│   ├── subscription-service.ts # Subscription logic
│   └── razorpay-service.ts    # Razorpay API integration
├── db/
│   └── schema.ts              # Updated schema with orders table
└── types/
    └── orders.ts              # Order type definitions
```

### Frontend

```
frontend/src/
├── pages/
│   ├── PurchasePage.tsx
│   ├── OrderConfirmationPage.tsx
│   ├── OrdersPage.tsx
│   ├── SubscriptionPage.tsx
│   └── ReactivateSubscriptionPage.tsx
├── components/
│   ├── orders/
│   │   ├── OrderCard.tsx
│   │   ├── OrderDetails.tsx
│   │   ├── ShippingForm.tsx
│   │   ├── GiftForm.tsx
│   │   └── QuantitySelector.tsx
│   ├── subscription/
│   │   ├── SubscriptionStatus.tsx
│   │   └── BillingHistory.tsx
│   └── checkout/
│       └── RazorpayButton.tsx
├── hooks/
│   ├── useOrders.ts
│   └── useSubscription.ts
└── types/
    ├── order.ts
    └── subscription.ts
```

---

## Security Considerations

1. **Payment Verification**: Always verify Razorpay signatures server-side
2. **Webhook Authentication**: Validate webhook signatures using `RAZORPAY_WEBHOOK_SECRET`
3. **Order Access Control**: Users can only view their own orders
4. **Subscription Validation**: Check subscription status on protected routes
5. **Idempotency**: Handle duplicate webhook events gracefully

---

## Test Cases

This section provides comprehensive test cases to ensure nothing is missed during implementation.

### 1. Unit Tests - Backend Services

#### 1.1 Order Service (`order-service.ts`)

| Test ID | Test Case | Input | Expected Output |
|---------|-----------|-------|-----------------|
| ORD-U-001 | Create order with valid data | Valid shipping, quantity=1 | Order created with status 'pending' |
| ORD-U-002 | Create order with multiple quantities | quantity=3 | totalAmount = 3 * unitPrice |
| ORD-U-003 | Create order with gift details | isGift=true, recipientName, message | Order saved with gift fields |
| ORD-U-004 | Create order without gift details | isGift=false | gift fields are null |
| ORD-U-005 | Generate unique order number | - | Format: ORD-YYYYMMDD-XXXX |
| ORD-U-006 | Order number uniqueness | Create 1000 orders | No duplicate order numbers |
| ORD-U-007 | Calculate total amount | quantity=2, unitPrice=12000 | totalAmount=24000 |
| ORD-U-008 | Get order by ID (owner) | orderId, userId (owner) | Returns order |
| ORD-U-009 | Get order by ID (non-owner) | orderId, userId (different) | Returns null or throws |
| ORD-U-010 | Get all orders for user | userId | Returns array of user's orders |
| ORD-U-011 | Update order status | orderId, status='paid' | Order status updated |
| ORD-U-012 | Update order with tracking | orderId, trackingNumber, carrier | Tracking info saved |
| ORD-U-013 | Invalid status transition | pending → delivered (skip) | Throws error or handles gracefully |

#### 1.2 Subscription Service (`subscription-service.ts`)

| Test ID | Test Case | Input | Expected Output |
|---------|-----------|-------|-----------------|
| SUB-U-001 | Create subscription (first order) | userId, razorpay subscription data | Subscription created, status='active' |
| SUB-U-002 | Skip subscription (subsequent order) | userId with existing subscription | No new subscription created |
| SUB-U-003 | Get subscription status | userId | Returns status object |
| SUB-U-004 | Cancel subscription | userId | Status changed to 'cancelled' |
| SUB-U-005 | Reactivate subscription | userId (cancelled) | New subscription created, status='active' |
| SUB-U-006 | Update subscription period end | userId, newDate | currentPeriodEnd updated |
| SUB-U-007 | Check has completed order | userId with paid order | Returns true |
| SUB-U-008 | Check has completed order (no orders) | userId without orders | Returns false |
| SUB-U-009 | Check has completed order (pending only) | userId with pending order | Returns false |
| SUB-U-010 | Handle subscription paused | userId | Status changed to 'paused' |
| SUB-U-011 | Handle subscription past_due | userId | Status changed to 'past_due' |

#### 1.3 Razorpay Service (`razorpay-service.ts`)

| Test ID | Test Case | Input | Expected Output |
|---------|-----------|-------|-----------------|
| RZP-U-001 | Create Razorpay order | amount, currency | Returns razorpay order_id |
| RZP-U-002 | Verify payment signature (valid) | order_id, payment_id, valid signature | Returns true |
| RZP-U-003 | Verify payment signature (invalid) | order_id, payment_id, invalid signature | Returns false |
| RZP-U-004 | Create subscription | customerId, planId | Returns subscription_id |
| RZP-U-005 | Cancel subscription | subscriptionId | Subscription cancelled |
| RZP-U-006 | Create customer | email, name | Returns customer_id |
| RZP-U-007 | Handle Razorpay API error | Invalid API key | Throws appropriate error |
| RZP-U-008 | Handle network timeout | Simulated timeout | Throws timeout error |

---

### 2. API Integration Tests

#### 2.1 POST /api/orders - Create Order

| Test ID | Test Case | Request | Expected Response |
|---------|-----------|---------|-------------------|
| ORD-A-001 | Create order - valid data | Valid shipping, quantity=1 | 201, order + razorpay data |
| ORD-A-002 | Create order - multiple quantity | quantity=5 | 201, totalAmount=60000 |
| ORD-A-003 | Create order - with gift | isGift=true, recipientName, message | 201, gift fields in response |
| ORD-A-004 | Create order - missing shipping name | shipping.name missing | 400, validation error |
| ORD-A-005 | Create order - missing address | addressLine1 missing | 400, validation error |
| ORD-A-006 | Create order - missing phone | phone missing | 400, validation error |
| ORD-A-007 | Create order - invalid email format | email="invalid" | 400, validation error |
| ORD-A-008 | Create order - quantity=0 | quantity=0 | 400, validation error |
| ORD-A-009 | Create order - negative quantity | quantity=-1 | 400, validation error |
| ORD-A-010 | Create order - very large quantity | quantity=1000 | 400 or business rule limit |
| ORD-A-011 | Create order - no auth token | Missing Authorization header | 401, unauthorized |
| ORD-A-012 | Create order - invalid token | Invalid JWT | 401, unauthorized |
| ORD-A-013 | Create order - expired token | Expired JWT | 401, unauthorized |
| ORD-A-014 | Create order - gift without recipient | isGift=true, no recipientName | 400, validation error |
| ORD-A-015 | Create order - special chars in address | Address with unicode/emoji | 201, stored correctly |

#### 2.2 POST /api/orders/verify - Verify Payment

| Test ID | Test Case | Request | Expected Response |
|---------|-----------|---------|-------------------|
| VER-A-001 | Verify - valid signature | Valid razorpay signature | 200, order status='paid' |
| VER-A-002 | Verify - invalid signature | Tampered signature | 400, signature mismatch |
| VER-A-003 | Verify - first order | First order for user | 200, subscription created |
| VER-A-004 | Verify - subsequent order | User has existing subscription | 200, no new subscription |
| VER-A-005 | Verify - order not found | Non-existent orderId | 404, order not found |
| VER-A-006 | Verify - order not owned | Order belongs to another user | 403, forbidden |
| VER-A-007 | Verify - already verified | Order already paid | 400, already processed |
| VER-A-008 | Verify - missing order_id | razorpay_order_id missing | 400, validation error |
| VER-A-009 | Verify - missing payment_id | razorpay_payment_id missing | 400, validation error |
| VER-A-010 | Verify - missing signature | razorpay_signature missing | 400, validation error |

#### 2.3 GET /api/orders - List Orders

| Test ID | Test Case | Request | Expected Response |
|---------|-----------|---------|-------------------|
| LST-A-001 | List orders - user with orders | Authenticated user | 200, array of orders |
| LST-A-002 | List orders - user without orders | New user | 200, empty array |
| LST-A-003 | List orders - pagination | page=1, limit=10 | 200, paginated results |
| LST-A-004 | List orders - sorted by date | - | Orders sorted by createdAt DESC |
| LST-A-005 | List orders - no auth | Missing token | 401, unauthorized |
| LST-A-006 | List orders - only own orders | User A requests | Only User A's orders returned |

#### 2.4 GET /api/orders/:id - Get Order Details

| Test ID | Test Case | Request | Expected Response |
|---------|-----------|---------|-------------------|
| GET-A-001 | Get order - valid owner | Own order ID | 200, full order details |
| GET-A-002 | Get order - not owner | Another user's order ID | 403, forbidden |
| GET-A-003 | Get order - not found | Non-existent ID | 404, not found |
| GET-A-004 | Get order - invalid ID format | id="abc" | 400, invalid ID |

#### 2.5 GET /api/subscription/status

| Test ID | Test Case | Request | Expected Response |
|---------|-----------|---------|-------------------|
| STS-A-001 | Status - active subscription | User with active sub | 200, status='active' |
| STS-A-002 | Status - no subscription | New user | 200, status='none' |
| STS-A-003 | Status - cancelled | User cancelled | 200, status='cancelled' |
| STS-A-004 | Status - past_due | Payment failed | 200, status='past_due' |
| STS-A-005 | Status - includes period end | Active sub | 200, currentPeriodEnd present |
| STS-A-006 | Status - no auth | Missing token | 401, unauthorized |

#### 2.6 POST /api/subscription/cancel

| Test ID | Test Case | Request | Expected Response |
|---------|-----------|---------|-------------------|
| CAN-A-001 | Cancel - active subscription | User with active sub | 200, status='cancelled' |
| CAN-A-002 | Cancel - already cancelled | User already cancelled | 400, already cancelled |
| CAN-A-003 | Cancel - no subscription | User without sub | 400, no subscription |
| CAN-A-004 | Cancel - Razorpay API failure | Simulated failure | 500, error message |

#### 2.7 POST /api/subscription/reactivate

| Test ID | Test Case | Request | Expected Response |
|---------|-----------|---------|-------------------|
| REA-A-001 | Reactivate - cancelled sub | Cancelled user | 200, new subscription active |
| REA-A-002 | Reactivate - already active | Active user | 400, already active |
| REA-A-003 | Reactivate - no prior sub | New user | 400, must purchase first |

#### 2.8 POST /api/razorpay/webhook

| Test ID | Test Case | Request | Expected Response |
|---------|-----------|---------|-------------------|
| WHK-A-001 | Webhook - payment.captured | Valid event + signature | 200, order updated to 'paid' |
| WHK-A-002 | Webhook - payment.failed | Valid event | 200, order status unchanged |
| WHK-A-003 | Webhook - subscription.activated | Valid event | 200, user sub status='active' |
| WHK-A-004 | Webhook - subscription.charged | Valid event | 200, period end updated |
| WHK-A-005 | Webhook - subscription.cancelled | Valid event | 200, user sub status='cancelled' |
| WHK-A-006 | Webhook - invalid signature | Wrong signature | 400, signature invalid |
| WHK-A-007 | Webhook - duplicate event | Same event twice | 200, idempotent (no duplicate action) |
| WHK-A-008 | Webhook - unknown event type | event='unknown.event' | 200, ignored gracefully |
| WHK-A-009 | Webhook - malformed payload | Invalid JSON | 400, parse error |
| WHK-A-010 | Webhook - missing signature header | No X-Razorpay-Signature | 400, missing signature |

---

### 3. Frontend Component Tests

#### 3.1 PurchasePage

| Test ID | Test Case | Action | Expected Result |
|---------|-----------|--------|-----------------|
| PUR-F-001 | Render purchase page | Navigate to /purchase | Form displayed with all fields |
| PUR-F-002 | Quantity increment | Click + button | Quantity increases, total updates |
| PUR-F-003 | Quantity decrement | Click - button | Quantity decreases (min 1) |
| PUR-F-004 | Quantity minimum | Try to go below 1 | Stays at 1 |
| PUR-F-005 | Toggle gift option | Check "This is a gift" | Gift form fields appear |
| PUR-F-006 | Gift form hidden by default | Load page | Gift fields not visible |
| PUR-F-007 | Total calculation | quantity=3 | Shows $360.00 |
| PUR-F-008 | Form validation - empty name | Submit with empty name | Error shown on name field |
| PUR-F-009 | Form validation - empty address | Submit with empty address | Error shown on address field |
| PUR-F-010 | Form validation - invalid phone | Enter invalid phone | Error shown on phone field |
| PUR-F-011 | Form validation - invalid email | Enter invalid email | Error shown on email field |
| PUR-F-012 | Form validation - gift without recipient | Gift checked, no recipient | Error shown |
| PUR-F-013 | Submit valid form | Fill all required fields | Razorpay checkout opens |
| PUR-F-014 | Loading state | Submit form | Button shows loading spinner |
| PUR-F-015 | Error handling | API returns error | Error message displayed |
| PUR-F-016 | Subscription note (first order) | New user | Shows "subscription starts after first order" |
| PUR-F-017 | Subscription note (existing) | User with sub | Shows "subscription already active" |

#### 3.2 OrderConfirmationPage

| Test ID | Test Case | Action | Expected Result |
|---------|-----------|--------|-----------------|
| CNF-F-001 | Display order confirmation | Navigate after payment | Shows success message |
| CNF-F-002 | Show order number | - | Order number displayed |
| CNF-F-003 | Show order summary | - | Quantity, total, shipping address shown |
| CNF-F-004 | Show gift details | Gift order | Gift recipient and message shown |
| CNF-F-005 | Hide gift section | Non-gift order | Gift section not visible |
| CNF-F-006 | Subscription activation message | First order | Shows "subscription now active" |
| CNF-F-007 | No subscription message | Subsequent order | No subscription message |
| CNF-F-008 | View My Orders button | Click | Navigates to /orders |
| CNF-F-009 | Start Creating button | Click | Navigates to dashboard |
| CNF-F-010 | Invalid order ID | Navigate with bad ID | Shows error or redirects |

#### 3.3 OrdersPage

| Test ID | Test Case | Action | Expected Result |
|---------|-----------|--------|-----------------|
| ORD-F-001 | Display orders list | Navigate to /orders | All orders displayed |
| ORD-F-002 | Empty state | User with no orders | Shows "No orders yet" message |
| ORD-F-003 | Order card details | - | Shows order#, date, status, amount |
| ORD-F-004 | Order status badge | Different statuses | Correct badge/icon for each status |
| ORD-F-005 | Gift indicator | Gift order | Shows gift icon and recipient |
| ORD-F-006 | Tracking info | Shipped order | Shows tracking number and carrier |
| ORD-F-007 | Track Package button | Click | Opens tracking URL in new tab |
| ORD-F-008 | Track Package hidden | Not shipped yet | Button not visible |
| ORD-F-009 | Order Another Frame button | Click | Navigates to /purchase |
| ORD-F-010 | Orders sorted | Multiple orders | Most recent first |
| ORD-F-011 | Loading state | Page load | Shows loading spinner |
| ORD-F-012 | Error state | API failure | Shows error message |

#### 3.4 SubscriptionPage

| Test ID | Test Case | Action | Expected Result |
|---------|-----------|--------|-----------------|
| SUB-F-001 | Display active subscription | Active user | Shows active status, price, next billing |
| SUB-F-002 | Display cancelled subscription | Cancelled user | Shows cancelled status |
| SUB-F-003 | Cancel button visible | Active sub | Cancel button shown |
| SUB-F-004 | Cancel button hidden | Cancelled sub | Cancel button not shown |
| SUB-F-005 | Cancel confirmation | Click cancel | Confirmation dialog appears |
| SUB-F-006 | Cancel confirmed | Confirm cancel | Subscription cancelled, UI updates |
| SUB-F-007 | Cancel dismissed | Dismiss dialog | No action taken |
| SUB-F-008 | Billing history | - | List of past payments shown |
| SUB-F-009 | Next billing date | Active sub | Shows correct date |

#### 3.5 ReactivateSubscriptionPage

| Test ID | Test Case | Action | Expected Result |
|---------|-----------|--------|-----------------|
| REA-F-001 | Display reactivate page | Navigate when cancelled | Shows reactivation offer |
| REA-F-002 | Show subscription price | - | $5.99/month displayed |
| REA-F-003 | Reactivate button | Click | Razorpay checkout opens |
| REA-F-004 | Successful reactivation | Payment success | Redirects to dashboard |
| REA-F-005 | Failed reactivation | Payment fails | Error message shown |

#### 3.6 AuthGuard Component

| Test ID | Test Case | Condition | Expected Result |
|---------|-----------|-----------|-----------------|
| AGD-F-001 | Not logged in | No user | Redirect to /login |
| AGD-F-002 | Logged in, no order | User, no orders | Redirect to /purchase |
| AGD-F-003 | Logged in, active sub | User, active sub | Show protected content |
| AGD-F-004 | Logged in, cancelled sub | User, cancelled | Redirect to /reactivate |
| AGD-F-005 | Logged in, past_due | User, past_due | Redirect to /reactivate |
| AGD-F-006 | Loading state | Checking status | Show loading spinner |

#### 3.7 Hooks Tests

##### useOrders Hook

| Test ID | Test Case | Action | Expected Result |
|---------|-----------|--------|-----------------|
| HKO-F-001 | Fetch orders on mount | Hook mounts | Orders fetched from API |
| HKO-F-002 | Loading state | During fetch | loading=true |
| HKO-F-003 | Success state | Fetch complete | orders populated, loading=false |
| HKO-F-004 | Error state | API fails | error set, loading=false |
| HKO-F-005 | createOrder function | Call with data | API called, returns response |
| HKO-F-006 | verifyPayment function | Call with data | API called, returns response |
| HKO-F-007 | refetch function | Call refetch | Orders re-fetched |

##### useSubscription Hook

| Test ID | Test Case | Action | Expected Result |
|---------|-----------|--------|-----------------|
| HKS-F-001 | Fetch status on mount | Hook mounts | Status fetched from API |
| HKS-F-002 | hasCompletedOrder true | User has paid order | hasCompletedOrder=true |
| HKS-F-003 | hasCompletedOrder false | No paid orders | hasCompletedOrder=false |
| HKS-F-004 | cancel function | Call cancel | API called, status updates |
| HKS-F-005 | reactivate function | Call reactivate | API called, status updates |

---

### 4. End-to-End (E2E) Tests

#### 4.1 Complete Purchase Flow - First Time User

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| E2E-001 | New user complete purchase | 1. Register<br>2. Auto-redirect to /purchase<br>3. Fill shipping details<br>4. Complete Razorpay payment<br>5. Verify confirmation page<br>6. Access dashboard | User can generate images |
| E2E-002 | New user with gift purchase | 1. Register<br>2. Fill shipping + gift details<br>3. Complete payment<br>4. Verify gift info on confirmation | Gift details stored and displayed |

#### 4.2 Returning User Flows

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| E2E-003 | Returning user - active sub | 1. Login<br>2. Verify direct dashboard access | No purchase redirect |
| E2E-004 | Returning user - order another | 1. Login<br>2. Go to /purchase<br>3. Complete order | Order placed, no new subscription |
| E2E-005 | Returning user - cancelled sub | 1. Login<br>2. Verify redirect to /reactivate<br>3. Reactivate<br>4. Access dashboard | Subscription reactivated |

#### 4.3 Order Management Flow

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| E2E-006 | View order history | 1. Login<br>2. Navigate to /orders<br>3. View order details | All orders displayed correctly |
| E2E-007 | Track shipped order | 1. Login<br>2. Go to /orders<br>3. Click Track Package | Tracking URL opens |

#### 4.4 Subscription Management Flow

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| E2E-008 | Cancel subscription | 1. Login<br>2. Go to /subscription<br>3. Click Cancel<br>4. Confirm | Subscription cancelled |
| E2E-009 | Cancel then reactivate | 1. Cancel subscription<br>2. Try to access dashboard<br>3. Redirect to reactivate<br>4. Complete reactivation | Access restored |

---

### 5. Edge Cases & Error Scenarios

#### 5.1 Payment Edge Cases

| Test ID | Test Case | Scenario | Expected Behavior |
|---------|-----------|----------|-------------------|
| EDG-001 | Payment timeout | User closes Razorpay before completing | Order stays 'pending', can retry |
| EDG-002 | Payment declined | Card declined | Error message, order stays 'pending' |
| EDG-003 | Network error during payment | Connection lost | Error message, can retry |
| EDG-004 | Double payment attempt | User clicks pay twice | Only one order created (idempotent) |
| EDG-005 | Browser back after payment | User presses back | Handled gracefully, no duplicate |
| EDG-006 | Refresh on confirmation | Refresh confirmation page | Order details still shown |

#### 5.2 Webhook Edge Cases

| Test ID | Test Case | Scenario | Expected Behavior |
|---------|-----------|----------|-------------------|
| EDG-007 | Webhook before verify | Webhook arrives before client verify | Order updated correctly |
| EDG-008 | Duplicate webhook | Same webhook sent twice | Idempotent, no duplicate processing |
| EDG-009 | Out of order webhooks | subscription.charged before activated | Handled gracefully |
| EDG-010 | Delayed webhook | Webhook arrives hours later | Still processed correctly |
| EDG-011 | Webhook for unknown order | Razorpay order_id not found | Logged, no crash |

#### 5.3 Subscription Edge Cases

| Test ID | Test Case | Scenario | Expected Behavior |
|---------|-----------|----------|-------------------|
| EDG-012 | Subscription expires mid-session | User using app when sub expires | Graceful redirect to reactivate |
| EDG-013 | Multiple tabs | User has app open in multiple tabs | Consistent state across tabs |
| EDG-014 | Reactivate with new card | Card changed since last payment | Can add new payment method |
| EDG-015 | Cancel during billing cycle | Cancel mid-month | Access until period end |

#### 5.4 Data Edge Cases

| Test ID | Test Case | Scenario | Expected Behavior |
|---------|-----------|----------|-------------------|
| EDG-016 | Long gift message | Message > 500 chars | Truncated or validation error |
| EDG-017 | Special characters in address | Unicode, emoji | Stored and displayed correctly |
| EDG-018 | International phone | +65, +1, +44 formats | Accepted and stored |
| EDG-019 | Long address | Address > 200 chars | Handled (truncate or error) |
| EDG-020 | Empty optional fields | addressLine2 empty | Saved as null, no errors |

#### 5.5 Concurrent Access

| Test ID | Test Case | Scenario | Expected Behavior |
|---------|-----------|----------|-------------------|
| EDG-021 | Two orders simultaneously | Same user, two browser windows | Both orders created correctly |
| EDG-022 | Cancel while processing | Cancel request during order creation | Handled gracefully |

---

### 6. Security Tests

| Test ID | Test Case | Attack Vector | Expected Behavior |
|---------|-----------|---------------|-------------------|
| SEC-001 | Access other user's order | Modify order ID in URL | 403 Forbidden |
| SEC-002 | SQL injection in shipping | ' OR 1=1 -- in address | Input sanitized, no injection |
| SEC-003 | XSS in gift message | <script>alert(1)</script> | Escaped in output |
| SEC-004 | Invalid JWT | Tampered JWT token | 401 Unauthorized |
| SEC-005 | Expired JWT | Token past expiry | 401 Unauthorized |
| SEC-006 | CSRF on order creation | Cross-origin request | Blocked by CORS |
| SEC-007 | Webhook signature bypass | Missing/invalid signature | 400 Bad Request |
| SEC-008 | Price manipulation | Modify amount in request | Server recalculates from quantity |
| SEC-009 | Quantity manipulation | Negative or zero quantity | Validation error |
| SEC-010 | Rate limiting | 100 orders in 1 minute | Rate limited (429) |

---

### 7. Performance Tests

| Test ID | Test Case | Scenario | Expected Behavior |
|---------|-----------|----------|-------------------|
| PRF-001 | Order list performance | User with 100 orders | Page loads < 2 seconds |
| PRF-002 | Concurrent order creation | 50 users create orders | All succeed, no conflicts |
| PRF-003 | Webhook processing | 100 webhooks/second | All processed without loss |
| PRF-004 | Database query optimization | Orders list query | Uses indexes, < 100ms |

---

### 8. Database Tests

| Test ID | Test Case | Scenario | Expected Behavior |
|---------|-----------|----------|-------------------|
| DB-001 | Foreign key constraint | Delete user with orders | Cascade delete orders |
| DB-002 | Unique order number | Insert duplicate | Constraint violation error |
| DB-003 | Index usage | Query by user_id | Index used (explain plan) |
| DB-004 | Null handling | Optional fields null | Stored and retrieved as null |
| DB-005 | Transaction rollback | Error during order creation | All changes rolled back |

---

### 9. Integration Tests with Razorpay (Sandbox)

| Test ID | Test Case | Scenario | Expected Behavior |
|---------|-----------|----------|-------------------|
| RZP-I-001 | Create order in sandbox | Test mode | Order created successfully |
| RZP-I-002 | Complete test payment | Use test card 4111... | Payment captured |
| RZP-I-003 | Failed test payment | Use decline card | Payment failed handled |
| RZP-I-004 | Subscription creation | After first payment | Subscription active in dashboard |
| RZP-I-005 | Webhook delivery | Trigger from Razorpay | Webhook received and processed |

---

### 10. Test Data Requirements

#### Test Users

| User Type | Description | Use For |
|-----------|-------------|---------|
| new_user | No orders, no subscription | First purchase flow |
| active_user | Has orders, active subscription | Dashboard access, order another |
| cancelled_user | Has orders, cancelled subscription | Reactivation flow |
| multi_order_user | Multiple orders | Order history pagination |

#### Test Cards (Razorpay Sandbox)

| Card Number | Behavior |
|-------------|----------|
| 4111 1111 1111 1111 | Success |
| 4000 0000 0000 0002 | Decline |
| 4000 0000 0000 9995 | Insufficient funds |

---

### 11. Test Coverage Requirements

| Area | Minimum Coverage |
|------|------------------|
| Backend Services | 90% |
| API Routes | 85% |
| Frontend Components | 80% |
| Hooks | 85% |
| E2E Critical Paths | 100% |

---

## Testing Checklist (Quick Reference)

### Order Flow
- [ ] Create order with valid shipping details
- [ ] Create order with gift details
- [ ] Create order with multiple quantities
- [ ] Razorpay payment success
- [ ] Razorpay payment failure
- [ ] Order status updates via webhook
- [ ] View order history
- [ ] Track order with tracking number

### Subscription Flow
- [ ] First order creates subscription
- [ ] Subsequent orders don't create new subscription
- [ ] Subscription status check on login
- [ ] Subscription cancellation
- [ ] Subscription reactivation
- [ ] Subscription renewal via webhook
- [ ] Handle past_due status

### Edge Cases
- [ ] User tries to access dashboard without order
- [ ] User tries to access dashboard with cancelled subscription
- [ ] Duplicate webhook events
- [ ] Payment timeout handling
- [ ] Invalid Razorpay signature rejection

---

## Implementation Order

### Phase 1: Database & Backend Foundation
1. Create database migrations for new tables
2. Implement order service and routes
3. Implement Razorpay integration service
4. Set up webhook handler

### Phase 2: Frontend Purchase Flow
1. Create PurchasePage with shipping form
2. Integrate Razorpay Checkout
3. Create OrderConfirmationPage
4. Update AuthGuard to check purchase status

### Phase 3: Order Management
1. Create OrdersPage
2. Create order tracking components
3. Add "Order Another Frame" functionality

### Phase 4: Subscription Management
1. Create SubscriptionPage
2. Create ReactivateSubscriptionPage
3. Implement cancel/reactivate functionality
4. Add billing history display

### Phase 5: Testing & Polish
1. Test complete purchase flow
2. Test webhook handling
3. Test edge cases
4. UI polish and error handling

---

## Appendix: Order Number Generation

Format: `ORD-YYYYMMDD-XXXX`

```typescript
function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${date}-${random}`;
}

// Example: ORD-20240115-A1B2
```
