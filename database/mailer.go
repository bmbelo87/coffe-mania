package main

import (
	"bytes"
	"html/template"
	"net/mail"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/mailer"
)

// mailConfigured reports whether real email goes out (SMTP from the environment, applied to
// PocketBase settings by applyServerSettings). Without it, a development server keeps the
// messages in dev_mailbox so every link can be tested locally.
func mailConfigured() bool { return os.Getenv("COFFE_SMTP_HOST") != "" }

// gameMail is one of the transactional messages: a title, a few paragraphs and one button.
type gameMail struct {
	To, Kind, Subject, Title string
	Paragraphs               []string
	Button, Link             string
	Footer                   string
}

var mailTemplate = template.Must(template.New("mail").Parse(`<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px 12px;background:#e5e2cf;font-family:Arial,Helvetica,sans-serif;color:#66401e">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:480px;background:#fffdf7;border:2px solid #b7863b;border-radius:14px" cellspacing="0" cellpadding="0">
<tr><td style="padding:28px 28px 8px;text-align:center">
{{if .Logo}}<img src="{{.Logo}}" alt="Café Mania" width="180" style="display:block;margin:0 auto 12px;border:0">{{end}}
<h1 style="margin:0 0 8px;font-size:22px">{{.Title}}</h1></td></tr>
<tr><td style="padding:0 28px;font-size:16px;line-height:1.5">{{range .Paragraphs}}<p style="margin:0 0 14px">{{.}}</p>{{end}}</td></tr>
{{if .Link}}<tr><td style="padding:6px 28px 22px;text-align:center">
<a href="{{.Link}}" style="display:inline-block;padding:12px 22px;background:#b7863b;border:1px solid #956829;border-radius:6px;color:#fff;font-size:17px;text-decoration:none">{{.Button}}</a>
<p style="margin:14px 0 0;font-size:12px;color:#8a5a22;word-break:break-all">Se o botão não abrir, copie este endereço: {{.Link}}</p></td></tr>{{end}}
<tr><td style="padding:0 28px 24px;font-size:12px;color:#8a5a22;line-height:1.4">{{.Footer}}</td></tr>
</table></td></tr></table></body></html>`))

const mailFooter = "Café Mania é um projeto de fãs, sem fins lucrativos e sem vínculo com a Vostu. Se você não pediu esta mensagem, pode ignorá-la."

func renderMail(message gameMail, base string) (string, string, error) {
	if message.Footer == "" {
		message.Footer = mailFooter
	}
	var html bytes.Buffer
	data := struct {
		gameMail
		Logo string
	}{message, ""}
	if base != "" {
		data.Logo = base + "/assets/ui/logo/cafe-mania.png"
	}
	if err := mailTemplate.Execute(&html, data); err != nil {
		return "", "", err
	}
	text := message.Title + "\n\n" + strings.Join(message.Paragraphs, "\n\n")
	if message.Link != "" {
		text += "\n\n" + message.Button + ": " + message.Link
	}
	return html.String(), text + "\n\n" + message.Footer + "\n", nil
}

func sendGameMail(app core.App, message gameMail, base string) error {
	html, text, err := renderMail(message, base)
	if err != nil {
		return err
	}
	if !mailConfigured() {
		if isProduction() {
			return errMailUnavailable
		}
		collection, err := app.FindCollectionByNameOrId("dev_mailbox")
		if err != nil {
			return err
		}
		record := core.NewRecord(collection)
		record.Set("to", message.To)
		record.Set("kind", message.Kind)
		record.Set("subject", message.Subject)
		record.Set("link", message.Link)
		record.Set("html", html)
		app.Logger().Info("Email de desenvolvimento guardado (não enviado)", "to", message.To, "kind", message.Kind, "link", message.Link)
		return app.Save(record)
	}
	settings := app.Settings()
	return app.NewMailClient().Send(&mailer.Message{
		From:    mail.Address{Name: settings.Meta.SenderName, Address: settings.Meta.SenderAddress},
		To:      []mail.Address{{Address: message.To}},
		Subject: message.Subject,
		HTML:    html,
		Text:    text,
	})
}
