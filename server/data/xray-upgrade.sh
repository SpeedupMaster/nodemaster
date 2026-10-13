#!/usr/bin/env bash
set -euo pipefail
umask 077
TARGET_VER='{{VERSION}}'
[[ "$TARGET_VER" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 1
case $(uname -m) in
  x86_64) XRAY_ARCH=64 ;;
  aarch64|arm64) XRAY_ARCH=arm64-v8a ;;
  *) echo "Unsupported architecture" >&2; exit 1 ;;
esac
TEMP=$(mktemp -d /usr/local/bin/.nodemaster-upgrade.XXXXXX)
trap 'rm -rf "$TEMP"' EXIT
curl -fsSL --connect-timeout 10 --max-time 120 "https://github.com/XTLS/Xray-core/releases/download/${TARGET_VER}/Xray-linux-${XRAY_ARCH}.zip" -o "$TEMP/xray.zip"
curl -fsSL --connect-timeout 10 --max-time 30 "https://github.com/XTLS/Xray-core/releases/download/${TARGET_VER}/Xray-linux-${XRAY_ARCH}.zip.dgst" -o "$TEMP/xray.dgst"
EXPECTED_SHA256=$(awk '$1 == "SHA2-256=" {print $2}' "$TEMP/xray.dgst")
[[ "$EXPECTED_SHA256" =~ ^[a-fA-F0-9]{64}$ ]] || { echo "Invalid official checksum" >&2; exit 1; }
printf '%s  %s\n' "$EXPECTED_SHA256" "$TEMP/xray.zip" | sha256sum -c -
unzip -qo "$TEMP/xray.zip" xray -d "$TEMP"
chmod 755 "$TEMP/xray"
ACTUAL=$("$TEMP/xray" version | awk 'NR == 1 {print $2}')
[ "v${ACTUAL#v}" = "$TARGET_VER" ] || { echo "Downloaded version mismatch" >&2; exit 1; }
XRAY_LOCATION_ASSET=/usr/local/bin "$TEMP/xray" run -test -c /etc/nodemaster/config.json
WAS_RUNNING=0
systemctl is-active --quiet nodemaster-proxy && WAS_RUNNING=1
[ ! -f /usr/local/bin/xray ] || cp -p /usr/local/bin/xray "$TEMP/xray.backup"
mv "$TEMP/xray" /usr/local/bin/xray
if [ "$WAS_RUNNING" = 1 ] && [ ! -f /etc/nodemaster/circuit-broken ]; then
  if ! systemctl restart nodemaster-proxy || ! sleep 1 || ! systemctl is-active --quiet nodemaster-proxy; then
    if [ -f "$TEMP/xray.backup" ]; then
      mv "$TEMP/xray.backup" /usr/local/bin/xray
      systemctl restart nodemaster-proxy || true
    fi
    echo "Service restart failed; previous binary restored" >&2
    exit 1
  fi
fi
echo "Installed ${TARGET_VER}; probe will report the actual version."
