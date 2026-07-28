package handler

import "testing"

// inferSource matches on substrings in switch order, so a host that happens to
// contain an earlier case's needle is silently misfiled. Three such collisions
// were live in prod and are locked down here:
//
//	"chatgpt.com"            contains "t.co"       -> twitter/social
//	"copilot.microsoft.com"  contains "t.co"       -> twitter/social
//	"gemini.google.com"      contains "google."    -> google/organic
//
// Any future reordering that reintroduces one of these fails this test.
func TestInferSourceOrderingCollisions(t *testing.T) {
	cases := []struct {
		name           string
		referrer       string
		source, medium string
	}{
		// Regressions: each of these returned the "want" column's wrong value before.
		{"chatgpt not twitter", "https://chatgpt.com/", "chatgpt", "llm"},
		{"openai legacy host", "https://chat.openai.com/", "chatgpt", "llm"},
		{"copilot not twitter", "https://copilot.microsoft.com/chats/1", "copilot", "llm"},
		{"gemini not google", "https://gemini.google.com/app", "gemini", "llm"},
		{"gemini grounding redirect", "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC", "gemini", "llm"},
		{"linux.ai is not grok", "https://www.linux.ai/docs", "referral", "referral"},
		{"phoenix.ai is not grok", "https://phoenix.ai/", "referral", "referral"},

		// Still-correct behaviour that the reordering must not break.
		{"real t.co shortlink", "https://t.co/abc123", "twitter", "social"},
		{"t.co no trailing slash", "https://t.co", "twitter", "social"},
		{"twitter.com", "https://twitter.com/x/status/1", "twitter", "social"},
		{"google search", "https://www.google.com/search?q=gloves", "google", "organic"},
		{"google android widget", "android-app://com.google.android.googlequicksearchbox", "google", "organic"},
		{"bing", "https://www.bing.com/search?q=x", "bing", "organic"},
		{"duckduckgo", "https://duckduckgo.com/", "duckduckgo", "organic"},
		{"yahoo", "https://search.yahoo.com/", "yahoo", "organic"},
		{"youtube is not you.com", "https://www.youtube.com/watch?v=1", "youtube", "social"},
		{"facebook", "https://m.facebook.com/", "facebook", "social"},
		{"instagram", "https://l.instagram.com/", "instagram", "social"},
		{"reddit", "https://www.reddit.com/r/welding", "reddit", "social"},
		{"linkedin", "https://www.linkedin.com/feed", "linkedin", "social"},
		{"tiktok", "https://www.tiktok.com/@x", "tiktok", "social"},

		// LLM hosts that previously fell through to referral/referral.
		{"grok", "https://grok.com/chat", "grok", "llm"},
		{"deepseek", "https://chat.deepseek.com/", "deepseek", "llm"},
		{"poe", "https://poe.com/ChatGPT", "poe", "llm"},
		{"mistral", "https://chat.mistral.ai/chat", "mistral", "llm"},
		// Brave and Kagi are keyword search engines that also ship an AI assistant.
		// Classifying an ordinary search as llm would inflate the LLM channel, so
		// they are organic and pinned here against a well-meaning "fix".
		{"brave is organic not llm", "https://search.brave.com/search?q=x", "brave", "organic"},
		{"kagi is organic not llm", "https://kagi.com/search?q=x", "kagi", "organic"},
		{"perplexity", "https://www.perplexity.ai/search", "perplexity", "llm"},
		{"claude", "https://claude.ai/chat/abc", "claude", "llm"},
		{"you.com", "https://you.com/search", "you", "llm"},

		// Fallbacks.
		{"unknown host", "https://example.com/page", "referral", "referral"},
		{"empty referrer", "", "referral", "referral"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			gotSource, gotMedium := inferSource(c.referrer)
			if gotSource != c.source || gotMedium != c.medium {
				t.Errorf("inferSource(%q) = %s/%s, want %s/%s",
					c.referrer, gotSource, gotMedium, c.source, c.medium)
			}
		})
	}
}

// Storebot-Google drives real checkout interactions (it adds to cart and taps
// checkout), and its UA carries "Mozilla", so the datacenter-ASN rule never
// caught it. Its synthetic events reached Meta as conversions. These cases pin
// the UA matching, including that a genuine browser on the same Google ASN is
// still NOT flagged, so no real shopper is dropped from the conversion path.
func TestDetectBotCatchesCheckoutDrivingAgents(t *testing.T) {
	const storebotUA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 (compatible; Storebot-Google/1.0; +http://www.google.com/bot.html)"

	cases := []struct {
		name, ua, asn string
		isBot         bool
		botName       string
	}{
		{"storebot with mozilla ua", storebotUA, "15169", true, "Storebot-Google"},
		{"chatgpt user agent", "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)", "20473", true, "ChatGPT-User"},
		{"oai searchbot", "Mozilla/5.0 (compatible; OAI-SearchBot/1.0)", "20473", true, "OAI-SearchBot"},
		{"perplexity user", "Mozilla/5.0 (compatible; Perplexity-User/1.0)", "20473", true, "Perplexity-User"},
		{"bytespider", "Mozilla/5.0 (compatible; Bytespider)", "0", true, "Bytespider"},
		{"googlebot still caught", "Mozilla/5.0 (compatible; Googlebot/2.1)", "15169", true, "Googlebot"},
		{"datacenter without mozilla", "curl/8.0", "15169", true, "datacenter"},
		// Must stay false: a real shopper on a consumer ISP, and a real browser that
		// happens to egress via a flagged ASN.
		{"real browser consumer isp", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36", "6167", false, ""},
		{"real browser on google asn", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0.0.0 Safari/537.36", "15169", false, ""},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			gotBot, gotName := detectBot(c.ua, c.asn)
			if gotBot != c.isBot || gotName != c.botName {
				t.Errorf("detectBot(asn=%s) = %v/%q, want %v/%q", c.asn, gotBot, gotName, c.isBot, c.botName)
			}
		})
	}
}

// A utm_source with no utm_medium used to skip classification entirely and store
// an empty medium. Seven live ChatGPT visitors are stored that way. These cases
// pin the fix, and pin that campaigns which set both values are unaffected.
func TestResolveSourceMedium(t *testing.T) {
	cases := []struct {
		name                           string
		utmSource, utmMedium, referrer string
		source, medium                 string
	}{
		// The bug: ChatGPT decorates links with utm_source and sends no medium.
		{"chatgpt utm no medium, no referrer", "chatgpt.com", "", "", "chatgpt", "llm"},
		{"chatgpt utm no medium, with referrer", "chatgpt.com", "", "https://chatgpt.com/", "chatgpt", "llm"},
		{"perplexity utm no medium", "perplexity.ai", "", "", "perplexity", "llm"},

		// Unrecognised utm_source with no medium falls back to the referrer.
		{"unknown source, referrer classifies", "fb", "", "https://m.facebook.com/", "fb", "social"},
		{"unknown source, no referrer", "newsletter", "", "", "newsletter", "referral"},

		// Campaigns that set both values must be byte-identical to before.
		{"google cpc untouched", "google", "cpc", "", "google", "cpc"},
		{"fb paid untouched", "fb", "paid", "https://m.facebook.com/", "fb", "paid"},
		{"ig paid untouched", "ig", "paid", "", "ig", "paid"},

		// No UTM at all: referrer, then direct.
		{"referrer only", "", "", "https://gemini.google.com/app", "gemini", "llm"},
		{"nothing at all", "", "", "", "direct", "direct"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			gotSource, gotMedium := resolveSourceMedium(c.utmSource, c.utmMedium, c.referrer)
			if gotSource != c.source || gotMedium != c.medium {
				t.Errorf("resolveSourceMedium(%q,%q,%q) = %s/%s, want %s/%s",
					c.utmSource, c.utmMedium, c.referrer, gotSource, gotMedium, c.source, c.medium)
			}
		})
	}
}
