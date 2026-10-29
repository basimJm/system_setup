#!/bin/sh
# Uploads dSYMs to Crashlytics for builds that produce them (Release). Skipped while the Firebase config
# is a placeholder (API key not 39 chars), so local builds never fail on it.
PLIST="$SRCROOT/Firebase/$APP_ENV/GoogleService-Info.plist"
API_KEY=$(/usr/libexec/PlistBuddy -c "Print API_KEY" "$PLIST" 2>/dev/null || true)
if [ "${#API_KEY}" -ne 39 ]; then
  echo "note: Crashlytics upload skipped (placeholder Firebase config for $APP_ENV)"
  exit 0
fi
if [ "$DEBUG_INFORMATION_FORMAT" != "dwarf-with-dsym" ]; then
  echo "note: Crashlytics upload skipped (no dSYM for $CONFIGURATION)"
  exit 0
fi
RUN="${BUILD_DIR%/Build/*}/SourcePackages/checkouts/firebase-ios-sdk/Crashlytics/run"
"$RUN" -gsp "$PLIST"
