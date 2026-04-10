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
