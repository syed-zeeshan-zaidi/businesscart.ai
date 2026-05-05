package order

import (
	"strings"
)

// FormatGenericCSV returns a CSV of orders for the requested period in a
// human-readable shape suitable for accounting reconciliation, monthly
// reports, tax filings, and ad-hoc analysis. Unlike the platform-specific
// formats below, this includes every order in the window — including
// cancelled — so the export reflects the full ledger.
func FormatGenericCSV(orders []*Order) string {
	var b strings.Builder
	b.WriteString("Order ID,Created (UTC),Status,Customer Email,Payment Method,Delivery Method,Subtotal,Shipping,Tax,Discount,Promo Code,Grand Total,Items,Tracking Number,Tracking Carrier,Visitor ID,gclid,msclkid\n")
	for _, o := range orders {
		b.WriteString(csvField(o.ID.Hex()))
		b.WriteString(",")
		b.WriteString(o.CreatedAt.UTC().Format("2006-01-02 15:04:05"))
		b.WriteString(",")
		b.WriteString(csvField(o.Status))
		b.WriteString(",")
		b.WriteString(csvField(o.CustomerEmail))
		b.WriteString(",")
		b.WriteString(csvField(o.PaymentMethod))
		b.WriteString(",")
		b.WriteString(csvField(o.DeliveryMethod))
		b.WriteString(",")
		b.WriteString(formatAmount(o.Subtotal))
		b.WriteString(",")
		b.WriteString(formatAmount(o.ShippingCost))
		b.WriteString(",")
		b.WriteString(formatAmount(o.TaxAmount))
		b.WriteString(",")
		b.WriteString(formatAmount(o.PromoDiscount))
		b.WriteString(",")
		b.WriteString(csvField(o.PromoCode))
		b.WriteString(",")
		b.WriteString(formatAmount(o.GrandTotal))
		b.WriteString(",")
		b.WriteString(itoa(int64(len(o.Items))))
		b.WriteString(",")
		b.WriteString(csvField(o.TrackingNumber))
		b.WriteString(",")
		b.WriteString(csvField(o.TrackingCarrier))
		b.WriteString(",")
		b.WriteString(csvField(o.VisitorID))
		b.WriteString(",")
		b.WriteString(csvField(o.ClickIDs["gclid"]))
		b.WriteString(",")
		b.WriteString(csvField(o.ClickIDs["msclkid"]))
		b.WriteString("\n")
	}
	return b.String()
}

// FormatGoogleCSV returns a CSV string in Google Ads' offline click-conversions
// upload format (legacy file upload). uSetGo downloads this and uploads via
// Google Ads UI: Tools → Conversions → Uploads. Bidding learns from the gclid
// → conversion mapping within hours.
//
// Spec: https://support.google.com/google-ads/answer/7014069
//   - Required columns: Google Click ID, Conversion Name, Conversion Time
//   - Optional columns: Order ID (prevents duplicate counting on re-upload),
//     Conversion Value, Conversion Currency
//   - Conversion Name must match an action configured in Google Ads (default
//     "Purchase"; uSetGo overrides via ?conversionName=...)
//   - Time format: yyyy-MM-dd HH:mm:ss±hhmm — using +0000 (UTC) to be unambiguous
//   - File-upload accepts ONLY gclid in the Google Click ID column.
//     gbraid/wbraid require the Google Ads API (Enhanced Conversions),
//     not the CSV file upload.
func FormatGoogleCSV(orders []*Order, conversionName string) string {
	if conversionName == "" {
		conversionName = "Purchase"
	}
	var b strings.Builder
	b.WriteString("Parameters:TimeZone=+0000\n")
	b.WriteString("Google Click ID,Conversion Name,Conversion Time,Order ID,Conversion Value,Conversion Currency\n")
	for _, o := range orders {
		gclid := o.ClickIDs["gclid"]
		if gclid == "" {
			continue
		}
		b.WriteString(csvField(gclid))
		b.WriteString(",")
		b.WriteString(csvField(conversionName))
		b.WriteString(",")
		b.WriteString(o.CreatedAt.UTC().Format("2006-01-02 15:04:05+0000"))
		b.WriteString(",")
		b.WriteString(csvField(o.ID.Hex()))
		b.WriteString(",")
		b.WriteString(formatAmount(o.GrandTotal))
		b.WriteString(",USD\n")
	}
	return b.String()
}

// FormatBingCSV returns a CSV string in Microsoft Advertising's Bulk Offline
// Conversion file format. uSetGo uploads via Microsoft Advertising UI:
// Tools → Bulk Operations → Upload bulk file.
//
// Spec: https://learn.microsoft.com/en-us/advertising/bulk-service/offline-conversion
//   - First column is Type, with literal value "Offline Conversion" per row
//   - Required preamble: a "Format Version" row with value 6.0 in the Name column
//   - Required fields: Conversion Currency Code, Conversion Name, Conversion
//     Time, Conversion Value, Microsoft Click Id
//   - Conversion Time must be in UTC; using ISO 8601 (xsd:dateTime) for safety
//   - Conversion Name must match an OfflineConversionGoal configured in
//     Microsoft Advertising (default "Purchase")
func FormatBingCSV(orders []*Order, conversionName string) string {
	if conversionName == "" {
		conversionName = "Purchase"
	}
	var b strings.Builder
	// Header row (column names)
	b.WriteString("Type,Status,Id,Parent Id,Client Id,Name,Conversion Currency Code,Conversion Name,Conversion Time,Conversion Value,Microsoft Click Id\n")
	// Format Version preamble row — required by Bulk schema
	b.WriteString("Format Version,,,,,6.0,,,,,\n")
	for _, o := range orders {
		msclkid := o.ClickIDs["msclkid"]
		if msclkid == "" {
			continue
		}
		// Type, Status, Id, Parent Id, Client Id (we use Order ID), Name (blank for offline conversions),
		// Conversion Currency Code, Conversion Name, Conversion Time, Conversion Value, Microsoft Click Id
		b.WriteString("Offline Conversion,,,,")
		b.WriteString(csvField(o.ID.Hex()))
		b.WriteString(",,USD,")
		b.WriteString(csvField(conversionName))
		b.WriteString(",")
		b.WriteString(o.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"))
		b.WriteString(",")
		b.WriteString(formatAmount(o.GrandTotal))
		b.WriteString(",")
		b.WriteString(csvField(msclkid))
		b.WriteString("\n")
	}
	return b.String()
}

// csvField escapes a field per RFC 4180 AND mitigates CSV injection:
//   - RFC 4180: wrap in quotes if it contains comma/quote/newline; double internal quotes.
//   - Injection: prefix a leading single-quote when the field starts with =, +, -, @,
//     tab, or carriage return. Excel and Google Sheets execute formulas starting
//     with these characters; the leading quote is OWASP-recommended and renders
//     as a visible apostrophe (mild) rather than as an active formula. Critical
//     because Generic CSV exposes user-supplied fields (CustomerEmail, etc.).
func csvField(s string) string {
	if len(s) > 0 {
		c := s[0]
		if c == '=' || c == '+' || c == '-' || c == '@' || c == '\t' || c == '\r' {
			s = "'" + s
		}
	}
	if !strings.ContainsAny(s, ",\"\n\r") {
		return s
	}
	return "\"" + strings.ReplaceAll(s, "\"", "\"\"") + "\""
}

// formatAmount renders a money amount with two decimal places.
// Rounds half-away-from-zero (standard accounting), with the sign decided by
// the rounded result, not the input. This matters: a tiny negative like -0.001
// rounds to 0 cents, which must render as "0.00", not "-0.00".
func formatAmount(v float64) string {
	var cents int64
	if v < 0 {
		cents = int64(v*100 - 0.5)
	} else {
		cents = int64(v*100 + 0.5)
	}
	negative := cents < 0
	if negative {
		cents = -cents
	}
	whole := cents / 100
	frac := cents % 100
	var b strings.Builder
	if negative {
		b.WriteString("-")
	}
	b.WriteString(itoa(whole))
	b.WriteString(".")
	if frac < 10 {
		b.WriteString("0")
	}
	b.WriteString(itoa(frac))
	return b.String()
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
