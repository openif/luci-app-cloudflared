#!/bin/sh
# =================================================================
# luci-app-cloudflared 1-Click Online Installer for OpenWrt / iStoreOS
# Repository: https://github.com/openif/luci-app-cloudflared
# =================================================================

set -e

echo "================================================="
echo " Installing luci-app-cloudflared for OpenWrt..."
echo "================================================="

# 1. Verify OpenWrt environment
if [ ! -f /etc/openwrt_release ] && [ ! -f /etc/os-release ]; then
    echo "[-] Error: This installer is intended for OpenWrt or iStoreOS routers."
    exit 1
fi

# 2. Check cloudflared core binary
if ! command -v cloudflared >/dev/null 2>&1; then
    echo "[!] Notice: 'cloudflared' core program not found."
    echo "[*] Attempting to install cloudflared via opkg..."
    opkg update || true
    if opkg install cloudflared; then
        echo "[+] Successfully installed cloudflared from feeds."
    else
        echo "[!] Notice: cloudflared was not found in current software feeds."
        echo "    Please ensure you install the cloudflared binary into /usr/bin/cloudflared."
        echo "    Official downloads: https://github.com/cloudflare/cloudflared/releases"
    fi
fi

# 3. Download and install latest release IPKs
TMP_IPK="/tmp/luci-app-cloudflared_latest.ipk"
TMP_I18N_IPK="/tmp/luci-i18n-cloudflared-zh-cn_latest.ipk"
RELEASE_URL="https://github.com/openif/luci-app-cloudflared/releases/download/v1.0.0/luci-app-cloudflared_1.0.0-1_all.ipk"
RELEASE_I18N_URL="https://github.com/openif/luci-app-cloudflared/releases/download/v1.0.0/luci-i18n-cloudflared-zh-cn_1.0.0-1_all.ipk"

echo "[*] Downloading package..."
DOWNLOAD_SUCCESS=0
if command -v curl >/dev/null 2>&1; then
    curl -fLs -o "$TMP_IPK" "$RELEASE_URL" && DOWNLOAD_SUCCESS=1 || true
    curl -fLs -o "$TMP_I18N_IPK" "$RELEASE_I18N_URL" 2>/dev/null || true
elif command -v wget >/dev/null 2>&1; then
    wget -qO "$TMP_IPK" "$RELEASE_URL" && DOWNLOAD_SUCCESS=1 || true
    wget -qO "$TMP_I18N_IPK" "$RELEASE_I18N_URL" 2>/dev/null || true
fi

if [ "$DOWNLOAD_SUCCESS" -eq 1 ] && [ -s "$TMP_IPK" ]; then
    echo "[*] Installing package via opkg..."
    if [ -s "$TMP_I18N_IPK" ]; then
        opkg install "$TMP_IPK" "$TMP_I18N_IPK"
    else
        opkg install "$TMP_IPK"
    fi
    rm -f "$TMP_IPK" "$TMP_I18N_IPK"
else
    echo "[*] IPK not directly accessible yet. Installing plugin files directly..."
    RAW_BASE="https://raw.githubusercontent.com/openif/luci-app-cloudflared/main"

    dl() {
        local target="$1"
        local url="${RAW_BASE}/$2"
        mkdir -p "$(dirname "$target")"
        if command -v curl >/dev/null 2>&1; then
            curl -fsSL -o "$target" "$url"
        else
            wget -qO "$target" "$url"
        fi
    }

    dl "/etc/init.d/cloudflared" "root/etc/init.d/cloudflared"
    dl "/etc/config/cloudflared" "root/etc/config/cloudflared"
    dl "/etc/uci-defaults/40_luci-cloudflared" "root/etc/uci-defaults/40_luci-cloudflared"
    dl "/usr/share/luci/menu.d/luci-app-cloudflared.json" "root/usr/share/luci/menu.d/luci-app-cloudflared.json"
    dl "/usr/share/rpcd/acl.d/luci-app-cloudflared.json" "root/usr/share/rpcd/acl.d/luci-app-cloudflared.json"
    dl "/www/luci-static/resources/view/cloudflared/config.js" "htdocs/luci-static/resources/view/cloudflared/config.js"
    dl "/www/luci-static/resources/view/cloudflared/tunnels.js" "htdocs/luci-static/resources/view/cloudflared/tunnels.js"
    dl "/www/luci-static/resources/view/cloudflared/log.js" "htdocs/luci-static/resources/view/cloudflared/log.js"

    chmod +x /etc/init.d/cloudflared
    chmod +x /etc/uci-defaults/40_luci-cloudflared
    [ -f /etc/uci-defaults/40_luci-cloudflared ] && /etc/uci-defaults/40_luci-cloudflared && rm -f /etc/uci-defaults/40_luci-cloudflared
    /etc/init.d/rpcd restart
fi

echo ""
echo "================================================="
echo " [✓] luci-app-cloudflared installed successfully!"
echo " Please refresh your LuCI Web interface:"
echo " Go to: Services -> Cloudflare Zero Trust Tunnel"
echo "================================================="