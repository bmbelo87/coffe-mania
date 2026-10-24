package main

import (
	"testing"
	"time"
)

func TestTokenBucketsRefillAndStayPerKey(t *testing.T) {
	limiter := newTokenBuckets(2, 3)
	now := time.Now()
	for i := range 3 {
		if !limiter.allow("a", now) {
			t.Fatalf("pedido %d dentro da rajada", i+1)
		}
	}
	if limiter.allow("a", now) {
		t.Fatal("a rajada acabou")
	}
	if !limiter.allow("b", now) {
		t.Fatal("outra chave tem o próprio balde")
	}
	if !limiter.allow("a", now.Add(600*time.Millisecond)) {
		t.Fatal("2 por segundo: depois de 0,6 s há um pedido de novo")
	}
}

func TestLoginChallengeAfterRepeatedFailures(t *testing.T) {
	guard := &loginGuard{failures: map[string]loginFailures{}}
	now := time.Now()
	for range loginFreeAttempts - 1 {
		guard.fail("ana@example.com", now)
	}
	if guard.needsChallenge("ana@example.com", now) {
		t.Fatal("ainda dentro das tentativas livres")
	}
	guard.fail("ana@example.com", now)
	if !guard.needsChallenge("ana@example.com", now) || guard.needsChallenge("bia@example.com", now) {
		t.Fatal("o desafio vale só para a conta com falhas")
	}
	if guard.needsChallenge("ana@example.com", now.Add(loginFailureWindow+time.Second)) {
		t.Fatal("a janela de falhas expira")
	}
	guard.fail("ana@example.com", now)
	guard.succeed("ana@example.com")
	if guard.needsChallenge("ana@example.com", now) {
		t.Fatal("entrar com a senha certa zera a contagem")
	}
}
