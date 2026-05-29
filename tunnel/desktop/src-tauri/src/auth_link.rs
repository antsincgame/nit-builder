//! Browser-based вход (Cursor-style) для привязки устройства.
//!
//! Поток (RFC 8252, OAuth for native apps):
//! 1. Поднимаем loopback-слушатель на 127.0.0.1:<случайный порт>.
//! 2. Генерим PKCE (verifier + challenge=S256) + state.
//! 3. Открываем браузер на {site}/link?challenge&state&port&device.
//! 4. Юзер аппрувит в браузере → сервер редиректит на наш loopback с ?code&state.
//! 5. Проверяем state, меняем code+verifier на device-токен через
//!    POST {site}/api/auth/tunnel/exchange.
//!
//! Всё на голом tokio (loopback) + reqwest (exchange). RNG/state — из uuid,
//! чтобы не тянуть доп. крейты. Браузер открываем через shell-плагин.

use std::collections::HashMap;
use std::time::Duration;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::timeout;

#[derive(Debug, Serialize)]
pub struct LoginResult {
    pub token: String,
    pub email: Option<String>,
    pub device_id: Option<String>,
}

/// Случайная строка из двух UUID (hex, без дефисов) — 64 символа,
/// валидный base64url-charset, ~244 бита энтропии. Без отдельного RNG-крейта.
fn random_token_str() -> String {
    let a = uuid::Uuid::new_v4().simple().to_string();
    let b = uuid::Uuid::new_v4().simple().to_string();
    format!("{a}{b}")
}

/// PKCE S256: base64url(sha256(verifier)) без padding.
fn challenge_from_verifier(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

/// Минимальный percent-encode для query-значения (имя устройства).
fn percent_encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn url_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                if let Ok(byte) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                    out.push(byte);
                    i += 3;
                } else {
                    out.push(bytes[i]);
                    i += 1;
                }
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            other => {
                out.push(other);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Распарсить query из request-line "GET /?code=..&state=.. HTTP/1.1".
fn parse_query(request_line: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let path = request_line.split_whitespace().nth(1).unwrap_or("");
    if let Some(qpos) = path.find('?') {
        let query = &path[qpos + 1..];
        for pair in query.split('&') {
            let mut it = pair.splitn(2, '=');
            let k = it.next().unwrap_or("");
            let v = it.next().unwrap_or("");
            if !k.is_empty() {
                map.insert(url_decode(k), url_decode(v));
            }
        }
    }
    map
}

const HTML_OK: &str = "<!DOCTYPE html><html lang=\"ru\"><head><meta charset=\"utf-8\"><title>nitgen</title></head><body style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0A0A0A;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0\"><div style=\"text-align:center\"><h2 style=\"color:#10b981;margin:0 0 8px\">Готово</h2><p style=\"color:#A1A1AA;margin:0\">Вернитесь в приложение nitgen. Эту вкладку можно закрыть.</p></div></body></html>";

/// Запустить весь флоу входа. Блокируется до получения токена или ошибки/таймаута.
pub async fn run_login_flow(
    app: AppHandle,
    site_url: String,
    device_name: String,
) -> Result<LoginResult, String> {
    let site = site_url.trim_end_matches('/').to_string();

    // 1. loopback listener на свободном порту
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Не удалось открыть локальный порт: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Не удалось определить порт: {e}"))?
        .port();

    // 2. PKCE + state
    let verifier = random_token_str();
    let challenge = challenge_from_verifier(&verifier);
    let state = random_token_str();

    // 3. открыть браузер на /link
    let url = format!(
        "{site}/link?challenge={challenge}&state={state}&port={port}&device={device}",
        device = percent_encode(&device_name),
    );
    app.shell()
        .open(url, None)
        .map_err(|e| format!("Не удалось открыть браузер: {e}"))?;

    // 4. ждём один редирект на loopback (до 3 минут)
    let accept_res = timeout(Duration::from_secs(180), listener.accept())
        .await
        .map_err(|_| "Истекло время ожидания входа".to_string())?;
    let (mut stream, _) = accept_res.map_err(|e| format!("Ошибка соединения: {e}"))?;

    // читаем первый пакет (request-line в нём)
    let mut buf = vec![0u8; 4096];
    let n = stream
        .read(&mut buf)
        .await
        .map_err(|e| format!("Ошибка чтения: {e}"))?;
    let request = String::from_utf8_lossy(&buf[..n]).into_owned();
    let request_line = request.lines().next().unwrap_or("");
    let params = parse_query(request_line);

    // отвечаем браузеру и закрываем
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
        HTML_OK.as_bytes().len(),
        HTML_OK,
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.flush().await;

    // 5. валидация state + наличие code
    let code = params.get("code").cloned().unwrap_or_default();
    let returned_state = params.get("state").cloned().unwrap_or_default();
    if code.is_empty() {
        return Err("Привязка не подтверждена".to_string());
    }
    if returned_state != state {
        return Err("Неверный state (возможна подмена)".to_string());
    }

    // 6. exchange code+verifier → токен
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{site}/api/auth/tunnel/exchange"))
        .json(&serde_json::json!({ "code": code, "verifier": verifier }))
        .send()
        .await
        .map_err(|e| format!("Сеть: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Сервер отклонил привязку ({})", resp.status()));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Некорректный ответ: {e}"))?;

    let token = body
        .get("token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Сервер не вернул токен".to_string())?
        .to_string();
    let email = body.get("email").and_then(|v| v.as_str()).map(|s| s.to_string());
    let device_id = body
        .get("deviceId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok(LoginResult {
        token,
        email,
        device_id,
    })
}
