#!/bin/sh
# Local REAL stack for testing the admin panel against __SERVER_DIR__: MongoDB (replica set), Redis and the server with its
# fake external providers. Needs mongod, mongosh and redis-server on the PATH and the server built
# (`npm ci && npm run build` in ../__SERVER_DIR__). Local development only: the passwords below are throw-away.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="${SERVER_DIR:-$HERE/../../__SERVER_DIR__}"
Q="${QA_DIR:-${TMPDIR:-/tmp}/app-qa}"
API_PORT="${API_PORT:-4000}"
ADMIN_ORIGINS="${ADMIN_ORIGINS:-http://localhost:4173,http://localhost:4174}"
mkdir -p "$Q/mongo" "$Q/redis"

if ! pgrep -f "mongod.*27018" >/dev/null; then
  nohup mongod --dbpath "$Q/mongo" --replSet rs0 --port 27018 --bind_ip 127.0.0.1 --logpath "$Q/mongod.log" >/dev/null 2>&1 &
  sleep 4
  mongosh --quiet --port 27018 --eval 'try{rs.status().ok}catch(e){rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27018"}]}).ok}'
fi
if ! pgrep -f "redis-server.*6380" >/dev/null; then
  nohup redis-server --port 6380 --bind 127.0.0.1 --dir "$Q/redis" --save "" >"$Q/redis.log" 2>&1 &
  sleep 1
fi

cd "$SERVER_DIR"
export NODE_ENV=development PORT="$API_PORT" LOG_LEVEL=info
# Fake external providers, so no real email/SMS/payment is sent from a QA run.
export NOTIFIER_PROVIDER=fake OTP_PROVIDER=fake OTP_FIXED_CODE="${QA_OTP_CODE:-123456}"
export MONGODB_URI='mongodb://127.0.0.1:27018/app_qa?replicaSet=rs0' REDIS_URL='redis://127.0.0.1:6380'
export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-qa-local-secret-qa-local-secret-qa-local-1234}"
export CORS_ALLOWED_ORIGINS="$ADMIN_ORIGINS"
export ADMIN_EMAIL="${ADMIN_EMAIL:-qa.admin@example.test}" ADMIN_PASSWORD="${ADMIN_PASSWORD:-QaAdminPass#2026}"
node dist/seeds/run.js >/dev/null 2>&1 || true
node dist/seeds/runAdmin.js >/dev/null 2>&1 || true
pkill -f "node dist/server.js" 2>/dev/null || true
sleep 1
nohup node dist/server.js >"$Q/server.log" 2>&1 &
sleep 5
curl -s -o /dev/null -w "server health %{http_code}\n" "http://127.0.0.1:$API_PORT/health"
echo "STACK-READY (logs in $Q). Admin: $ADMIN_EMAIL / $ADMIN_PASSWORD; API http://127.0.0.1:$API_PORT"
