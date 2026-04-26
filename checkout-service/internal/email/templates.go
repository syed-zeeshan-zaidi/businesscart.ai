package email

import (
	"bytes"
	"fmt"
	"html/template"
	"log"
)

// renderHTML safely renders an HTML template with auto-escaping for variables.
func renderHTML(tmplStr string, data interface{}) string {
	t, err := template.New("").Parse(tmplStr)
	if err != nil {
		log.Printf("email: html template parse failed: %v", err)
		return ""
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		log.Printf("email: html template execute failed: %v", err)
		return ""
	}
	return buf.String()
}

// ─────────────────────── Order Confirmation ───────────────────────

type OrderConfirmationData struct {
	OrderID    string
	GrandTotal float64
	Items      []OrderItemView
}

type OrderItemView struct {
	Name     string
	Quantity int
	Price    float64
}

// OrderConfirmationMessage builds the order confirmation email sent to the customer.
func OrderConfirmationMessage(to string, data OrderConfirmationData) Message {
	return Message{
		To:       to,
		Subject:  fmt.Sprintf("Order confirmation #%s", lastSix(data.OrderID)),
		HTMLBody: renderHTML(orderConfirmationHTMLTmpl, data),
		TextBody: orderConfirmationText(data),
	}
}

func orderConfirmationText(d OrderConfirmationData) string {
	var b bytes.Buffer
	fmt.Fprintf(&b, "Thank you for your order!\n\n")
	fmt.Fprintf(&b, "Order #%s\n\n", lastSix(d.OrderID))
	for _, it := range d.Items {
		fmt.Fprintf(&b, "  - %s x%d  $%.2f\n", it.Name, it.Quantity, it.Price)
	}
	fmt.Fprintf(&b, "\nTotal: $%.2f\n\n— BusinessCart\n", d.GrandTotal)
	return b.String()
}

const orderConfirmationHTMLTmpl = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Order confirmation</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="color:#0d9488;margin-bottom:8px">Thank you for your order!</h1>
  <p style="font-size:14px;color:#64748b">Order ID: <strong>{{.OrderID}}</strong></p>
  <table style="width:100%;border-collapse:collapse;margin:24px 0">
    <thead>
      <tr style="background:#f1f5f9;text-align:left">
        <th style="padding:8px;border-bottom:1px solid #e2e8f0">Item</th>
        <th style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">Qty</th>
        <th style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">Price</th>
      </tr>
    </thead>
    <tbody>
      {{range .Items}}
      <tr>
        <td style="padding:8px;border-bottom:1px solid #f1f5f9">{{.Name}}</td>
        <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right">{{.Quantity}}</td>
        <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right">${{printf "%.2f" .Price}}</td>
      </tr>
      {{end}}
    </tbody>
  </table>
  <p style="font-size:18px;font-weight:bold;text-align:right;margin-top:16px">
    Total: <span style="color:#0d9488">${{printf "%.2f" .GrandTotal}}</span>
  </p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
  <p style="color:#64748b;font-size:12px">— BusinessCart</p>
</body>
</html>`

// ─────────────────────── Quote Requested ───────────────────────

type QuoteRequestedData struct {
	QuoteID string
}

// QuoteRequestedMessage builds the email sent to the customer when they create a negotiable quote.
func QuoteRequestedMessage(to string, data QuoteRequestedData) Message {
	return Message{
		To:      to,
		Subject: fmt.Sprintf("Quote request received #%s", lastSix(data.QuoteID)),
		HTMLBody: renderHTML(quoteRequestedHTMLTmpl, data),
		TextBody: fmt.Sprintf("Your quote request has been received.\n\nQuote ID: %s\n\nThe seller will review and respond shortly. You'll receive another email when there's an update.\n\n— BusinessCart\n", data.QuoteID),
	}
}

const quoteRequestedHTMLTmpl = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Quote request received</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="color:#0d9488;margin-bottom:8px">Quote request received</h1>
  <p style="font-size:14px;color:#64748b">Quote ID: <strong>{{.QuoteID}}</strong></p>
  <p style="font-size:16px;line-height:1.5">The seller will review your request and respond shortly.</p>
  <p style="font-size:16px;line-height:1.5">You'll receive another email when there's an update on your quote.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
  <p style="color:#64748b;font-size:12px">— BusinessCart</p>
</body>
</html>`

// ─────────────────────── Quote Status Changed ───────────────────────

type QuoteStatusData struct {
	QuoteID string
	Status  string // "approved", "rejected", "proposed", etc.
}

// QuoteStatusMessage builds the email sent to the customer when a quote status changes.
func QuoteStatusMessage(to string, data QuoteStatusData) Message {
	return Message{
		To:       to,
		Subject:  fmt.Sprintf("Quote update #%s — %s", lastSix(data.QuoteID), data.Status),
		HTMLBody: renderHTML(quoteStatusHTMLTmpl, data),
		TextBody: fmt.Sprintf("Your quote has been updated.\n\nQuote ID: %s\nNew status: %s\n\nLog in to BusinessCart to view details and continue.\n\n— BusinessCart\n", data.QuoteID, data.Status),
	}
}

const quoteStatusHTMLTmpl = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Quote update</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="color:#0d9488;margin-bottom:8px">Quote update</h1>
  <p style="font-size:14px;color:#64748b">Quote ID: <strong>{{.QuoteID}}</strong></p>
  <p style="font-size:16px;line-height:1.5">New status: <strong style="color:#0d9488">{{.Status}}</strong></p>
  <p style="font-size:16px;line-height:1.5">Log in to <a href="https://businesscart.ai" style="color:#0d9488;text-decoration:none">BusinessCart</a> to view details.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
  <p style="color:#64748b;font-size:12px">— BusinessCart</p>
</body>
</html>`

// lastSix returns the last 6 characters of an ID for compact display.
func lastSix(s string) string {
	if len(s) <= 6 {
		return s
	}
	return s[len(s)-6:]
}

// ─────────────────────── Monthly Statement ───────────────────────

// MonthlyStatementData is the flat view of a billing statement sent to a
// company. The handler flattens an order.Statement into this struct so the
// email package stays decoupled from the order domain.
type MonthlyStatementData struct {
	CompanyName     string
	PeriodLabel     string  // e.g., "April 1 – April 30, 2026"
	Tier            string  // "Starter" | "Growth" | "Enterprise"
	OrderCount      int
	TotalGrandTotal float64 // their gross revenue in the period
	MonthlyFee      float64
	PerOrderRateStr string  // pre-formatted, e.g., "6%, capped at $5/order"
	TransactionFees float64
	TotalDue        float64
	PaymentInstructions string // plain text — varies per customer arrangement
}

// MonthlyStatementMessage builds the monthly billing statement email sent to a
// company by the platform admin. Sender is BusinessCart; recipient is the
// company's billing contact. Manual trigger (no cron) at this stage.
func MonthlyStatementMessage(to string, data MonthlyStatementData) Message {
	return Message{
		To:       to,
		Subject:  fmt.Sprintf("BusinessCart statement — %s — total $%.2f", data.PeriodLabel, data.TotalDue),
		HTMLBody: renderHTML(monthlyStatementHTMLTmpl, data),
		TextBody: monthlyStatementText(data),
	}
}

func monthlyStatementText(d MonthlyStatementData) string {
	var b bytes.Buffer
	fmt.Fprintf(&b, "BusinessCart Monthly Statement\n\n")
	fmt.Fprintf(&b, "Account: %s\n", d.CompanyName)
	fmt.Fprintf(&b, "Period:  %s\n\n", d.PeriodLabel)
	fmt.Fprintf(&b, "Pricing tier:        %s (%s)\n", d.Tier, d.PerOrderRateStr)
	fmt.Fprintf(&b, "Orders this period:  %d\n", d.OrderCount)
	fmt.Fprintf(&b, "Your gross revenue:  $%.2f\n\n", d.TotalGrandTotal)
	fmt.Fprintf(&b, "Charges\n")
	fmt.Fprintf(&b, "  Monthly fee:       $%.2f\n", d.MonthlyFee)
	fmt.Fprintf(&b, "  Transaction fees:  $%.2f\n", d.TransactionFees)
	fmt.Fprintf(&b, "  ─────────────────────────────\n")
	fmt.Fprintf(&b, "  Total due:         $%.2f\n\n", d.TotalDue)
	if d.PaymentInstructions != "" {
		fmt.Fprintf(&b, "Payment\n%s\n\n", d.PaymentInstructions)
	}
	fmt.Fprintf(&b, "Questions? Reply to this email.\n\n— BusinessCart\n")
	return b.String()
}

const monthlyStatementHTMLTmpl = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>BusinessCart statement</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="color:#0d9488;margin-bottom:8px">Monthly Statement</h1>
  <p style="font-size:14px;color:#64748b;margin:0">Account: <strong>{{.CompanyName}}</strong></p>
  <p style="font-size:14px;color:#64748b;margin:4px 0 24px">Period: <strong>{{.PeriodLabel}}</strong></p>

  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tbody>
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;color:#64748b">Pricing tier</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:right"><strong>{{.Tier}}</strong> &middot; <span style="color:#64748b">{{.PerOrderRateStr}}</span></td>
      </tr>
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;color:#64748b">Orders this period</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:right"><strong>{{.OrderCount}}</strong></td>
      </tr>
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;color:#64748b">Your gross revenue</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:right">${{printf "%.2f" .TotalGrandTotal}}</td>
      </tr>
    </tbody>
  </table>

  <h2 style="color:#1e293b;font-size:16px;margin-top:32px;margin-bottom:8px">Charges</h2>
  <table style="width:100%;border-collapse:collapse">
    <tbody>
      <tr>
        <td style="padding:8px;color:#64748b">Monthly fee</td>
        <td style="padding:8px;text-align:right">${{printf "%.2f" .MonthlyFee}}</td>
      </tr>
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Transaction fees</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${{printf "%.2f" .TransactionFees}}</td>
      </tr>
      <tr>
        <td style="padding:12px 8px;font-weight:bold;font-size:18px">Total due</td>
        <td style="padding:12px 8px;text-align:right;font-weight:bold;font-size:18px;color:#0d9488">${{printf "%.2f" .TotalDue}}</td>
      </tr>
    </tbody>
  </table>

  {{if .PaymentInstructions}}
  <h2 style="color:#1e293b;font-size:16px;margin-top:32px;margin-bottom:8px">Payment</h2>
  <p style="font-size:14px;line-height:1.5;color:#1e293b;white-space:pre-line">{{.PaymentInstructions}}</p>
  {{end}}

  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
  <p style="font-size:13px;color:#64748b">Questions? Just reply to this email.</p>
  <p style="color:#64748b;font-size:12px;margin-top:24px">— BusinessCart</p>
</body>
</html>`
