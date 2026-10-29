#!/bin/sh
# Copies the Firebase config of the current environment (APP_ENV = dev | prod) into the app bundle
# (push, analytics, Crashlytics; phone OTP is WhatsApp, sent by the server).
set -e
SRC="$SRCROOT/Firebase/$APP_ENV/GoogleService-Info.plist"
if [ ! -f "$SRC" ]; then
  echo "error: missing $SRC (see docs/FIREBASE_SETUP.md)"
  exit 1
fi
APP_DIR="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH"
cp "$SRC" "$APP_DIR/GoogleService-Info.plist"
