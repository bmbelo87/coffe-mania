package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const turnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

func turnstileSiteKey() string { return os.Getenv("COFFE_TURNSTILE_SITE_KEY") }

// verifyTurnstile checks the anti-bot token of a public form. Production requires the keys
// (production.go); a development server without them skips the check, so it works offline.
func verifyTurnstile(ctx context.Context, token, remoteIP string) bool {
	secret := os.Getenv("COFFE_TURNSTILE_SECRET")
	if secret == "" {
		return !isProduction()
	}
	if token == "" || len(token) > 2048 {
		return false
	}
	form := url.Values{"secret": {secret}, "response": {token}}
	if remoteIP != "" {
		form.Set("remoteip", remoteIP)
	}
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, turnstileVerifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return false
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return false
	}
	defer response.Body.Close()
	var result struct {
		Success bool `json:"success"`
	}
	return json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&result) == nil && result.Success
}
