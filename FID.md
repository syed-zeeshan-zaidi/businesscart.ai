# FID: B2B Quote Functionality Enhancement (PATCH Approach)

## 1. High-Level Goals

This document outlines the implementation plan to evolve the BusinessCart quote system into a comprehensive B2B negotiation platform. The goal is to empower our sellers with advanced tools for negotiation and to provide a seamless and interactive experience for our customers.

This plan adopts a `PATCH`-based approach for all quote modifications to ensure a clean, RESTful, and extensible API.

---

## 2. Feature Breakdown & Task List

### Feature 1: Unified Quote Modification Endpoint

**Description:** Consolidate all quote modification actions (seller counter-offers, discounts, comments) into a single, powerful `PATCH` endpoint. This provides a single entry point for all partial updates to a quote.

**Tasks:**

1.  **Backend (Go - `checkout-service`):**
    *   **Modify `handler/http.go`:**
        *   Create a new master handler `handlePatchQuoteRequest` for the `PATCH /checkout/quotes/{quoteId}` endpoint.
        *   This handler will be responsible for reading the `operation` field from the request body and routing the request to the appropriate service method.
    *   **Modify `quote/service.go`:**
        *   Create a new method `UpdateQuoteBySeller(quoteId, updates)` for the `sellerUpdate` operation.
        *   Create a new method `ApplyQuoteDiscount(quoteId, discountPercentage)` for the `applyDiscount` operation.
        *   Create a new method `AddCommentToQuote(quoteId, comment)` for the `addComment` operation.
        *   Ensure all methods add a descriptive entry to the quote's `history`.
    *   **Modify `quote/quote.go` (Data Models):**
        *   Add `discountPercentage`, `discountAmount`, and `notes` fields to the `Quote` struct.
        *   Add a `comments` array field to the `Quote` struct, containing `Comment` objects.

2.  **Frontend (TypeScript - `web-portal`):**
    *   **Modify `api.ts`:**
        *   Create a single, versatile function `patchQuote(quoteId, operation, payload)` that constructs the correct request body and calls the `PATCH` endpoint.
    *   **Create `components/SellerQuoteEditForm.tsx`:**
        *   This form will allow a seller to edit item prices, quantities, and apply a quote-level discount. On submit, it will call `patchQuote` with the `sellerUpdate` operation.
    *   **Create `components/QuoteComments.tsx`:**
        *   This component will display comments and have a form to add a new one. On submit, it will call `patchQuote` with the `addComment` operation.
    *   **Update `pages/Quote.tsx`:**
        *   Integrate the new `SellerQuoteEditForm` and `QuoteComments` components.

---

### Feature 2: Sales Representative Empowerment

**Description:** Allow sales representatives to create quotes for customers and provide them with an enhanced dashboard for managing their quotes.

**Tasks:**

1.  **Backend (Go - `checkout-service`):**
    *   Modify the `CreateQuote` service method and `handleCreateQuoteRequest` handler to allow a user with a "company" role to create a quote on behalf of a specific `customerId`.

2.  **Frontend (TypeScript - `web-portal`):**
    *   **Create `pages/admin/CreateQuote.tsx`:**
        *   A new page for company users to create a quote for a customer.
    *   **Enhance `components/QuoteForm.tsx`:**
        *   Add advanced filtering (by status, customer, date range) and sorting options.

---

### Feature 3: Usability and Administrative Features

**Description:** Add important usability features like shipping cost negotiation and the ability to export quotes to PDF.

**Tasks:**

1.  **Shipping Cost Negotiation:**
    *   **Backend:** The `sellerUpdate` operation (handled by the `UpdateQuoteBySeller` service method) will be able to accept and apply a `newShippingCost`.
    *   **Frontend:** The `SellerQuoteEditForm.tsx` will include an input for the seller to set a custom shipping cost.

2.  **PDF Export:**
    *   **Backend (New Lambda Function):**
        *   Create a new, dedicated Lambda function for PDF generation to keep the `checkout-service` lean.
        *   Define this new function and its API Gateway route (`GET /checkout/quotes/{quoteId}/pdf`) in the AWS CDK stack.
        *   The Lambda will get quote data by calling the `checkout-service`'s public API, ensuring it has no direct database access.
    *   **Frontend:**
        *   Add a "Download PDF" button to the `pages/Quote.tsx` page.

---

## 3. Data Model Updates

**`quote/quote.go` (Backend - Go):**
```go
type Quote struct {
    // ... existing fields
    DiscountPercentage float64       `bson:"discountPercentage,omitempty" json:"discountPercentage,omitempty"`
    DiscountAmount     float64       `bson:"discountAmount,omitempty" json:"discountAmount,omitempty"`
    Notes              string        `bson:"notes,omitempty" json:"notes,omitempty"`
    Comments           []Comment     `bson:"comments,omitempty" json:"comments,omitempty"`
}

type Comment struct {
    Author    string    `bson:"author" json:"author"`
    Text      string    `bson:"text" json:"text"`
    Timestamp time.Time `bson:"timestamp" json:"timestamp"`
}
```

**`types.ts` (Frontend - TypeScript):**
```typescript
export interface Quote {
  // ... existing fields
  discountPercentage?: number;
  discountAmount?: number;
  notes?: string;
  comments: Comment[];
}

export interface Comment {
  author: string;
  text: string;
  timestamp: string;
}
```

---

## 4. API Endpoint Definition

### `PATCH /checkout/quotes/{quoteId}`

This endpoint handles all partial updates to a quote. The action is determined by the `operation` field in the request body.

**Operation: `applyDiscount`**
*   **Description:** Applies a percentage discount to the entire quote.
*   **Request Body:**
    ```json
    { "operation": "applyDiscount", "value": 10 }
    ```

**Operation: `sellerUpdate`**
*   **Description:** Allows a seller to make a counter-offer by updating items and shipping cost.
*   **Request Body:**
    ```json
    { 
      "operation": "sellerUpdate",
      "updates": {
        "items": [ { "itemId": "...", "quantity": 2, "price": 89.99 } ],
        "newShippingCost": 15.00,
        "notes": "Offered a discount for a bulk purchase."
      }
    }
    ```

**Operation: `addComment`**
*   **Description:** Adds a comment to the negotiation history.
*   **Request Body:**
    ```json
    { "operation": "addComment", "text": "Can you provide more details on the warranty?" }
    ```

### `GET /checkout/quotes/{quoteId}/pdf`

*   **Description:** Returns a PDF version of the quote.
*   **Request Body:** None