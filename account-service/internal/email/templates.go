package email

import (
	"bytes"
	"fmt"
	"html/template"
	"log"
)

// renderHTML safely renders an HTML template with auto-escaping for variables.
// On any error, returns an empty string and logs.
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

// welcomeText omits the businesscart.ai login link when the email is branded
// (storefront customers don't have a BC account; they log into the storefront they
// registered on). Keeps the link only for the default unbranded path (admin/company
// users who really do log into businesscart.ai).
func welcomeText(name, footerName, brandName, brandEmail string) string {
	loginLine := ""
	if footerName == "BusinessCart" {
		loginLine = "You can log in at https://businesscart.ai\n\n"
	}
	return fmt.Sprintf("Hi %s,\n\nYour account at %s has been created successfully.\n\n%s%s\n", name, footerName, loginLine, brandFooterText(brandName, brandEmail))
}

// ───────────────────── Welcome ─────────────────────

// WelcomeMessage builds the welcome email sent on registration.
// brandName/brandEmail come from the per-company SMTP config; empty falls back to "BusinessCart".
func WelcomeMessage(name, to, brandName, brandEmail string) Message {
	if name == "" {
		name = "there"
	}
	footerName := brandName
	if footerName == "" {
		footerName = "BusinessCart"
	}
	return Message{
		To:      to,
		Subject: fmt.Sprintf("Welcome to %s", footerName),
		HTMLBody: renderHTML(welcomeHTMLTmpl, struct {
			Name       string
			BrandName  string
			BrandEmail string
		}{name, footerName, brandEmail}),
		TextBody: welcomeText(name, footerName, brandName, brandEmail),
	}
}

// ───────────────────── Password Reset ─────────────────────

// PasswordResetMessage builds the password reset email.
func PasswordResetMessage(name, to, resetURL, brandName, brandEmail string) Message {
	if name == "" {
		name = "there"
	}
	footerName := brandName
	if footerName == "" {
		footerName = "BusinessCart"
	}
	return Message{
		To:      to,
		Subject: "Reset your password",
		HTMLBody: renderHTML(passwordResetHTMLTmpl, struct {
			Name       string
			ResetURL   string
			BrandName  string
			BrandEmail string
		}{name, resetURL, footerName, brandEmail}),
		TextBody: fmt.Sprintf("Hi %s,\n\nWe received a request to reset your password.\n\nReset your password: %s\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.\n\n%s\n", name, resetURL, brandFooterText(brandName, brandEmail)),
	}
}

const passwordResetHTMLTmpl = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Reset your password</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="color:#0d9488;margin-bottom:8px">Reset your password</h1>
  <p style="font-size:16px;line-height:1.5">Hi {{.Name}}, we received a request to reset your password.</p>
  <p style="margin:24px 0">
    <a href="{{.ResetURL}}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px">Reset Password</a>
  </p>
  <p style="font-size:14px;color:#64748b">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
  <p style="color:#64748b;font-size:12px">— {{.BrandName}}{{if .BrandEmail}} · <a href="mailto:{{.BrandEmail}}" style="color:#64748b;text-decoration:none">{{.BrandEmail}}</a>{{end}}</p>
</body>
</html>`

const welcomeHTMLTmpl = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Welcome</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="color:#0d9488;margin-bottom:8px">Welcome, {{.Name}}!</h1>
  <p style="font-size:16px;line-height:1.5">Your account at {{.BrandName}} has been created successfully.</p>
  {{if eq .BrandName "BusinessCart"}}<p style="font-size:16px;line-height:1.5">You can log in at <a href="https://businesscart.ai" style="color:#0d9488;text-decoration:none">businesscart.ai</a>.</p>{{end}}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
  <p style="color:#64748b;font-size:12px">— {{.BrandName}}{{if .BrandEmail}} · <a href="mailto:{{.BrandEmail}}" style="color:#64748b;text-decoration:none">{{.BrandEmail}}</a>{{end}}</p>
</body>
</html>`

// ───────────────────── New Customer Notification ─────────────────────

// NewCustomerToCompanyMessage is sent to the company owner when a new customer
// registers on their storefront. Always sent via the platform sender (BusinessCart SES).
func NewCustomerToCompanyMessage(to, customerName string) Message {
	if customerName == "" {
		customerName = "A new customer"
	}
	return Message{
		To:       to,
		Subject:  fmt.Sprintf("New customer on your store: %s", customerName),
		HTMLBody: renderHTML(newCustomerHTMLTmpl, struct{ Name string }{customerName}),
		TextBody: fmt.Sprintf("Hi,\n\n%s just registered on your storefront.\n\nYou can view your customers in the BusinessCart dashboard: https://businesscart.ai/users\n\n— BusinessCart\n", customerName),
	}
}

const newCustomerHTMLTmpl = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>New customer on your store</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="color:#0d9488;margin-bottom:8px">New customer on your store</h1>
  <p style="font-size:16px;line-height:1.5"><strong>{{.Name}}</strong> just registered on your storefront.</p>
  <p style="margin:24px 0">
    <a href="https://businesscart.ai/users" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px">View Customers</a>
  </p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
  <p style="color:#64748b;font-size:12px">— BusinessCart (notification from your platform)</p>
</body>
</html>`
