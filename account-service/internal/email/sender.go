// Package email provides a stdlib-only SMTP wrapper for sending transactional emails.
//
// Phase 1 design:
//   - Uses Go's net/smtp + crypto/tls — no third-party dependencies
//   - Designed for AWS SES SMTP endpoint but works with any SMTP server
//   - Falls back to a no-op logger if any required env var is missing
//     so local SAM dev works without SMTP setup
//   - All sends are non-blocking from the caller's perspective: caller logs errors
//     but never fails the user-facing request
//
// Required env vars (when real sender wanted):
//   EMAIL_FROM_ADDRESS    e.g., "noreply@businesscart.ai"
//   EMAIL_SMTP_HOST       e.g., "email-smtp.us-east-1.amazonaws.com"
//   EMAIL_SMTP_PORT       e.g., "587"
//   EMAIL_SMTP_USERNAME   SES SMTP username (NOT IAM access key)
//   EMAIL_SMTP_PASSWORD   SES SMTP password
package email

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"
	"strings"
)

// Sender is the interface used by handlers.
type Sender interface {
	Send(ctx context.Context, msg Message) error
}

// Message describes a single transactional email.
type Message struct {
	To       string
	ReplyTo  string
	Subject  string
	HTMLBody string
	TextBody string
}

// Config holds SMTP connection details.
type Config struct {
	From     string
	Host     string
	Port     string
	Username string
	Password string
}

type smtpSender struct {
	cfg Config
}

type noopSender struct {
	from string
}

func (n *noopSender) Send(_ context.Context, msg Message) error {
	log.Printf("[email DRY RUN] from=%s to=%s subject=%q", n.from, msg.To, msg.Subject)
	return nil
}

// NewSender creates a Sender from environment configuration.
// Returns a no-op sender if any required field is missing — keeping local dev working.
func NewSender(_ context.Context, cfg Config) Sender {
	if cfg.From == "" || cfg.Host == "" || cfg.Port == "" || cfg.Username == "" || cfg.Password == "" {
		log.Printf("[email] SMTP not fully configured — using no-op sender (from=%q host=%q)", cfg.From, cfg.Host)
		return &noopSender{from: cfg.From}
	}
	return &smtpSender{cfg: cfg}
}

func (s *smtpSender) Send(_ context.Context, msg Message) error {
	if msg.To == "" {
		return nil
	}
	body := buildMIME(s.cfg.From, msg)
	addr := s.cfg.Host + ":" + s.cfg.Port

	auth := smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.Host)

	// Use STARTTLS for ports 587/25, implicit TLS for 465
	if s.cfg.Port == "465" {
		return sendImplicitTLS(addr, s.cfg.Host, auth, s.cfg.From, []string{msg.To}, body)
	}
	return smtp.SendMail(addr, auth, s.cfg.From, []string{msg.To}, body)
}

// sendImplicitTLS handles SMTPS (port 465) which requires TLS from the start.
func sendImplicitTLS(addr, host string, auth smtp.Auth, from string, to []string, body []byte) error {
	tlsConfig := &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}
	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("tls dial: %w", err)
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer c.Close()

	if err := c.Auth(auth); err != nil {
		return fmt.Errorf("auth: %w", err)
	}
	if err := c.Mail(from); err != nil {
		return fmt.Errorf("mail: %w", err)
	}
	for _, addr := range to {
		if err := c.Rcpt(addr); err != nil {
			return fmt.Errorf("rcpt: %w", err)
		}
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("data: %w", err)
	}
	if _, err := w.Write(body); err != nil {
		return fmt.Errorf("write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("close: %w", err)
	}
	return c.Quit()
}

// buildMIME constructs a multipart/alternative MIME message with both HTML and plain text bodies.
func buildMIME(from string, msg Message) []byte {
	var b strings.Builder
	boundary := "BC-MIME-BOUNDARY-2026"

	b.WriteString("From: " + from + "\r\n")
	b.WriteString("To: " + msg.To + "\r\n")
	if msg.ReplyTo != "" {
		b.WriteString("Reply-To: " + msg.ReplyTo + "\r\n")
	}
	b.WriteString("Subject: " + msg.Subject + "\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")

	// Has both HTML and text → multipart/alternative
	if msg.HTMLBody != "" && msg.TextBody != "" {
		b.WriteString("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n\r\n")
		b.WriteString("--" + boundary + "\r\n")
		b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
		b.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
		b.WriteString(msg.TextBody + "\r\n\r\n")
		b.WriteString("--" + boundary + "\r\n")
		b.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
		b.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
		b.WriteString(msg.HTMLBody + "\r\n\r\n")
		b.WriteString("--" + boundary + "--\r\n")
	} else if msg.HTMLBody != "" {
		b.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
		b.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
		b.WriteString(msg.HTMLBody + "\r\n")
	} else {
		b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
		b.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
		b.WriteString(msg.TextBody + "\r\n")
	}

	return []byte(b.String())
}
