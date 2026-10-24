package main

import (
	"errors"
	"os"
	"slices"
	"strconv"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// COFFE_ENV=production marks the public server (deploy/README in docs/producao.md).
func isProduction() bool { return os.Getenv("COFFE_ENV") == "production" }

// checkProductionConfig refuses a public server that would hand out developer tools,
// create the demo account or send the session cookie without HTTPS.
func checkProductionConfig() error {
	if !isProduction() {
		return nil
	}
	var problems []string
	if devToolsEnabled() {
		problems = append(problems, "COFFE_DEV_TOOLS precisa ficar desligado")
	}
	if os.Getenv("COFFE_DEV_SEED") == "true" {
		problems = append(problems, "COFFE_DEV_SEED precisa ficar desligado")
	}
	if !osSecureCookies() {
		problems = append(problems, "COFFE_SECURE_COOKIES=true é obrigatório (o jogo roda atrás de HTTPS)")
	}
	if os.Getenv("COFFE_TRUSTED_PROXY_HEADER") == "" {
		problems = append(problems, "COFFE_TRUSTED_PROXY_HEADER precisa indicar o cabeçalho com o IP real (ex.: X-Real-IP)")
	}
	// Signup, invites and password recovery depend on these.
	for _, name := range []string{"COFFE_PUBLIC_URL", "COFFE_SMTP_HOST", "COFFE_MAIL_FROM", "COFFE_CONTACT_EMAIL", "COFFE_TURNSTILE_SITE_KEY", "COFFE_TURNSTILE_SECRET"} {
		if strings.TrimSpace(os.Getenv(name)) == "" {
			problems = append(problems, name+" é obrigatório")
		}
	}
	if public := os.Getenv("COFFE_PUBLIC_URL"); public != "" && !strings.HasPrefix(public, "https://") {
		problems = append(problems, "COFFE_PUBLIC_URL precisa começar com https://")
	}
	if len(problems) > 0 {
		return errors.New("configuração de produção inválida: " + strings.Join(problems, "; "))
	}
	return nil
}

// applyServerSettings copies the environment into PocketBase settings, which live in the
// database: the real client IP behind the proxy (rate limits and logs depend on it), the
// scheduled backups and the SMTP account of the transactional email.
func applyServerSettings(app core.App) error {
	settings := app.Settings()
	changed := false
	if header := strings.TrimSpace(os.Getenv("COFFE_TRUSTED_PROXY_HEADER")); header != "" {
		// Only valid while PocketBase listens on 127.0.0.1 behind the proxy, which sets this
		// header itself; a directly reachable server would let anyone forge it.
		if !slices.Equal(settings.TrustedProxy.Headers, []string{header}) {
			settings.TrustedProxy.Headers = []string{header}
			settings.TrustedProxy.UseLeftmostIP = false
			changed = true
		}
	}
	if cron := strings.TrimSpace(os.Getenv("COFFE_BACKUP_CRON")); cron != "" && settings.Backups.Cron != cron {
		settings.Backups.Cron = cron
		changed = true
	}
	if keep, err := strconv.Atoi(os.Getenv("COFFE_BACKUP_KEEP")); err == nil && keep > 0 && settings.Backups.CronMaxKeep != keep {
		settings.Backups.CronMaxKeep = keep
		changed = true
	}
	if host := strings.TrimSpace(os.Getenv("COFFE_SMTP_HOST")); host != "" {
		port, err := strconv.Atoi(os.Getenv("COFFE_SMTP_PORT"))
		if err != nil || port <= 0 {
			port = 587
		}
		username, password := os.Getenv("COFFE_SMTP_USERNAME"), os.Getenv("COFFE_SMTP_PASSWORD")
		// Port 465 uses implicit TLS; 587 upgrades with STARTTLS.
		tls := os.Getenv("COFFE_SMTP_TLS") == "true" || port == 465
		smtp := &settings.SMTP
		if !smtp.Enabled || smtp.Host != host || smtp.Port != port || smtp.Username != username || smtp.Password != password || smtp.TLS != tls {
			smtp.Enabled, smtp.Host, smtp.Port, smtp.Username, smtp.Password, smtp.TLS = true, host, port, username, password, tls
			changed = true
		}
	}
	if from := strings.TrimSpace(os.Getenv("COFFE_MAIL_FROM")); from != "" && (settings.Meta.SenderAddress != from || settings.Meta.SenderName != "Café Mania") {
		settings.Meta.SenderAddress, settings.Meta.SenderName = from, "Café Mania"
		changed = true
	}
	if !changed {
		return nil
	}
	return app.Save(settings)
}
