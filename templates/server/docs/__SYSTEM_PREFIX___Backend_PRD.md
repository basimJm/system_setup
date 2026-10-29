# **SYSTEM_NAME** — Backend PRD

> Behaviour source of truth for the server. One section per capability; client PRDs reference these sections. Precedence: PRD > BRD > Design Script > design files.

## 1. Purpose and scope

<What the backend does for the customer app, the merchant app and the admin panel. One paragraph.>

## 2. Actors

Customer (phone OTP), merchant member (OWNER / STAFF with permissions), admin (email + password + emailed code), system (jobs).

## 3. Capabilities (one subsection each)

### 3.1 Authentication

<Register, login, refresh, logout, change phone; the OTP flow; admin two-step sign-in.>

### 3.2 Items (sample feature — replace)

<Owner CRUD; admin archive/restore with a reason; notifications; real-time events.>

### 3.3 Uploads, notifications, settings, audit

<Which purposes, which events, which settings an admin may change.>

## 4. Non-functional

Arabic + English, p95 ≤ 300 ms on reads, every write audited, no secrets in logs.
