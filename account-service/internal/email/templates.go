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

// ───────────────────── Welcome ─────────────────────

// WelcomeMessage builds the welcome email sent on registration.
func WelcomeMessage(name, to string) Message {
	if name == "" {
		name = "there"
	}
	return Message{
		To:       to,
		Subject:  "Welcome to BusinessCart",
		HTMLBody: renderHTML(welcomeHTMLTmpl, struct{ Name string }{name}),
		TextBody: fmt.Sprintf("Hi %s,\n\nYour BusinessCart account has been created successfully.\n\nYou can log in at https://businesscart.ai\n\n— BusinessCart\n", name),
	}
}

// ───────────────────── Password Reset ─────────────────────

// PasswordResetMessage builds the password reset email.
func PasswordResetMessage(name, to, resetURL string) Message {
	if name == "" {
		name = "there"
	}
	return Message{
		To:      to,
		Subject: "Reset your password",
		HTMLBody: renderHTML(passwordResetHTMLTmpl, struct {
			Name     string
			ResetURL string
		}{name, resetURL}),
		TextBody: fmt.Sprintf("Hi %s,\n\nWe received a request to reset your password.\n\nReset your password: %s\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.\n\n— BusinessCart\n", name, resetURL),
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
  <p style="color:#64748b;font-size:12px">— BusinessCart</p>
</body>
</html>`

const welcomeHTMLTmpl = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Welcome to BusinessCart</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="color:#0d9488;margin-bottom:8px">Welcome, {{.Name}}!</h1>
  <p style="font-size:16px;line-height:1.5">Your BusinessCart account has been created successfully.</p>
  <p style="font-size:16px;line-height:1.5">You can log in at <a href="https://businesscart.ai" style="color:#0d9488;text-decoration:none">businesscart.ai</a>.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
  <p style="color:#64748b;font-size:12px">— BusinessCart</p>
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
