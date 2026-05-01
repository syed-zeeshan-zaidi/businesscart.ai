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
	BrandName  string
	BrandEmail string
}

// brandFooterText renders the text-body sign-off. Falls back to "BusinessCart" when no brand.
func brandFooterText(name, email string) string {
	if name == "" {
		name = "BusinessCart"
	}
	if email == "" {
		return "— " + name
	}
	return "— " + name + " · " + email
}

type OrderItemView struct {
	Name     string
	Quantity int
	Price    float64
	Image    string
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
	fmt.Fprintf(&b, "\nTotal: $%.2f\n\n%s\n", d.GrandTotal, brandFooterText(d.BrandName, d.BrandEmail))
	return b.String()
}

const orderConfirmationHTMLTmpl = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Order confirmation</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="color:#0d9488;margin-bottom:8px">Thank you for your order!</h1>
  <p style="font-size:14px;color:#64748b">Order ID: <strong>{{.OrderID}}</strong></p>
  <table style="width:100%;border-collapse:collapse;margin:24px 0">
    <tbody>
      {{range .Items}}
      <tr>
        <td style="padding:8px 8px 8px 0;border-bottom:1px solid #f1f5f9;width:64px;vertical-align:top">
          {{if .Image}}<img src="{{.Image}}" alt="{{.Name}}" width="56" height="56" style="width:56px;height:56px;border-radius:6px;border:1px solid #e2e8f0;object-fit:cover;display:block" />{{else}}<div style="width:56px;height:56px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px"></div>{{end}}
        </td>
        <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top">
          <div style="font-size:14px;color:#1e293b;font-weight:600">{{.Name}}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">Qty {{.Quantity}}</div>
        </td>
        <td style="padding:8px 0 8px 8px;border-bottom:1px solid #f1f5f9;text-align:right;vertical-align:top;font-size:14px;font-weight:600">${{printf "%.2f" .Price}}</td>
      </tr>
      {{end}}
    </tbody>
  </table>
  <p style="font-size:18px;font-weight:bold;text-align:right;margin-top:16px">
    Total: <span style="color:#0d9488">${{printf "%.2f" .GrandTotal}}</span>
  </p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
  <p style="color:#64748b;font-size:12px">— {{.BrandName}}{{if .BrandEmail}} · <a href="mailto:{{.BrandEmail}}" style="color:#64748b;text-decoration:none">{{.BrandEmail}}</a>{{end}}</p>
</body>
</html>`

// ─────────────────────── New Order Notification (to company owner) ───────────────────────

type NewOrderToCompanyData struct {
	OrderID       string
	CustomerEmail string
	GrandTotal    float64
	Items         []OrderItemView
}

// NewOrderToCompanyMessage is sent to the company owner when a customer places an order
// on their storefront. Always sent via the platform sender (BusinessCart SES).
func NewOrderToCompanyMessage(to string, data NewOrderToCompanyData) Message {
	return Message{
		To:       to,
		Subject:  fmt.Sprintf("New order on your store #%s ($%.2f)", lastSix(data.OrderID), data.GrandTotal),
		HTMLBody: renderHTML(newOrderToCompanyHTMLTmpl, data),
		TextBody: newOrderToCompanyText(data),
	}
}

func newOrderToCompanyText(d NewOrderToCompanyData) string {
	var b bytes.Buffer
	fmt.Fprintf(&b, "New order on your storefront.\n\n")
	fmt.Fprintf(&b, "Order #%s\n", lastSix(d.OrderID))
	fmt.Fprintf(&b, "Customer: %s\n\n", d.CustomerEmail)
	for _, it := range d.Items {
		fmt.Fprintf(&b, "  - %s x%d  $%.2f\n", it.Name, it.Quantity, it.Price)
	}
	fmt.Fprintf(&b, "\nTotal: $%.2f\n\nView in dashboard: https://businesscart.ai/orders\n\n— BusinessCart\n", d.GrandTotal)
	return b.String()
}

const newOrderToCompanyHTMLTmpl = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>New order on your store</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="color:#0d9488;margin-bottom:8px">New order on your store</h1>
  <p style="font-size:14px;color:#64748b">Order ID: <strong>{{.OrderID}}</strong></p>
  <p style="font-size:14px;color:#64748b">Customer: <strong>{{.CustomerEmail}}</strong></p>
  <table style="width:100%;border-collapse:collapse;margin:24px 0">
    <tbody>
      {{range .Items}}
      <tr>
        <td style="padding:8px 8px 8px 0;border-bottom:1px solid #f1f5f9;width:64px;vertical-align:top">
          {{if .Image}}<img src="{{.Image}}" alt="{{.Name}}" width="56" height="56" style="width:56px;height:56px;border-radius:6px;border:1px solid #e2e8f0;object-fit:cover;display:block" />{{else}}<div style="width:56px;height:56px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px"></div>{{end}}
        </td>
        <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top">
          <div style="font-size:14px;color:#1e293b;font-weight:600">{{.Name}}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">Qty {{.Quantity}}</div>
        </td>
        <td style="padding:8px 0 8px 8px;border-bottom:1px solid #f1f5f9;text-align:right;vertical-align:top;font-size:14px;font-weight:600">${{printf "%.2f" .Price}}</td>
      </tr>
      {{end}}
    </tbody>
  </table>
  <p style="font-size:18px;font-weight:bold;text-align:right;margin-top:16px">
    Total: <span style="color:#0d9488">${{printf "%.2f" .GrandTotal}}</span>
  </p>
  <p style="margin:24px 0">
    <a href="https://businesscart.ai/orders" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px">View in Dashboard</a>
  </p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
  <p style="color:#64748b;font-size:12px">— BusinessCart (notification from your platform)</p>
</body>
</html>`

// ─────────────────────── Quote Requested ───────────────────────

type QuoteRequestedData struct {
	QuoteID    string
	BrandName  string
	BrandEmail string
}

// QuoteRequestedMessage builds the email sent to the customer when they create a negotiable quote.
func QuoteRequestedMessage(to string, data QuoteRequestedData) Message {
	return Message{
		To:       to,
		Subject:  fmt.Sprintf("Quote request received #%s", lastSix(data.QuoteID)),
		HTMLBody: renderHTML(quoteRequestedHTMLTmpl, data),
		TextBody: fmt.Sprintf("Your quote request has been received.\n\nQuote ID: %s\n\nThe seller will review and respond shortly. You'll receive another email when there's an update.\n\n%s\n", data.QuoteID, brandFooterText(data.BrandName, data.BrandEmail)),
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
  <p style="color:#64748b;font-size:12px">— {{.BrandName}}{{if .BrandEmail}} · <a href="mailto:{{.BrandEmail}}" style="color:#64748b;text-decoration:none">{{.BrandEmail}}</a>{{end}}</p>
</body>
</html>`

// ─────────────────────── Quote Status Changed ───────────────────────

type QuoteStatusData struct {
	QuoteID    string
	Status     string // "approved", "rejected", "proposed", etc.
	BrandName  string
	BrandEmail string
}

// QuoteStatusMessage builds the email sent to the customer when a quote status changes.
func QuoteStatusMessage(to string, data QuoteStatusData) Message {
	return Message{
		To:       to,
		Subject:  fmt.Sprintf("Quote update #%s — %s", lastSix(data.QuoteID), data.Status),
		HTMLBody: renderHTML(quoteStatusHTMLTmpl, data),
		TextBody: fmt.Sprintf("Your quote has been updated.\n\nQuote ID: %s\nNew status: %s\n\nLog in to BusinessCart to view details and continue.\n\n%s\n", data.QuoteID, data.Status, brandFooterText(data.BrandName, data.BrandEmail)),
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
  <p style="color:#64748b;font-size:12px">— {{.BrandName}}{{if .BrandEmail}} · <a href="mailto:{{.BrandEmail}}" style="color:#64748b;text-decoration:none">{{.BrandEmail}}</a>{{end}}</p>
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

// ─────────────────────── Order Shipped (to customer) ───────────────────────

type OrderShippedData struct {
	OrderID         string
	GrandTotal      float64
	Items           []OrderItemView
	TrackingCarrier string
	TrackingNumber  string
	TrackingURL     string
	BrandName       string
	BrandEmail      string
}

func OrderShippedMessage(to string, data OrderShippedData) Message {
	return Message{
		To:       to,
		Subject:  fmt.Sprintf("Your order #%s has shipped", lastSix(data.OrderID)),
		HTMLBody: renderHTML(orderShippedHTMLTmpl, data),
		TextBody: orderShippedText(data),
	}
}

func orderShippedText(d OrderShippedData) string {
	var b bytes.Buffer
	fmt.Fprintf(&b, "Good news — your order #%s has shipped.\n\n", lastSix(d.OrderID))
	if len(d.Items) > 0 {
		fmt.Fprintf(&b, "What's on its way:\n")
		for _, it := range d.Items {
			fmt.Fprintf(&b, "  - %s x%d  $%.2f\n", it.Name, it.Quantity, it.Price)
		}
		fmt.Fprintf(&b, "\nOrder total: $%.2f\n\n", d.GrandTotal)
	}
	if d.TrackingCarrier != "" {
		fmt.Fprintf(&b, "Shipped via: %s\n", d.TrackingCarrier)
	}
	if d.TrackingNumber != "" {
		fmt.Fprintf(&b, "Tracking number: %s\n", d.TrackingNumber)
	}
	if d.TrackingURL != "" {
		fmt.Fprintf(&b, "Track at: %s\n", d.TrackingURL)
	}
	fmt.Fprintf(&b, "\nThank you for your order. Reply to this email if you have any questions.\n\n%s\n", brandFooterText(d.BrandName, d.BrandEmail))
	return b.String()
}

const orderShippedHTMLTmpl = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Your order has shipped</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="color:#0d9488;margin-bottom:8px">Your order is on its way</h1>
  <p style="font-size:14px;color:#64748b;margin-top:0">Order #{{.OrderID}}</p>

  {{if .Items}}
  <h2 style="font-size:15px;color:#1e293b;margin-top:24px;margin-bottom:8px">What's on its way</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tbody>
      {{range .Items}}
      <tr>
        <td style="padding:8px 8px 8px 0;border-bottom:1px solid #f1f5f9;width:64px;vertical-align:top">
          {{if .Image}}<img src="{{.Image}}" alt="{{.Name}}" width="56" height="56" style="width:56px;height:56px;border-radius:6px;border:1px solid #e2e8f0;object-fit:cover;display:block" />{{else}}<div style="width:56px;height:56px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px"></div>{{end}}
        </td>
        <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top">
          <div style="font-size:14px;color:#1e293b;font-weight:600">{{.Name}}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">Qty {{.Quantity}}</div>
        </td>
        <td style="padding:8px 0 8px 8px;border-bottom:1px solid #f1f5f9;text-align:right;vertical-align:top;font-size:14px;font-weight:600">${{printf "%.2f" .Price}}</td>
      </tr>
      {{end}}
    </tbody>
  </table>
  <p style="font-size:15px;text-align:right;font-weight:bold;margin:0 0 24px">Order total: ${{printf "%.2f" .GrandTotal}}</p>
  {{end}}

  {{if or .TrackingCarrier .TrackingNumber}}
  <h2 style="font-size:15px;color:#1e293b;margin-bottom:8px">Tracking</h2>
  <table style="width:100%;background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:16px">
    <tr>
      {{if .TrackingCarrier}}<td style="padding:4px 8px;font-size:14px"><strong>Carrier:</strong> {{.TrackingCarrier}}</td>{{end}}
      {{if .TrackingNumber}}<td style="padding:4px 8px;font-size:14px"><strong>Number:</strong> {{.TrackingNumber}}</td>{{end}}
    </tr>
  </table>
  {{if .TrackingURL}}<p style="margin:16px 0"><a href="{{.TrackingURL}}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Track package</a></p>{{end}}
  {{end}}

  <p style="color:#64748b;font-size:13px;margin-top:24px">Thank you for your order. Reply to this email if you have any questions.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
  <p style="color:#64748b;font-size:12px">— {{.BrandName}}{{if .BrandEmail}} · <a href="mailto:{{.BrandEmail}}" style="color:#64748b;text-decoration:none">{{.BrandEmail}}</a>{{end}}</p>
</body>
</html>`
